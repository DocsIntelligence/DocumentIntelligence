import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AnalysisService } from './analysis.service';

export const ANALYSIS_QUEUE = 'analysis-queue';
export const ANALYSIS_QUEUE_ENABLED = 'ANALYSIS_QUEUE_ENABLED';

export interface AnalysisQueuePayload {
  itemId: string;
}

export interface AnalysisQueueItemDto {
  id: string;
  documentId: string;
  status: 'queued' | 'running' | 'done' | 'cached' | 'failed';
  runId: string | null;
  error: string | null;
  force: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BatchProgress {
  batchId: string;
  createdAt: string;
  items: AnalysisQueueItemDto[];
  counts: {
    queued: number;
    running: number;
    done: number;
    cached: number;
    failed: number;
    total: number;
  };
  isComplete: boolean;
}

/**
 * Server-side queue for "analyse N documents". One row per requested analysis,
 * grouped by `batchId` so the UI can show a single progress bar across the
 * group. A BullMQ worker drains the queue when REDIS_URL is set; without
 * Redis we chain processing inline (fire-and-forget) — same status transitions
 * either way (mirrors IntelligenceModule's pattern).
 *
 * Decoupling matters here: the analyse endpoint itself is synchronous (the AI
 * call blocks the request), so bulk requests would otherwise pin a worker for
 * minutes. The queue lets the user submit + close the dialog; work continues
 * regardless.
 */
@Injectable()
export class AnalysisQueueService {
  private readonly logger = new Logger(AnalysisQueueService.name);
  /** Reentrancy guard for the inline drainer (no Redis). */
  private inlineDraining = false;

  constructor(
    @Optional()
    @InjectQueue(ANALYSIS_QUEUE)
    private readonly queue: Queue | null,
    @Inject(ANALYSIS_QUEUE_ENABLED) private readonly enabled: boolean,
    private readonly db: DatabaseService,
    private readonly analysis: AnalysisService,
  ) {}

  /**
   * Enqueue a batch. Validates accessibility (only ids the user can see end up
   * in the queue), persists one row per doc with `batchId`, then dispatches.
   * Returns the batch + the persisted items immediately so the UI can show
   * "queued" pills from the first paint.
   */
  async enqueueBatch(
    userId: string,
    documentIds: string[],
    opts: { force?: boolean } = {},
  ): Promise<BatchProgress> {
    if (documentIds.length === 0) {
      throw new NotFoundException('No document ids provided');
    }
    // Filter to docs the user can actually access — anything else is silently
    // dropped so we never enqueue work for inaccessible ids.
    const accessible = await this.db.document.findMany({
      where: {
        id: { in: documentIds },
        OR: [
          { ownerUserId: userId },
          { ownerOrg: { members: { some: { userId } } } },
        ],
      },
      select: { id: true },
    });
    const ids = accessible.map((d) => d.id);
    if (ids.length === 0) {
      throw new NotFoundException('No accessible documents in the request');
    }

    const batchId = randomUUID();
    const force = !!opts.force;
    await this.db.analysisQueueItem.createMany({
      data: ids.map((documentId) => ({
        userId,
        batchId,
        documentId,
        force,
      })),
    });

    // Dispatch — BullMQ when available, else inline drainer.
    const items = await this.db.analysisQueueItem.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    });
    if (this.enabled && this.queue) {
      for (const it of items) {
        await this.queue.add(
          'analyse',
          { itemId: it.id } as AnalysisQueuePayload,
          {
            jobId: it.id,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 500,
            removeOnFail: 500,
          },
        );
      }
    } else {
      // Inline mode: drain in the background. `void` so the HTTP response
      // returns immediately; the drainer keeps running.
      void this.drainInline();
    }

