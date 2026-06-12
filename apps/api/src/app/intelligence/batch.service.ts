import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, PipelineRunStatus, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { bucketTotals, deriveBatchCounts, deriveBatchStatus } from './batch-status';
import type { ListBatchesQueryDto } from './intelligence.dto';
import {
  DEFAULT_PIPELINE_KEY,
  PipelineExecutorService,
} from './pipeline-executor.service';

const STORAGE_FOLDER = 'intelligence';

interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Batch ingestion (docs/07 §5): fan a set of documents into N PipelineRuns on
 * one pipeline. P4.3 = multi-file upload; zip/S3/API converge on the same
 * fan-out seam later. Concurrency/retry come from the executor + BullMQ (the
 * runs are independent). Batch status/counters are derived from its runs.
 */
@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly executor: PipelineExecutorService,
  ) {}

  /** Upload many files and start a run per file on the chosen pipeline. */
  async createMultiFileBatch(
    userId: string,
    files: UploadFile[],
    opts?: { name?: string; pipelineKey?: string; ownerOrgId?: string },
  ) {
    if (!files?.length) {
      throw new NotFoundException('No files provided');
    }
    if (opts?.ownerOrgId) await this.assertOrgMember(userId, opts.ownerOrgId);

    const pipeline = await this.executor.ensureDefaultPipeline(
      opts?.pipelineKey ?? DEFAULT_PIPELINE_KEY,
    );

    const batch = await this.db.batch.create({
      data: {
        ownerUserId: opts?.ownerOrgId ? null : userId,
        ownerOrgId: opts?.ownerOrgId ?? null,
        pipelineId: pipeline.id,
        name: opts?.name ?? `Batch of ${files.length}`,
        source: 'multi_file',
        status: BatchStatus.running,
      },
    });

    const runIds: string[] = [];
    for (const file of files) {
      const stored = await this.storage.upload(file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
        folder: STORAGE_FOLDER,
        userId,
      });
      const source = await this.db.sourceDocument.create({
        data: {
          ownerUserId: opts?.ownerOrgId ? null : userId,
          ownerOrgId: opts?.ownerOrgId ?? null,
          filename: file.originalname,
          contentType: file.mimetype,
          s3Key: stored.key,
          byteSize: stored.size,
          status: 'uploaded',
        },
      });
      const { pipelineRunId } = await this.executor.startRun(
        userId,
        source.id,
        undefined,
        { batchId: batch.id, pipelineId: pipeline.id },
      );
      runIds.push(pipelineRunId);
    }

    this.logger.log(`Batch ${batch.id} started with ${runIds.length} runs`);
    return { batchId: batch.id, runIds };
  }

  async list(userId: string, query: ListBatchesQueryDto) {
    const where: Prisma.BatchWhereInput = { ownerUserId: userId };
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.status) where.status = query.status as BatchStatus;

    const dir = query.dir;
    const orderBy: Prisma.BatchOrderByWithRelationInput =
      query.sort === 'name'
        ? { name: dir }
        : query.sort === 'status'
          ? { status: dir }
          : { createdAt: dir };

    // Page of batches + total count.
    const [batches, total] = await this.db.$transaction([
      this.db.batch.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: query.page * query.pageSize,
        include: { runs: { select: { status: true } } },
      }),
      this.db.batch.count({ where }),
    ]);

    // Workspace funnel totals — across ALL the user's runs, so the KPI tiles
    // stay correct regardless of the current page or status filter.
    const grouped = (await this.db.pipelineRun.groupBy({
      by: ['status'],
      where: { batch: { ownerUserId: userId } },
      orderBy: { status: 'asc' },
      _count: { _all: true },
    })) as unknown as {
      status: PipelineRunStatus;
      _count: { _all: number };
    }[];

    return {
      items: batches.map((b) => this.withCounts(b)),
      total,
      totals: bucketTotals(grouped),
    };
  }

  async get(userId: string, batchId: string) {
    const batch = await this.db.batch.findUnique({
      where: { id: batchId },
      include: {
        runs: {
          orderBy: { createdAt: 'asc' },
          include: {
            sourceDocument: { select: { id: true, filename: true } },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    await this.assertCanAccess(userId, batch);

    const runs = batch.runs.map((r) => ({
      id: r.id,
      status: r.status,
      sourceDocumentId: r.sourceDocumentId,
      filename: r.sourceDocument.filename,
      documentTypeKey: r.documentTypeKey,
      archivedReason: r.archivedReason,
    }));

    // Status funnel (cheap, derived from run.status — no per-stage queries).
    const inProgress = batch.runs.filter((r) =>
      r.status === 'queued' || r.status === 'running',
    ).length;
    const funnel = {
      inProgress,
      needsReview: batch.runs.filter((r) => r.status === 'needs_review').length,
      completed: batch.runs.filter(
        (r) => r.status === 'completed' || r.status === 'approved',
      ).length,
      archived: batch.runs.filter((r) => r.status === 'archived').length,
      failed: batch.runs.filter(
        (r) => r.status === 'failed' || r.status === 'rejected',
      ).length,
    };

    // Classified-type histogram ("of N docs, how many of each type").
    const histMap = new Map<string, number>();
    for (const r of batch.runs) {
      const key = r.documentTypeKey ?? 'unclassified';
      histMap.set(key, (histMap.get(key) ?? 0) + 1);
    }
    const typeHistogram = [...histMap.entries()]
      .map(([documentTypeKey, count]) => ({ documentTypeKey, count }))
      .sort((a, b) => b.count - a.count);

    return {
      ...this.withCounts({
        ...batch,
        runs: batch.runs.map((r) => ({ status: r.status })),
      }),
      funnel,
      typeHistogram,
      runs,
    };
  }

  /** Derive live status counts from the batch's runs (single-sourced). */
  private withCounts(batch: {
    id: string;
    name: string | null;
    status: BatchStatus;
    createdAt: Date;
    runs: { status: PipelineRunStatus }[];
  }) {
    const c = deriveBatchCounts(batch.runs);
    return {
      id: batch.id,
      name: batch.name,
      status: deriveBatchStatus(c),
      total: c.total,
      completed: c.completed,
      needsReview: c.needsReview,
      failed: c.failed,
      archived: c.archived,
      running: c.running,
      createdAt: batch.createdAt,
    };
  }

  private async assertCanAccess(
    userId: string,
    batch: { ownerUserId: string | null; ownerOrgId: string | null },
  ) {
    if (batch.ownerUserId === userId) return;
    if (batch.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: batch.ownerOrgId, userId } },
      });
      if (m) return;
    }
    throw new ForbiddenException('Not allowed');
  }

  private async assertOrgMember(userId: string, orgId: string) {
    const m = await this.db.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this organisation');
  }
}
