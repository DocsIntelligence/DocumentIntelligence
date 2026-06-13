import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, PipelineRunStatus, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { SearchIndexService } from '../search/search-index.service';
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
    private readonly searchIndex: SearchIndexService,
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
      this.searchIndex.enqueueSource(source.id);
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
    const batch = await this.db.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    await this.assertCanAccess(userId, batch);

    // Aggregate via groupBy — NEVER load all runs (a batch can hold ~1000).
    const byStatus = (await this.db.pipelineRun.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    })) as unknown as { status: PipelineRunStatus; _count: { _all: number } }[];
    const statusCount = (s: PipelineRunStatus) =>
      byStatus.find((g) => g.status === s)?._count._all ?? 0;

    const funnel = {
      inProgress: statusCount('queued') + statusCount('running'),
      needsReview: statusCount('needs_review'),
      completed: statusCount('completed') + statusCount('approved'),
      archived: statusCount('archived'),
      failed: statusCount('failed') + statusCount('rejected'),
    };

    // Classified-type histogram via groupBy (page-independent).
    const byType = (await this.db.pipelineRun.groupBy({
      by: ['documentTypeKey'],
      where: { batchId },
      _count: { _all: true },
    })) as unknown as {
      documentTypeKey: string | null;
      _count: { _all: number };
    }[];
    const typeHistogram = byType
      .map((g) => ({
        documentTypeKey: g.documentTypeKey ?? 'unclassified',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);

    // Reconstruct the status array for the shared count helper (cheap — strings).
    const statusRuns = byStatus.flatMap((g) =>
      Array.from({ length: g._count._all }, () => ({ status: g.status })),
    );

    return {
      ...this.withCounts({ ...batch, runs: statusRuns }),
      funnel,
      typeHistogram,
    };
  }

  /** A page of a batch's runs (docs/09 #9 — server-side, batches can be huge). */
  async listRuns(
    userId: string,
    batchId: string,
    query: {
      status?: PipelineRunStatus;
      documentTypeKey?: string;
      openable?: boolean;
      page: number;
      pageSize: number;
    },
  ) {
    const batch = await this.db.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    await this.assertCanAccess(userId, batch);

    const where: Prisma.PipelineRunWhereInput = { batchId };
    if (query.openable) {
      where.status = { in: ['needs_review', 'completed', 'approved'] };
    } else if (query.status) {
      where.status = query.status;
    }
    if (query.documentTypeKey) {
      where.documentTypeKey =
        query.documentTypeKey === 'unclassified' ? null : query.documentTypeKey;
    }

    // Openable view drives the review stepper (client re-sorts needs_review
    // first); otherwise chronological for the runs table.
    const orderBy: Prisma.PipelineRunOrderByWithRelationInput[] = query.openable
      ? [{ updatedAt: 'desc' }]
      : [{ createdAt: 'asc' }];

    const [rows, total] = await this.db.$transaction([
      this.db.pipelineRun.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: query.page * query.pageSize,
        include: { sourceDocument: { select: { id: true, filename: true } } },
      }),
      this.db.pipelineRun.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        sourceDocumentId: r.sourceDocumentId,
        filename: r.sourceDocument.filename,
        documentTypeKey: r.documentTypeKey,
        archivedReason: r.archivedReason,
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
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
