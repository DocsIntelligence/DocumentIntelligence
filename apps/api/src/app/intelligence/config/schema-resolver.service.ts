import { Injectable } from '@nestjs/common';
import {
  genericExtractionSchema,
  getExtractionSchema,
  getFieldMap,
  listExtractionSchemaKeys,
  type ExtractionField,
  type ExtractionFieldType,
  type ExtractionSchema,
  type FieldMap,
} from '@org/doc-intelligence';
import { DatabaseService } from '../../database/database.service';

const GENERIC_KEY = genericExtractionSchema.key;

const FIELD_TYPES: ReadonlySet<string> = new Set<ExtractionFieldType>([
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
]);

/** jsonb shape of `SchemaField.config` (anything beyond scalar metadata). */
interface FieldConfigJson {
  enumValues?: string[];
  columns?: ExtractionField[];
}

/**
 * Resolves the EFFECTIVE ExtractionSchema / FieldMap / classifier candidates for
 * a given org, with DB-over-code precedence (docs/07 §7, P4.2):
 *
 *   org-scoped DB row (latest active version)
 *     → system-template DB row (`ownerOrgId = null`)
 *       → in-code `@org/doc-intelligence` registry
 *         → `genericExtractionSchema`
 *
 * DB rows are mapped back into the existing TS shapes so the engines, prompt
 * builders, and `decideReview` are untouched — this service is the only seam
 * that knows config can come from the database. Keeping the code registry as a
 * fallback means nothing breaks when the DB has no rows yet.
 */
@Injectable()
export class SchemaResolverService {
  constructor(private readonly db: DatabaseService) {}

  /** The effective extraction schema for `(orgId, key)`. Never returns null. */
  async resolveSchema(
    orgId: string | null,
    key: string,
  ): Promise<ExtractionSchema> {
    const def = await this.findSchemaDef(orgId, key);
    if (def) {
      return {
        key: def.key,
        name: def.name,
        version: String(def.version),
        documentTypeKey: def.documentTypeKey ?? undefined,
        description: def.description ?? undefined,
        jurisdiction: def.jurisdiction ?? undefined,
        fields: def.fields.map((f) => this.mapField(f)),
      };
    }
    return getExtractionSchema(key) ?? genericExtractionSchema;
  }

  /** The effective field-map for `(orgId, schemaKey)`, if any (convert bridge). */
  async resolveFieldMap(
    orgId: string | null,
    schemaKey: string,
  ): Promise<FieldMap | undefined> {
    const def = await this.findFieldMapDef(orgId, schemaKey);
    if (def) {
      return {
        schemaKey: def.schemaKey,
        documentTypeKey: def.documentTypeKey,
        version: String(def.version),
        mapping: Object.fromEntries(
          def.entries.map((e) => [e.extractionKey, e.bundlePath]),
        ),
      };
    }
    return getFieldMap(schemaKey);
  }

  /**
   * Classifier candidate keys for an org (docs/07 §11.2). DECOUPLED from
   * `documentTypeKey`: any registered/authored extraction schema is a candidate,
   * not only those backed by a drafting bundle. `override` (a stage's
   * `config.candidateKeys`) narrows the set — the per-pipeline allowlist.
   */
  async candidateKeys(
    orgId: string | null,
    override?: string[],
  ): Promise<string[]> {
    if (override?.length) return override;

    const defs = await this.db.extractionSchemaDef.findMany({
      where: {
        isActive: true,
        ...(orgId
          ? { OR: [{ ownerOrgId: orgId }, { ownerOrgId: null }] }
          : { ownerOrgId: null }),
      },
      select: { key: true },
    });

    const keys = new Set<string>(defs.map((d) => d.key));
    for (const k of listExtractionSchemaKeys()) keys.add(k);
    keys.delete(GENERIC_KEY); // the fallback, never a classification target
    return [...keys];
  }

  /**
   * Active extraction schemas an org may pick from (the manual type-override
   * picker's source of truth — config-driven, never a hardcoded list). Mirrors
   * `candidateKeys` precedence (org-scoped over system, latest version) but
   * returns display names + the drafting type. Excludes the generic fallback.
   */
  async listSchemas(
    orgId: string | null,
  ): Promise<{ key: string; name: string; documentTypeKey?: string }[]> {
    const defs = await this.db.extractionSchemaDef.findMany({
      where: {
        isActive: true,
        ...(orgId
          ? { OR: [{ ownerOrgId: orgId }, { ownerOrgId: null }] }
          : { ownerOrgId: null }),
      },
      orderBy: { version: 'desc' },
      select: { key: true, name: true, documentTypeKey: true, ownerOrgId: true },
    });
    // Org-owned shadows system; within a key the latest version wins (desc).
    defs.sort((a, b) => (a.ownerOrgId ? 0 : 1) - (b.ownerOrgId ? 0 : 1));

    const byKey = new Map<
      string,
      { key: string; name: string; documentTypeKey?: string }
    >();
    for (const d of defs) {
      if (byKey.has(d.key)) continue;
      byKey.set(d.key, {
        key: d.key,
        name: d.name,
        documentTypeKey: d.documentTypeKey ?? undefined,
      });
    }
    // Code-registry schemas the DB hasn't overridden.
    for (const k of listExtractionSchemaKeys()) {
      if (byKey.has(k)) continue;
      const s = getExtractionSchema(k);
      if (s) byKey.set(k, { key: s.key, name: s.name, documentTypeKey: s.documentTypeKey });
    }
    byKey.delete(GENERIC_KEY); // fallback only — not a pickable target
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async findSchemaDef(orgId: string | null, key: string) {
    if (orgId) {
      const org = await this.db.extractionSchemaDef.findFirst({
        where: { ownerOrgId: orgId, key, isActive: true },
        orderBy: { version: 'desc' },
        include: {
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
      });
      if (org) return org;
    }
    return this.db.extractionSchemaDef.findFirst({
      where: { ownerOrgId: null, key, isActive: true },
      orderBy: { version: 'desc' },
      include: {
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  private async findFieldMapDef(orgId: string | null, schemaKey: string) {
    if (orgId) {
      const org = await this.db.fieldMapDef.findFirst({
        where: { ownerOrgId: orgId, schemaKey },
        orderBy: { version: 'desc' },
        include: { entries: true },
      });
      if (org) return org;
    }
    return this.db.fieldMapDef.findFirst({
      where: { ownerOrgId: null, schemaKey },
      orderBy: { version: 'desc' },
      include: { entries: true },
    });
  }

  private mapField(f: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    reviewMandatory: boolean;
    fieldThreshold: number | null;
    description: string | null;
    example: string | null;
    format: string | null;
    config: unknown;
  }): ExtractionField {
    const cfg = (f.config ?? {}) as FieldConfigJson;
    const type: ExtractionFieldType = FIELD_TYPES.has(f.type)
      ? (f.type as ExtractionFieldType)
      : 'string';
    return {
      key: f.key,
      label: f.label,
      type,
      ...(f.required ? { required: true } : {}),
      ...(f.reviewMandatory ? { reviewMandatory: true } : {}),
      ...(f.fieldThreshold != null ? { fieldThreshold: f.fieldThreshold } : {}),
      ...(f.description ? { description: f.description } : {}),
      ...(f.example ? { example: f.example } : {}),
      ...(f.format ? { format: f.format } : {}),
      ...(cfg.enumValues?.length ? { enumValues: cfg.enumValues } : {}),
      ...(cfg.columns?.length ? { columns: cfg.columns } : {}),
    };
  }
}
