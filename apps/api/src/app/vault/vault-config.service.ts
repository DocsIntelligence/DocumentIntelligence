import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  VAULT_DOC_KINDS,
  VAULT_ENTITY_KINDS,
  VAULT_FIELDS,
  VAULT_KIND_FIELDS,
  fieldDefs as codeFieldDefs,
  type VaultDocKind,
  type VaultFieldDef,
} from './vault.fields';

/**
 * Admin-configurable vault catalog (docs/10). Three tables, all seeded from
 * code constants on first use and resolved org-row → system-row → code
 * default:
 *
 *   - VaultEntityKindConfig — kinds (person/lawyer/…).
 *   - VaultFieldConfig      — global field pool.
 *   - VaultEntityKindField  — many-to-many join (which fields each kind uses).
 *
 * `fieldDefs(orgId, kind)` joins through the link table so a single
 * canonical field row (e.g. `pan`) feeds Person + Company + Lawyer +
 * Other without duplication.
 */
@Injectable()
export class VaultConfigService {
  private readonly logger = new Logger(VaultConfigService.name);
  private seeded = false;

  constructor(private readonly db: DatabaseService) {}

  /**
   * Seed system rows (ownerOrgId=null) from code constants. Per-row, so a
   * new kind/field added in code lands automatically on next boot without
   * a fresh DB.
   */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;

    // ── 1. Entity kinds ────────────────────────────────────────────────
    for (const k of VAULT_ENTITY_KINDS) {
      const existing = await this.db.vaultEntityKindConfig.findFirst({
        where: { ownerOrgId: null, key: k.key },
      });
      if (existing) continue;
      await this.db.vaultEntityKindConfig.create({
        data: {
          ownerOrgId: null,
          key: k.key,
          label: k.label,
          badgeVariant: k.badgeVariant,
          sortOrder: k.sortOrder,
          isSystem: true,
          isActive: true,
        },
      });
      this.logger.log(`Vault: seeded entity kind "${k.key}".`);
    }

    // ── 2. Global field pool ───────────────────────────────────────────
    for (const f of VAULT_FIELDS) {
      const existing = await this.db.vaultFieldConfig.findFirst({
        where: { ownerOrgId: null, key: f.key },
      });
      if (existing) continue;
      await this.db.vaultFieldConfig.create({
        data: {
          ownerOrgId: null,
          key: f.key,
          label: f.label,
          type: f.type ?? 'text',
          group: f.group ?? null,
          options: f.options ?? [],
          lookupKey: f.lookupKey ?? null,
          sensitive: f.sensitive ?? false,
          revealLast: f.revealLast ?? null,
          placeholder: f.placeholder ?? null,
          isActive: true,
        },
      });
    }

