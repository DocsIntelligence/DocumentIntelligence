import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const FIRST_SWEEP_DELAY_MS = 60_000; // first sweep one minute after boot
const BATCH_SIZE = 5_000; // delete in chunks so a runaway purge can't OOM PG

/**
 * Nightly-ish purge for the AI usage ledger. Each row carries its own
 * `retentionDays` (defaulted from the `ai.usage.retention.days` setting at
 * insert time), so retention can be tightened or extended per-row without a
 * migration. The sweep deletes any row whose `createdAt + retentionDays` is in
 * the past, in bounded chunks, so the DELETE never blocks Postgres on a huge
 * tombstone scan.
 *
 * Dependency-free interval (matches the IntelligenceReconciler pattern — no
 * @nestjs/schedule). Sweep runs on every API replica; the DELETE itself is
 * idempotent, so multiple instances racing is harmless.
 */
@Injectable()
export class AiUsagePurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiUsagePurgeService.name);
  private timer: NodeJS.Timeout | null = null;
  private initial: NodeJS.Timeout | null = null;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Don't sweep at boot — wait a minute so migrations / warm-up finish first.
    this.initial = setTimeout(() => {
      void this.runSafely();
      this.timer = setInterval(() => void this.runSafely(), SWEEP_INTERVAL_MS);
      this.timer.unref?.();
    }, FIRST_SWEEP_DELAY_MS);
    this.initial.unref?.();
    this.logger.log('AI usage purge scheduler started');
  }

  onModuleDestroy() {
    if (this.initial) clearTimeout(this.initial);
    if (this.timer) clearInterval(this.timer);
  }

  private async runSafely(): Promise<void> {
    try {
      const purged = await this.purge();
      if (purged > 0) {
        this.logger.log(`Purged ${purged} expired AiUsage row(s)`);
      }
    } catch (e) {
      this.logger.error(`AI usage purge failed: ${(e as Error).message}`);
    }
  }

  /**
   * Delete rows whose `createdAt + retentionDays` is in the past. Returns
   * the number of rows deleted across all chunks.
   *
   * Why raw SQL — Prisma can't express `createdAt + retentionDays * '1 day'`
   * in `deleteMany`, and we want the comparison to happen server-side (one
   * round-trip per chunk) rather than streaming millions of rows to Node.
   */
  async purge(): Promise<number> {
    let total = 0;
    // Loop until a chunk returns 0 rows — we delete the oldest expired first.
    // The CTE `to_delete` selects up to BATCH_SIZE expired ids; the outer
    // DELETE removes exactly those. This keeps each statement bounded.
    for (;;) {
      const result = await this.db.$executeRaw`
        WITH expired AS (
          SELECT id
            FROM "AiUsage"
           WHERE "createdAt" + ("retentionDays" || ' days')::interval < NOW()
           ORDER BY "createdAt" ASC
           LIMIT ${BATCH_SIZE}
        )
        DELETE FROM "AiUsage" u
         USING expired e
         WHERE u.id = e.id
      `;
      const deleted = Number(result) || 0;
      total += deleted;
      if (deleted < BATCH_SIZE) break; // last chunk
    }
    return total;
  }
}
