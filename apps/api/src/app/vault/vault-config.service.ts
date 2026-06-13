import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  fieldDefs as codeFieldDefs,
  VAULT_DOC_KINDS,
  type VaultDocKind,
  type VaultFieldDef,
} from './vault.fields';

const ENTITY_KINDS = ['person', 'company', 'other'] as const;

/**
 * Admin-configurable vault catalog (docs/10). The field catalog + document
 * kinds live in DB (`VaultFieldConfig` / `VaultDocKindConfig`), seeded from the
 * code constants on first use and resolved org-row → system-row → code default.
 * So admins can add/edit/reorder fields and doc kinds without a deploy.
 */
@Injectable()
export class VaultConfigService {
  private readonly logger = new Logger(VaultConfigService.name);
  private seeded = false;

  constructor(private readonly db: DatabaseService) {}

  /** Seed the system (org-null) catalog from code constants once, if empty. */
  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    const count = await this.db.vaultFieldConfig.count({ where: { ownerOrgId: null } });
    if (count === 0) {
      for (const kind of ENTITY_KINDS) {
        const defs = codeFieldDefs(kind);
        await this.db.vaultFieldConfig.createMany({
          data: defs.map((f, i) => ({
            ownerOrgId: null,
            entityKind: kind,
            key: f.key,
            label: f.label,
            type: f.type ?? 'text',
            group: f.group ?? null,
            options: f.options ?? [],
            sensitive: f.sensitive ?? false,
            revealLast: f.revealLast ?? null,
            placeholder: f.placeholder ?? null,
            sortOrder: i,
          })),
        });
      }
    }
    const dkCount = await this.db.vaultDocKindConfig.count({ where: { ownerOrgId: null } });
    if (dkCount === 0) {
      await this.db.vaultDocKindConfig.createMany({
        data: VAULT_DOC_KINDS.map((d, i) => ({
          ownerOrgId: null,
          kind: d.kind,
          label: d.label,
          fills: d.fills,
          scannable: d.fills.length > 0,
          sortOrder: i,
        })),
      });
    }
    this.seeded = true;
    this.logger.log('Vault catalog seeded (system defaults).');
  }

  // ── Resolved catalog (used by VaultService) ───────────────────────────────

  async fieldDefs(orgId: string | null, kind: string): Promise<VaultFieldDef[]> {
    await this.ensureSeeded();
    const rows = await this.resolveFieldRows(orgId, kind);
    if (rows.length === 0) return codeFieldDefs(kind); // ultimate fallback
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      type: r.type as VaultFieldDef['type'],
      group: r.group ?? undefined,
      options: r.options,
      lookupKey: r.lookupKey ?? undefined,
      sensitive: r.sensitive,
      revealLast: r.revealLast ?? undefined,
      placeholder: r.placeholder ?? undefined,
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

  private async resolveFieldRows(orgId: string | null, kind: string) {
    if (orgId) {
      const org = await this.db.vaultFieldConfig.findMany({
        where: { ownerOrgId: orgId, entityKind: kind, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      if (org.length > 0) return org;
    }
    return this.db.vaultFieldConfig.findMany({
      where: { ownerOrgId: null, entityKind: kind, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Admin CRUD ─────────────────────────────────────────────────────────────

  async listFields(orgId: string | null) {
    await this.ensureSeeded();
    return this.db.vaultFieldConfig.findMany({
      where: { ownerOrgId: orgId ?? null },
      orderBy: [{ entityKind: 'asc' }, { sortOrder: 'asc' }],
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

  async listDocKinds(orgId: string | null) {
    await this.ensureSeeded();
    return this.db.vaultDocKindConfig.findMany({
      where: { ownerOrgId: orgId ?? null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertDocKind(orgId: string | null, dto: VaultDocKindConfigInput) {
    if (dto.id) {
      return this.db.vaultDocKindConfig.update({ where: { id: dto.id }, data: stripId(dto) });
    }
    return this.db.vaultDocKindConfig.create({
      data: { ownerOrgId: orgId ?? null, ...stripId(dto) },
    });
  }

  async deleteDocKind(id: string) {
    return this.db.vaultDocKindConfig.delete({ where: { id } });
  }
}

export interface VaultFieldConfigInput {
  id?: string;
  entityKind: string;
  key: string;
  label: string;
  type?: string;
  group?: string | null;
  options?: string[];
  lookupKey?: string | null;
  sensitive?: boolean;
  revealLast?: number | null;
  placeholder?: string | null;
  sortOrder?: number;
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