    // ── 3. Kind → field links ──────────────────────────────────────────
    for (const [kindKey, links] of Object.entries(VAULT_KIND_FIELDS)) {
      const kind = await this.db.vaultEntityKindConfig.findFirst({
        where: { ownerOrgId: null, key: kindKey },
      });
      if (!kind) continue;
      const have = await this.db.vaultEntityKindField.count({
        where: { entityKindId: kind.id },
      });
      if (have > 0) continue;
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const field = await this.db.vaultFieldConfig.findFirst({
          where: { ownerOrgId: null, key: link.key },
        });
        if (!field) continue;
        await this.db.vaultEntityKindField.create({
          data: {
            entityKindId: kind.id,
            fieldId: field.id,
            sortOrder: i,
            groupOverride: link.group ?? null,
            isActive: true,
          },
        });
      }
      this.logger.log(`Vault: seeded ${links.length} field link(s) for kind "${kindKey}".`);
    }

    // ── 4. Document kinds (unchanged shape) ────────────────────────────
    for (const d of VAULT_DOC_KINDS) {
      const existing = await this.db.vaultDocKindConfig.findFirst({
        where: { ownerOrgId: null, kind: d.kind },
      });
      if (existing) continue;
      await this.db.vaultDocKindConfig.create({
        data: {
          ownerOrgId: null,
          kind: d.kind,
          label: d.label,
          fills: d.fills,
          scannable: d.fills.length > 0,
          sortOrder: VAULT_DOC_KINDS.indexOf(d),
        },
      });
    }

    this.seeded = true;
  }

  // ── Resolved field defs (used by VaultService) ────────────────────────

  /**
   * Return the ordered field defs for an entity kind, joining through
   * VaultEntityKindField. Falls back to the code constants if the DB
   * has no entry for this kind — covers brand-new kinds before seeding.
   */
  async fieldDefs(orgId: string | null, kind: string): Promise<VaultFieldDef[]> {
    await this.ensureSeeded();
    const kindRow = await this.findKind(orgId, kind);
    if (!kindRow) return codeFieldDefs(kind);
    const links = await this.db.vaultEntityKindField.findMany({
      where: { entityKindId: kindRow.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { field: true },
    });
    if (links.length === 0) return codeFieldDefs(kind);
    return links
      .filter((l) => l.field.isActive)
      .map((l) => ({
        key: l.field.key,
        label: l.field.label,
        type: l.field.type as VaultFieldDef['type'],
        group: l.groupOverride ?? l.field.group ?? undefined,
        options: l.field.options,
        lookupKey: l.field.lookupKey ?? undefined,
        sensitive: l.field.sensitive,
        revealLast: l.field.revealLast ?? undefined,
        placeholder: l.field.placeholder ?? undefined,
      }));
  }

  async docKinds(orgId: string | null): Promise<VaultDocKind[]> {
    await this.ensureSeeded();
    let rows = await this.db.vaultDocKindConfig.findMany({
      where: { ownerOrgId: orgId ?? null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (rows.length === 0 && orgId) {
      rows = await this.db.vaultDocKindConfig.findMany({
        where: { ownerOrgId: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }
    if (rows.length === 0) return VAULT_DOC_KINDS;
    return rows.map((r) => ({ kind: r.kind, label: r.label, fills: r.fills }));
  }

  async docKind(orgId: string | null, kind: string): Promise<VaultDocKind | undefined> {
    return (await this.docKinds(orgId)).find((d) => d.kind === kind);
  }

  /** All active entity kinds visible to this org. */
  async listEntityKindsActive(orgId: string | null) {
    await this.ensureSeeded();
    const org = orgId
      ? await this.db.vaultEntityKindConfig.findMany({
          where: { ownerOrgId: orgId, isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    if (org.length > 0) return org;
    return this.db.vaultEntityKindConfig.findMany({
      where: { ownerOrgId: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Admin CRUD: entity kinds ──────────────────────────────────────────

  async listEntityKinds(orgId: string | null) {
    await this.ensureSeeded();
    return this.db.vaultEntityKindConfig.findMany({
      where: { ownerOrgId: orgId ?? null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertEntityKind(orgId: string | null, dto: VaultEntityKindInput) {
    if (dto.id) {
      const current = await this.db.vaultEntityKindConfig.findUnique({
        where: { id: dto.id },
      });
      if (!current) throw new NotFoundException('Entity kind not found');
      return this.db.vaultEntityKindConfig.update({
        where: { id: dto.id },
        data: {
          // Don't allow renaming the `key` of a system kind — its fields,
          // documents, and autofill maps all reference the key.
          key: current.isSystem ? current.key : dto.key,
          label: dto.label,
          badgeVariant: dto.badgeVariant ?? current.badgeVariant,
          sortOrder: dto.sortOrder ?? current.sortOrder,
          isActive: dto.isActive ?? current.isActive,
        },
      });
    }
    return this.db.vaultEntityKindConfig.create({
      data: {
        ownerOrgId: orgId ?? null,
        key: dto.key,
        label: dto.label,
        badgeVariant: dto.badgeVariant ?? 'secondary',
        sortOrder: dto.sortOrder ?? 0,
        isSystem: false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async deleteEntityKind(id: string) {
    const row = await this.db.vaultEntityKindConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Entity kind not found');
    if (row.isSystem) {
      throw new NotFoundException(
        'System kinds cannot be deleted — disable them instead.',
      );
    }
    return this.db.vaultEntityKindConfig.delete({ where: { id } });
  }

  /** List the field links for one entity kind. */
  async listEntityKindFields(entityKindId: string) {
    return this.db.vaultEntityKindField.findMany({
      where: { entityKindId },
      orderBy: { sortOrder: 'asc' },
      include: { field: true },
    });
  }

  /**
   * Replace the field-link set for one entity kind in a single transaction.
   * Body is the new desired set, in display order; rows missing from the
   * body get removed, rows present-but-changed get updated, new rows get
   * created. Idempotent.
   */
  async setEntityKindFields(
    entityKindId: string,
    links: VaultEntityKindFieldLink[],
  ) {
    const kind = await this.db.vaultEntityKindConfig.findUnique({
      where: { id: entityKindId },
    });
    if (!kind) throw new NotFoundException('Entity kind not found');

    return this.db.$transaction(async (tx) => {
      const existing = await tx.vaultEntityKindField.findMany({
        where: { entityKindId },
      });
      const desiredByField = new Map(
        links.map((l, i) => [l.fieldId, { ...l, sortOrder: i }] as const),
      );
      const existingByField = new Map(existing.map((e) => [e.fieldId, e]));

      // Delete rows no longer in the desired set.
      for (const e of existing) {
        if (!desiredByField.has(e.fieldId)) {
          await tx.vaultEntityKindField.delete({ where: { id: e.id } });
        }
      }
      // Upsert each desired link.
      for (const [fieldId, l] of desiredByField) {
        const cur = existingByField.get(fieldId);
        if (cur) {
          await tx.vaultEntityKindField.update({
            where: { id: cur.id },
            data: {
              sortOrder: l.sortOrder,
              groupOverride: l.groupOverride ?? null,
              isActive: l.isActive ?? true,
            },
          });
        } else {
          await tx.vaultEntityKindField.create({
            data: {
              entityKindId,
              fieldId,
              sortOrder: l.sortOrder,
              groupOverride: l.groupOverride ?? null,
              isActive: l.isActive ?? true,
            },
          });
        }
      }
      return tx.vaultEntityKindField.findMany({
        where: { entityKindId },
        orderBy: { sortOrder: 'asc' },
        include: { field: true },
      });
    });
  }

  // ── Admin CRUD: fields ────────────────────────────────────────────────

  async listFields(orgId: string | null) {
    await this.ensureSeeded();
    return this.db.vaultFieldConfig.findMany({
      where: { ownerOrgId: orgId ?? null },
      orderBy: { key: 'asc' },
    });
  }

  async upsertField(orgId: string | null, dto: VaultFieldConfigInput) {
    if (dto.id) {
      return this.db.vaultFieldConfig.update({
        where: { id: dto.id },
        data: stripId(dto),
      });
    }
    return this.db.vaultFieldConfig.create({
      data: { ownerOrgId: orgId ?? null, ...stripId(dto) },
    });
  }

  async deleteField(id: string) {
    return this.db.vaultFieldConfig.delete({ where: { id } });
  }

  // ── Admin CRUD: doc kinds (unchanged shape) ───────────────────────────

  async listDocKinds(orgId: string | null) {
    await this.ensureSeeded();
    return this.db.vaultDocKindConfig.findMany({
      where: { ownerOrgId: orgId ?? null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertDocKind(orgId: string | null, dto: VaultDocKindConfigInput) {
    if (dto.id) {
      return this.db.vaultDocKindConfig.update({
        where: { id: dto.id },
        data: stripId(dto),
      });
    }
    return this.db.vaultDocKindConfig.create({
      data: { ownerOrgId: orgId ?? null, ...stripId(dto) },
    });
  }

  async deleteDocKind(id: string) {
    return this.db.vaultDocKindConfig.delete({ where: { id } });
  }

  // ── Internals ─────────────────────────────────────────────────────────

  /** Org override → system fallback for an entity-kind row. */
  private async findKind(orgId: string | null, key: string) {
    if (orgId) {
      const own = await this.db.vaultEntityKindConfig.findFirst({
        where: { ownerOrgId: orgId, key, isActive: true },
      });
      if (own) return own;
    }
    return this.db.vaultEntityKindConfig.findFirst({
      where: { ownerOrgId: null, key, isActive: true },
    });
  }
}

export interface VaultEntityKindInput {
  id?: string;
  key: string;
  label: string;
  badgeVariant?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface VaultEntityKindFieldLink {
  fieldId: string;
  groupOverride?: string | null;
  isActive?: boolean;
}

export interface VaultFieldConfigInput {
  id?: string;
  key: string;
  label: string;
  type?: string;
  group?: string | null;
  options?: string[];
  lookupKey?: string | null;
  sensitive?: boolean;
  revealLast?: number | null;
  placeholder?: string | null;
  isActive?: boolean;
}

export interface VaultDocKindConfigInput {
  id?: string;
  kind: string;
  label: string;
  fills?: string[];
  scannable?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

function stripId<T extends { id?: string }>(dto: T): Omit<T, 'id'> {
  const { id: _omit, ...rest } = dto;
  void _omit;
  return rest;
}
