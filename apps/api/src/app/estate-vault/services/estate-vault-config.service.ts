import { Injectable, Logger } from '@nestjs/common';
import {
  estateVaultConfigSchema,
  type EstateVaultConfigDto,
  type UpdateEstateVaultConfigDto,
} from '@org/dto';
import { DatabaseService } from '../../database/database.service';
import { DEFAULT_ESTATE_CONFIG } from '../estate.constants';

/**
 * Config-as-data for the estate-vault module (docs/13 §0.3). One JSON row per
 * org (plus a system row, ownerOrgId=null, seeded from code). Resolved
 * org-row → system-row → code default, so a fresh DB and a new config key both
 * "just work". Admins edit the config without a redeploy.
 */
@Injectable()
export class EstateVaultConfigService {
  private readonly logger = new Logger(EstateVaultConfigService.name);
  private seeded = false;

  constructor(private readonly db: DatabaseService) {}

  /** Seed the system row (ownerOrgId=null) from code on first use. */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    const existing = await this.db.estateVaultConfig.findFirst({
      where: { ownerOrgId: null },
    });
    if (!existing) {
      await this.db.estateVaultConfig.create({
        data: {
          ownerOrgId: null,
          enabled: DEFAULT_ESTATE_CONFIG.enabled,
          config: DEFAULT_ESTATE_CONFIG,
        },
      });
      this.logger.log('EstateVault: seeded system config row.');
    }
    this.seeded = true;
  }

  /** Resolved config for an org (org row → system row → code default). */
  async resolve(orgId: string | null): Promise<EstateVaultConfigDto> {
    await this.ensureSeeded();
    const row = orgId
      ? (await this.db.estateVaultConfig.findUnique({
          where: { ownerOrgId: orgId },
        })) ??
        (await this.db.estateVaultConfig.findFirst({ where: { ownerOrgId: null } }))
      : await this.db.estateVaultConfig.findFirst({ where: { ownerOrgId: null } });
    return this.parse(row?.config);
  }

  /** Merge a partial update over the current resolved config and persist it. */
  async update(
    orgId: string | null,
    patch: UpdateEstateVaultConfigDto,
  ): Promise<EstateVaultConfigDto> {
    await this.ensureSeeded();
    const current = await this.resolve(orgId);
    const merged = estateVaultConfigSchema.parse({
      ...current,
      ...patch,
      toggles: { ...current.toggles, ...(patch.toggles ?? {}) },
      assetTypes: patch.assetTypes ?? current.assetTypes,
    });
    await this.db.estateVaultConfig.upsert({
      where: { ownerOrgId: orgId ?? undefined },
      create: { ownerOrgId: orgId ?? null, enabled: merged.enabled, config: merged },
      update: { enabled: merged.enabled, config: merged },
    });
    return merged;
  }

  /** Active asset types for an org, in display order. */
  async assetTypes(orgId: string | null) {
    const cfg = await this.resolve(orgId);
    return cfg.assetTypes
      .filter((t) => t.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Validate/coerce a stored JSON blob, falling back to the code default. */
  private parse(raw: unknown): EstateVaultConfigDto {
    const parsed = estateVaultConfigSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    this.logger.warn('EstateVault: stored config invalid — using code default.');
    return estateVaultConfigSchema.parse(DEFAULT_ESTATE_CONFIG);
  }
}
