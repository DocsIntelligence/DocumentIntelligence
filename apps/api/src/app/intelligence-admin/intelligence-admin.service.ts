import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PipelineStageType, Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type {
  SchemaFieldInput,
  UpdateExtractionSchemaDto,
  UpdatePipelineDto,
  UpsertExtractionSchemaDto,
  UpsertFieldMapDto,
  UpsertPipelineDto,
} from './intelligence-admin.dto';

/**
 * Admin authoring of pipeline config-as-data (docs/07 P4.2). Operates on the
 * PLATFORM/system scope (`ownerOrgId = null`) — the defaults every run resolves
 * against. Per-org clone-on-write is the next step; the same methods take an
 * `ownerOrgId` then.
 *
 * Versioning is IMMUTABLE (docs §7): an edit MINTS A NEW VERSION rather than
 * mutating the current row, so in-flight runs keep their pinned config and a
 * `SchemaResolverService` always resolves the highest active version.
 */
@Injectable()
export class IntelligenceAdminService {
  constructor(private readonly db: DatabaseService) {}

  // ─── Extraction schemas ─────────────────────────────────────────────────────

  /**
   * Latest version of every authored schema (one row per key). Active-only by
   * default; `includeInactive` also returns soft-disabled ones (so the admin UI
   * can show + reactivate them) — each row carries its `isActive` flag.
   */
  async listSchemas(includeInactive = false) {
    const rows = await this.db.extractionSchemaDef.findMany({
      where: { ownerOrgId: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      include: { _count: { select: { fields: true } } },
    });
    return this.latestByKey(rows, (r) => r.key).map((r) => ({
      key: r.key,
      name: r.name,
      version: r.version,
      documentTypeKey: r.documentTypeKey,
      description: r.description,
      jurisdiction: r.jurisdiction,
      fieldCount: r._count.fields,
      isActive: r.isActive,
      updatedAt: r.updatedAt,
    }));
  }

  /** Latest active version of one schema, with its fields. */
  async getSchema(key: string) {
    const row = await this.db.extractionSchemaDef.findFirst({
      where: { ownerOrgId: null, key, isActive: true },
      orderBy: { version: 'desc' },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    if (!row) throw new NotFoundException(`Schema "${key}" not found`);
    return {
      key: row.key,
      name: row.name,
      version: row.version,
      documentTypeKey: row.documentTypeKey,
      description: row.description,
      jurisdiction: row.jurisdiction,
      fields: row.fields.map((f) => this.toFieldDto(f)),
    };
  }

  async createSchema(dto: UpsertExtractionSchemaDto) {
    const exists = await this.db.extractionSchemaDef.findFirst({
      where: { ownerOrgId: null, key: dto.key },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        `Schema "${dto.key}" already exists — use update (mints a new version).`,
      );
    }
    return this.writeSchemaVersion(dto.key, 1, dto);
  }

  /** Mint a new version of an existing schema. */
  async updateSchema(key: string, dto: UpdateExtractionSchemaDto) {
    const next = await this.nextVersion('extractionSchemaDef', { key });
    if (next === 1) throw new NotFoundException(`Schema "${key}" not found`);
    return this.writeSchemaVersion(key, next, { key, ...dto });
  }

  /** Soft-delete: deactivate all versions; new runs fall back to code/generic. */
  async deleteSchema(key: string) {
    const res = await this.db.extractionSchemaDef.updateMany({
      where: { ownerOrgId: null, key },
      data: { isActive: false },
    });
    if (res.count === 0) throw new NotFoundException(`Schema "${key}" not found`);
    return { key, deactivated: res.count };
  }

  /** Re-enable a soft-disabled schema (all versions). */
  async activateSchema(key: string) {
    const res = await this.db.extractionSchemaDef.updateMany({
      where: { ownerOrgId: null, key },
      data: { isActive: true },
    });
    if (res.count === 0) throw new NotFoundException(`Schema "${key}" not found`);
    return { key, activated: res.count };
  }

  /** Toggle helper: activate or deactivate by flag. */
  async setSchemaActive(key: string, active: boolean) {
    return active ? this.activateSchema(key) : this.deleteSchema(key);
  }

  /**
   * Hard-delete a schema (ALL versions) — distinct from soft-disable. FK-safe:
   * extractions reference `schemaKey` by string (not a relation) and fields
   * cascade. Use when you want it gone for good; prefer disable to keep history.
   */
  async purgeSchema(key: string) {
    const res = await this.db.extractionSchemaDef.deleteMany({
      where: { ownerOrgId: null, key },
    });
    if (res.count === 0) throw new NotFoundException(`Schema "${key}" not found`);
    return { key, deleted: res.count };
  }

  private async writeSchemaVersion(
    key: string,
    version: number,
    dto: UpsertExtractionSchemaDto,
  ) {
    const created = await this.db.extractionSchemaDef.create({
      data: {
        ownerOrgId: null,
        key,
        version,
        name: dto.name,
        documentTypeKey: dto.documentTypeKey ?? null,
        description: dto.description ?? null,
        jurisdiction: dto.jurisdiction ?? null,
        fields: {
          create: dto.fields.map((f, i) => this.toFieldRow(f, i)),
        },
      },
      include: { fields: { orderBy: { order: 'asc' } } },
    });
    return {
      key: created.key,
      version: created.version,
      fields: created.fields.map((f) => this.toFieldDto(f)),
    };
  }

  // ─── Field-maps ───────────────────────────────────────────────────────────

  async getFieldMap(schemaKey: string) {
    const row = await this.db.fieldMapDef.findFirst({
      where: { ownerOrgId: null, schemaKey },
      orderBy: { version: 'desc' },
      include: { entries: true },
    });
    if (!row) throw new NotFoundException(`Field-map for "${schemaKey}" not found`);
    return {
      schemaKey: row.schemaKey,
      documentTypeKey: row.documentTypeKey,
      version: row.version,
      mapping: Object.fromEntries(
        row.entries.map((e) => [e.extractionKey, e.bundlePath]),
      ),
    };
  }

  /** Create or mint a new version of a field-map. */
  async upsertFieldMap(schemaKey: string, dto: UpsertFieldMapDto) {
    const version = await this.nextVersion('fieldMapDef', { schemaKey });
    const created = await this.db.fieldMapDef.create({
      data: {
        ownerOrgId: null,
        schemaKey,
        documentTypeKey: dto.documentTypeKey,
        version,
        entries: {
          create: Object.entries(dto.mapping).map(
            ([extractionKey, bundlePath]) => ({ extractionKey, bundlePath }),
          ),
        },
      },
      include: { entries: true },
    });
    return { schemaKey, version: created.version, entries: created.entries.length };
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────────

  async listPipelines(includeInactive = false) {
    const rows = await this.db.pipeline.findMany({
      where: { ownerOrgId: null, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      include: { _count: { select: { stages: true } } },
    });
    return this.latestByKey(rows, (r) => r.key).map((r) => ({
      key: r.key,
      name: r.name,
      version: r.version,
      stageCount: r._count.stages,
      isActive: r.active,
      updatedAt: r.updatedAt,
    }));
  }

  async getPipeline(key: string) {
    const row = await this.db.pipeline.findFirst({
      where: { ownerOrgId: null, key, active: true },
      orderBy: { version: 'desc' },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!row) throw new NotFoundException(`Pipeline "${key}" not found`);
    return {
      key: row.key,
      name: row.name,
      version: row.version,
      stages: row.stages.map((s) => ({
        type: s.type,
        name: s.name,
        config: s.config,
      })),
    };
  }

  async createPipeline(dto: UpsertPipelineDto) {
    const exists = await this.db.pipeline.findFirst({
      where: { ownerOrgId: null, key: dto.key },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        `Pipeline "${dto.key}" already exists — use update (mints a new version).`,
      );
    }
    return this.writePipelineVersion(dto.key, 1, dto);
  }

  async updatePipeline(key: string, dto: UpdatePipelineDto) {
    const next = await this.nextVersion('pipeline', { key });
    if (next === 1) throw new NotFoundException(`Pipeline "${key}" not found`);
    return this.writePipelineVersion(key, next, { key, ...dto });
  }

  async deletePipeline(key: string) {
    const res = await this.db.pipeline.updateMany({
      where: { ownerOrgId: null, key },
      data: { active: false },
    });
    if (res.count === 0)
      throw new NotFoundException(`Pipeline "${key}" not found`);
    return { key, deactivated: res.count };
  }

  /** Re-enable a soft-disabled pipeline (all versions). */
  async activatePipeline(key: string) {
    const res = await this.db.pipeline.updateMany({
      where: { ownerOrgId: null, key },
      data: { active: true },
    });
    if (res.count === 0)
      throw new NotFoundException(`Pipeline "${key}" not found`);
    return { key, activated: res.count };
  }

  async setPipelineActive(key: string, active: boolean) {
    return active ? this.activatePipeline(key) : this.deletePipeline(key);
  }

  /**
   * Hard-delete a pipeline (ALL versions). Refused when any run references a
   * version (PipelineRun.pipelineId is Restrict) — disable it instead so the
   * run history stays intact.
   */
  async purgePipeline(key: string) {
    const versions = await this.db.pipeline.findMany({
      where: { ownerOrgId: null, key },
      select: { id: true },
    });
    if (versions.length === 0)
      throw new NotFoundException(`Pipeline "${key}" not found`);
    const runCount = await this.db.pipelineRun.count({
      where: { pipelineId: { in: versions.map((v) => v.id) } },
    });
    if (runCount > 0) {
      throw new ConflictException(
        `Pipeline "${key}" has ${runCount} run(s) — disable it instead of deleting.`,
      );
    }
    const res = await this.db.pipeline.deleteMany({
      where: { ownerOrgId: null, key },
    });
    return { key, deleted: res.count };
  }

  private async writePipelineVersion(
    key: string,
    version: number,
    dto: UpsertPipelineDto,
  ) {
    const created = await this.db.pipeline.create({
      data: {
        ownerOrgId: null,
        key,
        name: dto.name,
        version,
        stages: {
          create: dto.stages.map((s, i) => ({
            order: i + 1,
            type: s.type as PipelineStageType,
            name: s.name,
            config: (s.config ?? {}) as Prisma.InputJsonValue,
          })),
        },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    return { key: created.key, version: created.version, stages: created.stages.length };
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Next monotonic version for a `(ownerOrgId=null, …filter)` row group. */
  private async nextVersion(
    model: 'extractionSchemaDef' | 'fieldMapDef' | 'pipeline',
    filter: Record<string, string>,
  ): Promise<number> {
    const where = { ownerOrgId: null, ...filter };
    // Each delegate shares the `findFirst({ orderBy: version desc })` shape.
    const row =
      model === 'extractionSchemaDef'
        ? await this.db.extractionSchemaDef.findFirst({
            where,
            orderBy: { version: 'desc' },
            select: { version: true },
          })
        : model === 'fieldMapDef'
          ? await this.db.fieldMapDef.findFirst({
              where,
              orderBy: { version: 'desc' },
              select: { version: true },
            })
          : await this.db.pipeline.findFirst({
              where,
              orderBy: { version: 'desc' },
              select: { version: true },
            });
    return (row?.version ?? 0) + 1;
  }

  private latestByKey<T extends { version: number }>(
    rows: T[],
    keyOf: (r: T) => string,
  ): T[] {
    const seen = new Map<string, T>();
    for (const r of rows) {
      const k = keyOf(r);
      const cur = seen.get(k);
      if (!cur || r.version > cur.version) seen.set(k, r);
    }
    return [...seen.values()];
  }

  private toFieldRow(f: SchemaFieldInput, order: number) {
    const config =
      f.enumValues?.length || f.columns?.length
        ? ({ enumValues: f.enumValues, columns: f.columns } as Prisma.InputJsonValue)
        : undefined;
    return {
      key: f.key,
      label: f.label,
      type: f.type,
      required: Boolean(f.required),
      reviewMandatory: Boolean(f.reviewMandatory),
      isActive: f.isActive ?? true,
      fieldThreshold: f.fieldThreshold ?? null,
      description: f.description ?? null,
      example: f.example ?? null,
      format: f.format ?? null,
      config,
      order,
    };
  }

  private toFieldDto(f: {
    key: string;
    label: string;
    type: string;
    required: boolean;
    reviewMandatory: boolean;
    isActive: boolean;
    fieldThreshold: number | null;
    description: string | null;
    example: string | null;
    format: string | null;
    config: unknown;
  }) {
    const cfg = (f.config ?? {}) as {
      enumValues?: string[];
      columns?: unknown[];
    };
    return {
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      reviewMandatory: f.reviewMandatory,
      isActive: f.isActive,
      fieldThreshold: f.fieldThreshold,
      description: f.description,
      example: f.example,
      format: f.format,
      enumValues: cfg.enumValues,
      columns: cfg.columns,
    };
  }
}
