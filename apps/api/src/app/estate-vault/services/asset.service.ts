import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateAssetDto,
  ListAssetsQueryDto,
  RecordValuationDto,
  UpdateAssetDto,
} from '@org/dto';
import { DatabaseService } from '../../database/database.service';
import { EstateEnvelopeService } from './estate-envelope.service';
import type { ResolvedProfile } from './estate-profile.service';
import { EstateVaultConfigService } from './estate-vault-config.service';

/** Internal shape: an Asset row as Prisma returns it. */
type AssetRow = Prisma.AssetGetPayload<Record<string, never>>;

/**
 * Asset inventory + valuations + net worth (docs/13 §2, §10). Monetary amounts
 * are stored as minor-unit integers (paise) for fast aggregation; sensitive
 * identifiers/notes are encrypted at rest via VaultCryptoService (the M4
 * per-asset envelope upgrade replaces this single-key path later).
 */
@Injectable()
export class AssetService {
  constructor(
    private readonly db: DatabaseService,
    private readonly envelope: EstateEnvelopeService,
    private readonly config: EstateVaultConfigService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────

  async create(profile: ResolvedProfile, dto: CreateAssetDto) {
    const valueMinor = toMinor(dto.value);
    const asset = await this.db.asset.create({
      data: {
        ownerUserId: profile.ownerUserId,
        profileId: profile.id,
        type: dto.type,
        label: dto.label,
        institution: dto.institution ?? null,
        currency: dto.currency,
        currentValueMinor: valueMinor,
        unitsHeld: dto.units ?? null,
        identifierMasked: maskIdentifier(dto.identifier),
        status: dto.status,
        maturityDate: parseDate(dto.maturityDate),
        ...(dto.details ? { details: dto.details } : {}),
        lastActivityAt: new Date(),
      },
    });
    await this.writeSecret(asset.id, profile.ownerUserId, dto.identifier, dto.notes);
    if (valueMinor !== null) {
      await this.db.assetValuation.create({
        data: {
          assetId: asset.id,
          valueMinor,
          currency: dto.currency,
          asOf: new Date(),
          source: 'manual',
        },
      });
    }
    await this.recomputeSnapshot(profile);
    return this.present(asset);
  }

  /** Create many assets at once (e.g. all holdings from one CAS statement).
   *  Reconciles by (type, institution, masked identifier): a re-imported
   *  statement UPDATES the matching asset (appends a valuation) instead of
   *  duplicating it (docs/13 §2.3 idempotent re-ingest). One snapshot at the end. */
  async bulkCreate(profile: ResolvedProfile, items: CreateAssetDto[]) {
    let created = 0;
    let updated = 0;
    const assetIds: string[] = [];
    for (const dto of items) {
      const valueMinor = toMinor(dto.value);
      const existing = await this.findDuplicate(profile.id, dto);
      if (existing) {
        await this.db.asset.update({
          where: { id: existing.id },
          data: {
            ...(valueMinor !== null ? { currentValueMinor: valueMinor } : {}),
            ...(dto.units !== undefined ? { unitsHeld: dto.units ?? null } : {}),
            ...(dto.maturityDate !== undefined
              ? { maturityDate: parseDate(dto.maturityDate) }
              : {}),
            ...(dto.details ? { details: dto.details } : {}),
            lastActivityAt: new Date(),
          },
        });
        if (valueMinor !== null) {
          await this.db.assetValuation.create({
            data: {
              assetId: existing.id,
              valueMinor,
              currency: dto.currency,
              asOf: new Date(),
              source: 'extracted',
            },
          });
        }
        updated += 1;
        assetIds.push(existing.id);
        continue;
      }
      const asset = await this.db.asset.create({
        data: {
          ownerUserId: profile.ownerUserId,
          profileId: profile.id,
          type: dto.type,
          label: dto.label,
          institution: dto.institution ?? null,
          currency: dto.currency,
          currentValueMinor: valueMinor,
          unitsHeld: dto.units ?? null,
          identifierMasked: maskIdentifier(dto.identifier),
          status: dto.status,
          maturityDate: parseDate(dto.maturityDate),
          ...(dto.details ? { details: dto.details } : {}),
          lastActivityAt: new Date(),
        },
      });
      await this.writeSecret(asset.id, profile.ownerUserId, dto.identifier, dto.notes);
      if (valueMinor !== null) {
        await this.db.assetValuation.create({
          data: {
            assetId: asset.id,
            valueMinor,
            currency: dto.currency,
            asOf: new Date(),
            source: 'extracted',
          },
        });
      }
      created += 1;
      assetIds.push(asset.id);
    }
    await this.recomputeSnapshot(profile);
    return { created, updated, assetIds };
  }

  /** Match an existing active asset by type + institution + masked identifier
   *  + label. Only dedupes when an identifier is present (otherwise too loose).
   *  `label` is part of the key because one identifier can hold MANY holdings —
   *  e.g. a single mutual-fund folio number spans every scheme in that AMC, so
   *  matching on folio alone would wrongly collapse distinct schemes into one. */
  private async findDuplicate(profileId: string, dto: CreateAssetDto) {
    const masked = maskIdentifier(dto.identifier);
    if (!masked) return null;
    return this.db.asset.findFirst({
      where: {
        profileId,
        isActive: true,
        type: dto.type,
        institution: dto.institution ?? null,
        identifierMasked: masked,
        label: { equals: dto.label, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }

  async list(profile: ResolvedProfile, query: ListAssetsQueryDto) {
    const where: Prisma.AssetWhereInput = {
      profileId: profile.id,
      isActive: true,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { label: { contains: query.q, mode: 'insensitive' } },
              { institution: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = this.orderBy(query.sort, query.dir);
    const [rows, total] = await Promise.all([
      this.db.asset.findMany({
        where,
        orderBy,
        skip: query.page * query.pageSize,
        take: query.pageSize,
      }),
      this.db.asset.count({ where }),
    ]);
    return { items: rows.map((r) => this.present(r)), total };
  }

  async get(profile: ResolvedProfile, id: string) {
    const asset = await this.requireInProfile(profile.id, id);
    return this.present(asset);
  }

  /** Unmasked identifier/notes (decrypted). Kept separate from `get`. */
  async reveal(profile: ResolvedProfile, id: string) {
    const asset = await this.requireInProfile(profile.id, id);
    const secret = await this.envelope.revealOwner(
      asset.id,
      profile.ownerUserId,
      asset.dataEncrypted,
    );
    return {
      id: asset.id,
      identifier: (secret['identifier'] as string) ?? null,
      notes: (secret['notes'] as string) ?? null,
    };
  }

  async update(profile: ResolvedProfile, id: string, dto: UpdateAssetDto) {
    const asset = await this.requireInProfile(profile.id, id);
    const valueMinor = toMinor(dto.value);
    const secretChanged =
      dto.identifier !== undefined || dto.notes !== undefined;

    const data: Prisma.AssetUpdateInput = {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.label !== undefined ? { label: dto.label } : {}),
      ...(dto.institution !== undefined ? { institution: dto.institution } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.maturityDate !== undefined
        ? { maturityDate: parseDate(dto.maturityDate) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(valueMinor !== null ? { currentValueMinor: valueMinor } : {}),
      ...(dto.units !== undefined ? { unitsHeld: dto.units ?? null } : {}),
      ...(dto.details !== undefined
        ? { details: dto.details ?? Prisma.JsonNull }
        : {}),
    };
    let nextIdentifier: string | undefined;
    let nextNotes: string | undefined;
    if (secretChanged) {
      const current = await this.envelope.revealOwner(
        asset.id,
        profile.ownerUserId,
        asset.dataEncrypted,
      );
      nextIdentifier =
        dto.identifier !== undefined
          ? dto.identifier ?? undefined
          : (current['identifier'] as string | undefined);
      nextNotes =
        dto.notes !== undefined
          ? dto.notes ?? undefined
          : (current['notes'] as string | undefined);
      data.identifierMasked = maskIdentifier(nextIdentifier);
    }

    const updated = await this.db.asset.update({ where: { id }, data });
    if (secretChanged) {
      await this.writeSecret(id, profile.ownerUserId, nextIdentifier, nextNotes);
    }
    if (valueMinor !== null) {
      await this.db.assetValuation.create({
        data: {
          assetId: id,
          valueMinor,
          currency: updated.currency,
          asOf: new Date(),
          source: 'manual',
        },
      });
    }
    await this.recomputeSnapshot(profile);
    return this.present(updated);
  }

  /** Soft-delete (preserves valuation history). */
  async remove(profile: ResolvedProfile, id: string) {
    await this.requireInProfile(profile.id, id);
    await this.db.asset.update({ where: { id }, data: { isActive: false } });
    await this.recomputeSnapshot(profile);
    return { ok: true };
  }

  // ── Valuations / history (the time-machine, §10.2) ────────────────────────

  async recordValuation(profile: ResolvedProfile, id: string, dto: RecordValuationDto) {
    await this.requireInProfile(profile.id, id);
    const valueMinor = BigInt(Math.round(dto.value * 100));
    const asOf = parseDate(dto.asOf) ?? new Date();
    await this.db.assetValuation.create({
      data: { assetId: id, valueMinor, currency: dto.currency, asOf, source: dto.source },
    });
    // Keep the denormalised current value pointing at the newest as-of date.
    const latest = await this.db.assetValuation.findFirst({
      where: { assetId: id },
      orderBy: { asOf: 'desc' },
    });
    if (latest && latest.asOf.getTime() === asOf.getTime()) {
      await this.db.asset.update({
        where: { id },
        data: { currentValueMinor: valueMinor, lastActivityAt: new Date() },
      });
    }
    await this.recomputeSnapshot(profile);
    return { ok: true };
  }

  async valuations(profile: ResolvedProfile, id: string) {
    await this.requireInProfile(profile.id, id);
    const rows = await this.db.assetValuation.findMany({
      where: { assetId: id },
      orderBy: { asOf: 'asc' },
    });
    return rows.map((r) => ({
      asOf: r.asOf.toISOString(),
      value: minorToMajor(r.valueMinor),
      currency: r.currency,
      source: r.source,
    }));
  }

  // ── Net worth (§10) ───────────────────────────────────────────────────────

  async netWorth(profile: ResolvedProfile, orgId: string | null = null) {
    const [assets, types] = await Promise.all([
      this.db.asset.findMany({
        where: { profileId: profile.id, isActive: true },
        select: { type: true, currency: true, currentValueMinor: true },
      }),
      this.config.assetTypes(orgId),
    ]);
    const labels = new Map(types.map((t) => [t.key, t]));
    const byType = new Map<string, bigint>();
    let totalMinor = 0n;
    for (const a of assets) {
      const v = a.currentValueMinor ?? 0n;
      totalMinor += v;
      byType.set(a.type, (byType.get(a.type) ?? 0n) + v);
    }
    return {
      netWorth: minorToMajor(totalMinor),
      currency: 'INR',
      assetCount: assets.length,
      byType: [...byType.entries()]
        .map(([type, minor]) => ({
          type,
          label: labels.get(type)?.label ?? type,
          category: labels.get(type)?.category ?? 'other',
          value: minorToMajor(minor),
        }))
        .sort((a, b) => b.value - a.value),
    };
  }

  /** Portfolio net-worth-over-time (snapshot rows), ascending. */
  async netWorthHistory(profile: ResolvedProfile) {
    const rows = await this.db.wealthSnapshot.findMany({
      where: { profileId: profile.id },
      orderBy: { asOf: 'asc' },
      take: 365,
    });
    return rows.map((r) => ({
      asOf: r.asOf.toISOString(),
      netWorth: minorToMajor(r.netWorthMinor),
      currency: r.currency,
    }));
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async requireInProfile(profileId: string, id: string): Promise<AssetRow> {
    const asset = await this.db.asset.findFirst({
      where: { id, profileId },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  /** Write a snapshot row when the portfolio total changes (cheap history). */
  private async recomputeSnapshot(profile: ResolvedProfile) {
    const assets = await this.db.asset.findMany({
      where: { profileId: profile.id, isActive: true },
      select: { type: true, currentValueMinor: true },
    });
    let totalMinor = 0n;
    const byType: Record<string, string> = {};
    for (const a of assets) {
      const v = a.currentValueMinor ?? 0n;
      totalMinor += v;
      byType[a.type] = ((BigInt(byType[a.type] ?? '0') + v)).toString();
    }
    const last = await this.db.wealthSnapshot.findFirst({
      where: { profileId: profile.id },
      orderBy: { asOf: 'desc' },
    });
    if (last && last.netWorthMinor === totalMinor) return;
    await this.db.wealthSnapshot.create({
      data: {
        ownerUserId: profile.ownerUserId,
        profileId: profile.id,
        netWorthMinor: totalMinor,
        currency: 'INR',
        totalsByType: byType,
      },
    });
  }

  /** Seal an asset's sensitive fields via the envelope service (per-asset DEK
   *  wrapped for the owner + any current nominees). No-op-safe for empty input. */
  private async writeSecret(
    assetId: string,
    userId: string,
    identifier?: string,
    notes?: string,
  ): Promise<void> {
    const blob: Record<string, string> = {};
    if (identifier) blob['identifier'] = identifier;
    if (notes) blob['notes'] = notes;
    await this.envelope.write(assetId, userId, blob);
  }

  private orderBy(
    sort: ListAssetsQueryDto['sort'],
    dir: ListAssetsQueryDto['dir'],
  ): Prisma.AssetOrderByWithRelationInput {
    switch (sort) {
      case 'label':
        return { label: dir };
      case 'type':
        return { type: dir };
      case 'value':
        return { currentValueMinor: dir };
      case 'maturity':
        return { maturityDate: dir };
      default:
        return { updatedAt: dir };
    }
  }

  private present(a: AssetRow) {
    return {
      id: a.id,
      type: a.type,
      label: a.label,
      institution: a.institution,
      currency: a.currency,
      value: minorToMajor(a.currentValueMinor),
      units: a.unitsHeld != null ? a.unitsHeld.toNumber() : null,
      identifierMasked: a.identifierMasked,
      status: a.status,
      maturityDate: a.maturityDate ? a.maturityDate.toISOString() : null,
      details:
        (a.details as Record<string, string | number | boolean> | null) ?? null,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Major-unit number → minor-unit BigInt (paise), or null when absent. */
function toMinor(value: number | undefined): bigint | null {
  if (value === undefined || value === null) return null;
  return BigInt(Math.round(value * 100));
}

/** Minor-unit BigInt → major-unit number (rupees). */
function minorToMajor(minor: bigint | null): number {
  if (minor === null) return 0;
  return Number(minor) / 100;
}

/** "1234567890" → "XXXX7890". Empty/short inputs return null. */
function maskIdentifier(identifier?: string | null): string | null {
  if (!identifier) return null;
  const trimmed = identifier.trim();
  if (trimmed.length <= 4) return trimmed;
  return `XXXX${trimmed.slice(-4)}`;
}

/** 'yyyy-mm-dd' → Date (UTC midnight), or null. */
function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
