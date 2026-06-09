import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const SWEEP_INTERVAL_MS = 60_000; // check once a minute
const STALE_AFTER_MS = 5 * 60_000; // a job processing >5min with no heartbeat is stuck

/**
 * Reconciler for stuck IntelligenceJobs (docs/05 §1 — crash-resilience). A
 * dependency-free interval sweep (no @nestjs/schedule): jobs left in
 * `processing` whose `heartbeatAt` went stale — process crashed mid-pipeline,
 * inline run lost, worker died — are marked `failed` so the UI stops spinning
 * and the user can retry. BullMQ's own retries cover transient queue failures;
 * this catches the cases BullMQ can't see (inline mode, hard crashes).
 */
@Injectable()
export class ReconcilerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconcilerService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch((e) =>
        this.logger.error(`Reconciler sweep failed: ${(e as Error).message}`),
      );
    }, SWEEP_INTERVAL_MS);
    // Don't keep the process alive solely for the reconciler.
    this.timer.unref?.();
    this.logger.log('Intelligence reconciler started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const stuck = await this.db.intelligenceJob.findMany({
      where: {
        status: 'processing',
        OR: [{ heartbeatAt: { lt: cutoff } }, { heartbeatAt: null }],
      },
      select: { id: true, sourceDocumentId: true },
    });
    if (stuck.length === 0) return 0;

    this.logger.warn(`Reconciling ${stuck.length} stuck job(s)`);
    for (const job of stuck) {
      await this.db.intelligenceJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: 'Reconciled: job stalled (no heartbeat). Please retry.',
          finishedAt: new Date(),
        },
      });
      await this.db.sourceDocument.update({
        where: { id: job.sourceDocumentId },
        data: { status: 'failed' },
      });
    }
    return stuck.length;
  }
}
