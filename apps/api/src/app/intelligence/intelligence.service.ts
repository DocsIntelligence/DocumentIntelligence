import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ExtractionEngineMode, Feature, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import {
  applyFieldMap,
  decideReview,
  genericExtractionSchema,
  getExtractionSchema,
  getFieldMap,
  type ConfidenceMap,
  type ExtractionResult,
  type ExtractionSchema,
  type FieldEdit,
  type FieldValues,
} from '@org/doc-intelligence';
import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { errorMessage } from '../common/error.util';
import { INTEL_QUEUE } from './intelligence.processor';
import {
  PipelineService,
  type IntelligenceJobPayload,
} from './pipeline.service';
import type {
  PresignUploadDto,
  RegisterSourceDto,
  SaveReviewDto,
} from './intelligence.dto';

export const INTEL_QUEUE_ENABLED = 'INTEL_QUEUE_ENABLED';

const STORAGE_FOLDER = 'intelligence';

/**
 * Document-Intelligence orchestration: create a SourceDocument from an upload
 * (multipart, presigned, or pre-registered key), enqueue a processing job
 * (BullMQ when Redis is set, else inline fire-and-forget — same status
 * transitions either way, mirroring exports), and expose status / extraction /
 * review reads. The pipeline itself lives in PipelineService.
 */
@Injectable()
export class IntelligenceService {
  private readonly logger = new Logger(IntelligenceService.name);

  constructor(
    @Optional()
    @InjectQueue(INTEL_QUEUE)
    private readonly queue: Queue | null,
    @Inject(INTEL_QUEUE_ENABLED) private readonly enabled: boolean,
    private readonly pipeline: PipelineService,
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly walletUsage: WalletUsageService,
    private readonly documents: DocumentsService,
  ) {}

  // ─── Ingest ────────────────────────────────────────────────────────────