    return this.toProgress(batchId, items);
  }

  /** Fetch a batch's items + progress counts. */
  async getBatch(userId: string, batchId: string): Promise<BatchProgress> {
    const items = await this.db.analysisQueueItem.findMany({
      where: { batchId, userId },
      orderBy: { createdAt: 'asc' },
    });
    if (items.length === 0) throw new NotFoundException('Batch not found');
    return this.toProgress(batchId, items);
  }

  /**
   * Recent batches for the user that still have in-flight work, OR finished
   * within the last 60 seconds (so the UI can show a "just completed" toast).
   */
  async getActive(userId: string): Promise<BatchProgress[]> {
    const since = new Date(Date.now() - 60_000);
    const items = await this.db.analysisQueueItem.findMany({
      where: {
        userId,
        OR: [
          { status: { in: ['queued', 'running'] } },
          { finishedAt: { gte: since } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const byBatch = new Map<string, typeof items>();
    for (const it of items) {
      const arr = byBatch.get(it.batchId) ?? [];
      arr.push(it);
      byBatch.set(it.batchId, arr);
    }
    return Array.from(byBatch.entries())
      .map(([batchId, rows]) =>
        this.toProgress(
          batchId,
          [...rows].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          ),
        ),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  // ─── Worker entrypoint ────────────────────────────────────────────────────

  /**
   * Process a single queued item. Called by the BullMQ worker OR by the inline
   * drainer. Idempotent: skips items that are no longer 'queued' (a retry that
   * already succeeded is a no-op).
   */
  async processItem(itemId: string): Promise<void> {
    const item = await this.db.analysisQueueItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      this.logger.warn(`processItem: missing item ${itemId}`);
      return;
    }
    if (item.status !== 'queued') return; // idempotent

    await this.db.analysisQueueItem.update({
      where: { id: itemId },
      data: { status: 'running', startedAt: new Date() },
    });

    try {
      // Capture the most recent run id BEFORE the call so we can detect a
      // cache hit (analyzeDocument returns the same row when text is unchanged
      // and force=false).
      const before = await this.db.analysisRun.findFirst({
        where: { subjectType: 'document', subjectId: item.documentId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      const run = await this.analysis.analyzeDocument(
        item.userId,
        item.documentId,
        { force: item.force },
      );

      const cached = !item.force && before?.id === run.id;
      await this.db.analysisQueueItem.update({
        where: { id: itemId },
        data: {
          status: cached ? 'cached' : 'done',
          runId: run.id,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`analysis queue item ${itemId} failed: ${message}`);
      await this.db.analysisQueueItem.update({
        where: { id: itemId },
        data: {
          status: 'failed',
          error: message.slice(0, 500),
          finishedAt: new Date(),
        },
      });
    }
  }

  // ─── Inline (no-Redis) drainer ────────────────────────────────────────────

  /**
   * Walks queued rows oldest-first and processes them sequentially. A single
   * drainer at a time per process; concurrent enqueues are absorbed by the
   * loop's re-check after each item. Survives process restarts to the extent
   * that a re-fired enqueue (e.g. on next user action) re-triggers the loop.
   * For multi-instance deployments, Redis mode is the correct configuration.
   */
  private async drainInline(): Promise<void> {
    if (this.inlineDraining) return;
    this.inlineDraining = true;
    try {
      while (true) {
        const next = await this.db.analysisQueueItem.findFirst({
          where: { status: 'queued' },
          orderBy: { createdAt: 'asc' },
        });
        if (!next) return;
        await this.processItem(next.id);
      }
    } finally {
      this.inlineDraining = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toProgress(
    batchId: string,
    items: Array<{
      id: string;
      documentId: string;
      status: string;
      runId: string | null;
      error: string | null;
      force: boolean;
      createdAt: Date;
      startedAt: Date | null;
      finishedAt: Date | null;
    }>,
  ): BatchProgress {
    const counts = {
      queued: 0,
      running: 0,
      done: 0,
      cached: 0,
      failed: 0,
      total: items.length,
    };
    for (const it of items) {
      if (it.status in counts) {
        counts[it.status as keyof typeof counts] += 1;
      }
    }
    return {
      batchId,
      createdAt: (items[0]?.createdAt ?? new Date()).toISOString(),
      items: items.map((it) => ({
        id: it.id,
        documentId: it.documentId,
        status: it.status as AnalysisQueueItemDto['status'],
        runId: it.runId,
        error: it.error,
        force: it.force,
        createdAt: it.createdAt.toISOString(),
        startedAt: it.startedAt?.toISOString() ?? null,
        finishedAt: it.finishedAt?.toISOString() ?? null,
      })),
      counts,
      isComplete: counts.queued === 0 && counts.running === 0,
    };
  }
}
