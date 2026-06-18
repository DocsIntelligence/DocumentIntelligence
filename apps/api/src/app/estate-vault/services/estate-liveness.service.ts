import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ReleaseService } from './release.service';

/** How often to sweep for overdue liveness check-ins. Pings are day-scale, so
 *  hourly is plenty; the dependency-free interval mirrors the intelligence
 *  reconciler (no @nestjs/schedule). */
const SWEEP_INTERVAL_MS = 60 * 60_000; // 1 hour
const LEASE_NAME = 'estate_liveness';

/**
 * Liveness scheduler for the dead-man-switch (docs/13 §1.3). Periodically asks
 * ReleaseService to advance overdue grants (active → pinged → escalated) and
 * email owners to check in. Never releases automatically — release is
 * human-verified.
 *
 * Multi-instance safe: each tick first claims a `SchedulerLease` row with an
 * atomic conditional UPDATE (set lockedUntil = now+interval WHERE lockedUntil <
 * now). Postgres serialises the row lock, so exactly one replica wins per cycle
 * and the rest skip — no double-advance / duplicate emails across replicas.
 */
@Injectable()
export class EstateLivenessService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EstateLivenessService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly release: ReleaseService,
    private readonly db: DatabaseService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sweep().catch((e) =>
        this.logger.error(`Estate liveness sweep failed: ${(e as Error).message}`),
      );
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.();
    this.logger.log('Estate liveness scheduler started');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Claim the lease, and run the sweep only if this instance won the cycle. */
  private async sweep(): Promise<void> {
    if (!(await this.claimLease())) {
      this.logger.debug('Liveness sweep skipped — lease held by another instance');
      return;
    }
    await this.release.tick();
  }

  /** Atomic, multi-instance-safe lease claim. True ⇒ this instance owns the cycle. */
  private async claimLease(): Promise<boolean> {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + SWEEP_INTERVAL_MS);
    // Refresh an existing, expired lease. The row lock serialises concurrent
    // claimants, so only the first sees lockedUntil < now and wins.
    const claimed = await this.db.schedulerLease.updateMany({
      where: { name: LEASE_NAME, lockedUntil: { lt: now } },
      data: { lockedUntil },
    });
    if (claimed.count > 0) return true;
    // No row yet (first ever run): create it. A unique violation means another
    // instance created it first this cycle → we lose, skip.
    try {
      await this.db.schedulerLease.create({
        data: { name: LEASE_NAME, lockedUntil },
      });
      return true;
    } catch {
      return false;
    }
  }
}