  /** Multipart upload (works on every backend incl. local-fs dev). */
  async uploadAndStart(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    ownerOrgId?: string,
    engine: ExtractionEngineMode = ExtractionEngineMode.auto,
  ) {
    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: STORAGE_FOLDER,
      userId,
    });
    return this.createSourceAndStart(userId, {
      filename: file.originalname,
      contentType: file.mimetype,
      s3Key: stored.key,
      byteSize: stored.size,
      ownerOrgId,
      engine,
    });
  }

  /** Presigned PUT URL for direct-to-S3 upload (S3 backend only). */
  async presignUpload(userId: string, dto: PresignUploadDto) {
    const ext = dto.filename.split('.').pop() ?? '';
    const key = `${STORAGE_FOLDER}/${userId}/${randomUUID()}.${ext}`;
    return this.storage.getPresignedUploadUrl(key, dto.contentType);
  }

  /** Register a file already uploaded via a presigned URL, then start a job. */
  async registerAndStart(userId: string, dto: RegisterSourceDto) {
    return this.createSourceAndStart(userId, {
      ...dto,
      engine: dto.engine as ExtractionEngineMode,
    });
  }

  private async createSourceAndStart(
    userId: string,
    input: {
      filename: string;
      contentType: string;
      s3Key: string;
      byteSize?: number;
      language?: string;
      ownerOrgId?: string;
      engine?: ExtractionEngineMode;
    },
  ) {
    if (input.ownerOrgId) await this.assertOrgMember(userId, input.ownerOrgId);

    const engine = input.engine ?? ExtractionEngineMode.auto;

    // Gate the paid tier UP FRONT so the user gets immediate feedback rather
    // than a queued job that fails later. Entitlement is the per-user
    // premium_extraction quota (org-owned uploads can't force agentic).
    if (engine === ExtractionEngineMode.agentic) {
      if (input.ownerOrgId) {
        throw new ForbiddenException(
          'Premium extraction must be requested on a personal upload (per-user entitlement).',
        );
      }
      const entitled = await this.walletUsage.checkQuota(
        userId,
        Feature.premium_extraction,
      );
      if (!entitled) {
        throw new ForbiddenException(
          'Premium (agentic) extraction is not included in your plan. Upgrade to use it.',
        );
      }
    }

    const source = await this.db.sourceDocument.create({
      data: {
        ownerUserId: input.ownerOrgId ? null : userId,
        ownerOrgId: input.ownerOrgId ?? null,
        filename: input.filename,
        contentType: input.contentType,
        s3Key: input.s3Key,
        byteSize: input.byteSize ?? null,
        language: input.language ?? null,
        status: 'uploaded',
      },
    });

    const job = await this.db.intelligenceJob.create({
      data: { sourceDocumentId: source.id, status: 'queued', engineMode: engine },
    });

    await this.enqueue({ jobId: job.id });
    return { sourceDocumentId: source.id, jobId: job.id };
  }

  private async enqueue(payload: IntelligenceJobPayload) {
    if (this.enabled && this.queue) {
      await this.queue.add('process', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      });
      this.logger.debug(`Queued intelligence job ${payload.jobId}`);
      return;
    }
    // No Redis — run inline, fire-and-forget. Status transitions identically;
    // the client polls getJob() exactly as in the queued case.
    setImmediate(() => {
      void this.pipeline.run(payload).catch((e) => {
        this.logger.error(
          `Inline job ${payload.jobId} failed: ${errorMessage(e)}`,
        );
      });
    });
    this.logger.debug(`Running intelligence job ${payload.jobId} inline (no Redis)`);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────

  async getJob(userId: string, jobId: string) {
    const job = await this.db.intelligenceJob.findUnique({
      where: { id: jobId },
      include: { sourceDocument: true, extraction: true },
    });
    if (!job) throw new NotFoundException('Job not found');
    await this.assertCanAccess(userId, job.sourceDocument);
    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      documentTypeKey: job.documentTypeKey,
      error: job.error,
      attempts: job.attempts,
      sourceDocumentId: job.sourceDocumentId,
      extractionId: job.extraction?.id ?? null,
      overallConfidence: job.extraction?.overallConfidence ?? null,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    };
  }

  async getExtraction(userId: string, sourceId: string) {
    const source = await this.db.sourceDocument.findUnique({
      where: { id: sourceId },
      include: { extractions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!source) throw new NotFoundException('Source document not found');
    await this.assertCanAccess(userId, source);

    const extraction = source.extractions[0];
    if (!extraction) return { sourceDocumentId: sourceId, extraction: null };

    const schema =
      getExtractionSchema(extraction.schemaKey) ?? genericExtractionSchema;
    const result: ExtractionResult = {
      schemaKey: extraction.schemaKey,
      documentTypeKey: extraction.documentTypeKey ?? undefined,
      fields: (extraction.fields ?? {}) as unknown as FieldValues,
      confidence: (extraction.confidence ?? {}) as unknown as ConfidenceMap,
      overallConfidence: extraction.overallConfidence ?? 0,
    };
    const review = decideReview(schema, result);

    return {
      sourceDocumentId: sourceId,
      extraction: {
        id: extraction.id,
        schemaKey: extraction.schemaKey,
        documentTypeKey: extraction.documentTypeKey,
        fields: result.fields,
        confidence: result.confidence,
        overallConfidence: result.overallConfidence,
        reviewed: extraction.reviewed,
        review,
        schema,
      },
    };
  }

  async saveReview(userId: string, extractionId: string, dto: SaveReviewDto) {
    const extraction = await this.db.extraction.findUnique({
      where: { id: extractionId },
      include: { sourceDocument: true },
    });
    if (!extraction) throw new NotFoundException('Extraction not found');
    await this.assertCanAccess(userId, extraction.sourceDocument);

    const priorEdits = (extraction.edits ?? []) as unknown as FieldEdit[];
    const now = new Date().toISOString();
    const newEdits: FieldEdit[] = dto.edits.map((e) => ({
      fieldPath: e.fieldPath,
      originalValue:
        (extraction.fields as unknown as FieldValues)?.[e.fieldPath] ?? null,
      newValue: e.newValue,
      editedBy: userId,
      at: now,
    }));

    const updated = await this.db.extraction.update({
      where: { id: extractionId },
      data: {
        fields: dto.fields as unknown as Prisma.InputJsonValue,
        edits: [...priorEdits, ...newEdits] as unknown as Prisma.InputJsonValue,
        reviewed: dto.markReviewed,
        reviewedByUserId: dto.markReviewed ? userId : null,
        reviewedAt: dto.markReviewed ? new Date() : null,
      },
    });
    return { id: updated.id, reviewed: updated.reviewed };
  }

  // ─── Convert bridge (Phase 3, docs/05 §11) ─────────────────────────────────

  /**
   * The single sanctioned write-bridge (§10): turn a reviewed extraction into an
   * editable `Document` via the **public create path** (DocumentsService.create
   * — the same one normal drafting uses). Two targets (§11.3):
   *   structured — known DocumentType + field-map → map onto the bundle's shape
   *                and create a structured Document that opens prefilled in the
   *                builder (risks/templates/export reused for free).
   *   freeform   — otherwise → clean HTML from the extracted fields.
   * Never edits Document/DocumentVersion/editor code.
   */
  async convert(userId: string, extractionId: string) {
    const extraction = await this.db.extraction.findUnique({
      where: { id: extractionId },
      include: { sourceDocument: true },
    });
    if (!extraction) throw new NotFoundException('Extraction not found');
    await this.assertCanAccess(userId, extraction.sourceDocument);

    const fields = (extraction.fields ?? {}) as unknown as FieldValues;
    const schema =
      getExtractionSchema(extraction.schemaKey) ?? genericExtractionSchema;
    const title = this.deriveTitle(
      extraction.sourceDocument.filename,
      schema.name,
    );

    const fieldMap = extraction.documentTypeKey
      ? getFieldMap(extraction.schemaKey)
      : undefined;

    // Structured prefill when we know the type AND have a field-map for it.
    if (extraction.documentTypeKey && fieldMap) {
      const templateKey = await this.firstTemplateKey(
        extraction.documentTypeKey,
      );
      if (templateKey) {
        const data = applyFieldMap(this.coerceForBundle(schema, fields), fieldMap);
        const doc = await this.documents.create(userId, {
          title,
          documentTypeKey: extraction.documentTypeKey,
          templateKey,
          data,
        } as Parameters<DocumentsService['create']>[1]);
        this.logger.log(
          `Converted extraction ${extractionId} → structured doc ${doc.id} (${extraction.documentTypeKey})`,
        );
        return { documentId: doc.id, mode: 'structured' as const };
      }
    }

    // Freeform fallback — clean HTML from the extracted fields.
    const html = this.buildFreeformHtml(schema, fields);
    const doc = await this.documents.create(userId, {
      title,
      documentTypeKey: 'freeform',
      templateKey: 'freeform',
      data: { html, values: {}, templateId: 'freeform' },
    } as Parameters<DocumentsService['create']>[1]);
    this.logger.log(
      `Converted extraction ${extractionId} → freeform doc ${doc.id}`,
    );
    return { documentId: doc.id, mode: 'freeform' as const };
  }

  /** First active template key for a document type (the create path validates it). */
  private async firstTemplateKey(
    documentTypeKey: string,
  ): Promise<string | null> {
    const type = await this.db.documentType.findUnique({
      where: { key: documentTypeKey },
      include: {
        templates: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    return type?.templates[0]?.key ?? null;
  }

  /**
   * Coerce extracted values toward the bundle's expected shapes before mapping:
   * single-column `table` fields (e.g. RTI questions, notice facts) arrive as
   * `[{text: '…'}]` but the bundle wants `string[]`.
   */
  private coerceForBundle(
    schema: ExtractionSchema,
    fields: FieldValues,
  ): FieldValues {
    const out: FieldValues = { ...fields };
    for (const field of schema.fields) {
      if (field.type !== 'table' || (field.columns?.length ?? 0) !== 1) continue;
      const value = out[field.key];
      if (!Array.isArray(value)) continue;
      const col = field.columns?.[0]?.key;
      out[field.key] = value.map((row) =>
        row && typeof row === 'object'
          ? ((row as Record<string, unknown>)[col ?? ''] ??
            Object.values(row as Record<string, unknown>)[0])
          : row,
      );
    }
    return out;
  }

  /** Build a clean, editor-friendly HTML body from extracted field values. */
  private buildFreeformHtml(
    schema: ExtractionSchema,
    fields: FieldValues,
  ): string {
    const esc = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const rows: string[] = [];
    for (const field of schema.fields) {
      const value = fields[field.key];
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        const items = value
          .map((v) =>
            v && typeof v === 'object'
              ? esc(Object.values(v as Record<string, unknown>)[0])
              : esc(v),
          )
          .map((v) => `<li>${v}</li>`)
          .join('');
        rows.push(`<p><strong>${esc(field.label)}:</strong></p><ul>${items}</ul>`);
      } else {
        rows.push(
          `<p><strong>${esc(field.label)}:</strong> ${esc(value)}</p>`,
        );
      }
    }
    return `<h1>${esc(schema.name)}</h1>\n${rows.join('\n')}`;
  }

  /** Title from the source filename (sans extension), else the schema name. */
  private deriveTitle(filename: string, schemaName: string): string {
    const base = filename.replace(/\.[^/.]+$/, '').trim();
    return base || schemaName;
  }

  // ─── Authorization ───────────────────────────────────────────────────────

  private async assertCanAccess(
    userId: string,
    source: { ownerUserId: string | null; ownerOrgId: string | null },
  ) {
    if (source.ownerUserId === userId) return;
    if (source.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: source.ownerOrgId, userId } },
      });
      if (m) return;
    }
    throw new ForbiddenException('Not allowed');
  }

  private async assertOrgMember(userId: string, orgId: string) {
    const m = await this.db.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this organisation');
  }
}
