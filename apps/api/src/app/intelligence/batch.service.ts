import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, PipelineRunStatus } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
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

  async list(userId: string) {
    const batches = await this.db.batch.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { runs: { select: { status: true } } },
    });
    return batches.map((b) => this.withCounts(b));
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
    }));
    return {
      ...this.withCounts({ ...batch, runs: batch.runs.map((r) => ({ status: r.status })) }),
      runs,
    };
  }

  /** Derive live status counts from the batch's runs. */
  private withCounts(batch: {
    id: string;
    name: string | null;
    status: BatchStatus;
    createdAt: Date;
    runs: { status: PipelineRunStatus }[];
  }) {
    const total = batch.runs.length;
    const count = (s: PipelineRunStatus) =>
      batch.runs.filter((r) => r.status === s).length;
    const completed = count('completed') + count('approved');
    const needsReview = count('needs_review');
    const failed = count('failed') + count('rejected');
    const running = total - completed - needsReview - failed;
    const status: BatchStatus =
      running > 0
        ? BatchStatus.running
        : needsReview > 0
          ? BatchStatus.needs_review
          : failed === total && total > 0
            ? BatchStatus.failed
            : BatchStatus.completed;
    return {
      id: batch.id,
      name: batch.name,
      status,
      total,
      completed,
      needsReview,
      failed,
      running,
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
