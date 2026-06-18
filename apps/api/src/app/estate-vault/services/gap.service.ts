import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { ResolvedProfile } from './estate-profile.service';
import { EstateVaultConfigService } from './estate-vault-config.service';

export type NudgeKind =
  | 'no_nominees_at_all'
  | 'no_nominee'
  | 'no_value'
  | 'stale'
  | 'dormant';

export interface Nudge {
  kind: NudgeKind;
  severity: 'info' | 'warning';
  message: string;
  assetId?: string;
  assetLabel?: string;
}

const DAY_MS = 86_400_000;

/**
 * Operational gap nudges (docs/13 §10.2) — the "money is not orphaned" alerts.
 * Strictly descriptive/operational (no-nominee, no-value, stale, dormant), NOT
 * investment advice (§3.2, avoids SEBI RIA exposure).
 */
@Injectable()
export class GapService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: EstateVaultConfigService,
  ) {}

  async nudges(profile: ResolvedProfile): Promise<Nudge[]> {
    const cfg = await this.config.resolve(null);
    const [assets, nomineeCount] = await Promise.all([
      this.db.asset.findMany({
        where: { profileId: profile.id, isActive: true },
        include: { nominations: { select: { id: true } } },
      }),
      this.db.nominee.count({ where: { profileId: profile.id } }),
    ]);

    const nudges: Nudge[] = [];
    const now = Date.now();

    if (assets.length > 0 && nomineeCount === 0) {
      nudges.push({
        kind: 'no_nominees_at_all',
        severity: 'warning',
        message:
          'No nominees yet — add at least one so your family can find and claim these assets.',
      });
    }

    for (const a of assets) {
      if (a.nominations.length === 0 && nomineeCount > 0) {
        nudges.push({
          kind: 'no_nominee',
          severity: 'info',
          message: `"${a.label}" has no nominee assigned.`,
          assetId: a.id,
          assetLabel: a.label,
        });
      }
      if (a.currentValueMinor === null) {
        nudges.push({
          kind: 'no_value',
          severity: 'info',
          message: `"${a.label}" has no value recorded.`,
          assetId: a.id,
          assetLabel: a.label,
        });
      }
      const last = (a.lastActivityAt ?? a.updatedAt).getTime();
      const ageDays = (now - last) / DAY_MS;
      if (ageDays > cfg.dormancyThresholdDays) {
        nudges.push({
          kind: 'dormant',
          severity: 'warning',
          message: `"${a.label}" hasn't been updated in over ${Math.floor(
            ageDays / 30,
          )} months — confirm it's still active so it isn't lost.`,
          assetId: a.id,
          assetLabel: a.label,
        });
      } else if (ageDays > cfg.freshnessThresholdDays) {
        nudges.push({
          kind: 'stale',
          severity: 'info',
          message: `"${a.label}" may be out of date — update its value.`,
          assetId: a.id,
          assetLabel: a.label,
        });
      }
    }

    // Warnings first, then info; cap so the UI stays calm (§8).
    return nudges
      .sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'warning' ? -1 : 1))
      .slice(0, 25);
  }
}
