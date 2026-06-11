import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExtractionEngineMode,
  Feature,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_ROUTING,
  decideReview,
  genericExtractionSchema,
  classifierCandidateKeys,
  type ExtractionResult,
  type ExtractionSchema,
  type NormalizedDocument,
  type SourceInput,
} from '@org/doc-intelligence';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { errorMessage } from '../common/error.util';
import { SchemaResolverService } from './config/schema-resolver.service';
import { AgenticExtractionEngine } from './engines/agentic-extraction.engine';
import { ClassifierEngine } from './engines/classifier.engine';
import { VlmExtractionEngine } from './engines/vlm-extraction.engine';
import { ParsingService } from './parsing.service';

export interface IntelligenceJobPayload {
  jobId: string;
}

/**
 * Runs one IntelligenceJob through the linear v1 state machine
 * (classify → extract → review-decision), persisting an Extraction with
 * per-field confidence + provenance (docs/05 §4). Crash-resilient: idempotent
 * + stage-guarded, with a `heartbeatAt` the reconciler watches.
 *
 * Extraction is TIERED (docs/05 §4, §5; user spec):
 *   native  — free: parse the text layer (DOCX/PDF/text) via multiple libraries,
 *             then structured-extract over that text (default provider = OpenAI).
 *   vlm     — vision: send the raw page bytes to a multimodal provider (scanned).
 *   agentic — PREMIUM, entitlement-gated: a configurable hosted agentic parser
 *             reads at high fidelity, then we structured-extract over its text.
 * `auto` parses first and escalates to agentic (if entitled+configured) or vlm
 * when there's no usable text layer.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly classifier: ClassifierEngine;
  private readonly vlm: VlmExtractionEngine;
  private readonly agentic: AgenticExtractionEngine;
  /** Critic re-verification pass (docs/05 §3) — on by default; disable via env. */
  private readonly criticEnabled: boolean;
  private readonly criticThreshold = DEFAULT_ROUTING.fieldThreshold;

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly walletUsage: WalletUsageService,
    private readonly parsing: ParsingService,
    private readonly resolver: SchemaResolverService,
    config: ConfigService,
  ) {
    this.classifier = new ClassifierEngine(ai);
    this.vlm = new VlmExtractionEngine(ai);
    this.agentic = new AgenticExtractionEngine(config, ai);
    this.criticEnabled =
      (config.get<string>('EXTRACTION_CRITIC_ENABLED') ?? 'true') !== 'false';
  }

  /** Run the VLM engine, then (optionally) the critic re-verification pass. */
  private async extractWithCritic(
    req: { schema: ExtractionSchema; source?: SourceInput; document?: NormalizedDocument },
  ): Promise<ExtractionResult> {
    const result = await this.vlm.extract(req);
    if (!this.criticEnabled) return result;
    return this.vlm.critique(req, result, this.criticThreshold);
  }

  async run(payload: IntelligenceJobPayload): Promise<void> {
    const { jobId } = payload;
    const job = await this.db.intelligenceJob.findUnique({
      where: { id: jobId },
      include: { sourceDocument: true },
    });
    if (!job) {
      this.logger.warn(`Job ${jobId} not found — skipping`);
      return;
    }
    if (job.status === 'completed') {
      this.logger.debug(`Job ${jobId} already completed — skipping`);
      return;
    }

    const startedAtMs = Date.now();
    const telemetry: Record<string, unknown> = {};
    const src = job.sourceDocument;

    try {
      await this.db.intelligenceJob.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          stage: 'classify',
          attempts: { increment: 1 },
          startedAt: new Date(),
          heartbeatAt: new Date(),
          error: null,
        },
      });

      // ── ingest: load raw bytes
      const bytes = await this.loadBytes(src.s3Key);
      const source: SourceInput = {
        data: bytes.toString('base64'),
        contentType: src.contentType,
        filename: src.filename,
        language: src.language ?? undefined,
      };

      // ── parse to text FIRST (prefer the extraction libraries over AI). The
      // parsed text feeds both classify and extract; AI vision over the raw
      // bytes is only used when there is no usable text layer (scanned).
      const parsed =
        job.engineMode === 'vlm' ? null : await this.parseText(source);
      telemetry['hasTextLayer'] = Boolean(parsed);
      if (parsed) {
        await this.db.sourceDocument.update({
          where: { id: src.id },
          data: {
            normalizedText: parsed as unknown as Prisma.InputJsonValue,
          },
        });
      }

      // ── classify → the generator's DocumentType key (§11.2). Classify over
      // the parsed text when we have it; only fall back to vision bytes when we
      // don't (and a PDF with no text needs a PDF-capable vision provider).
      const tClassify = Date.now();
      // Candidate types resolved from config-as-data (org DB → templates → code),
      // so the single-doc flow sees the same authored catalog as pipelines.
      const candidateKeys = await this.resolver.candidateKeys(src.ownerOrgId);
      const classification = parsed
        ? await this.classifier.classify({ document: parsed, candidateKeys })
        : await this.classifyByVision(source, candidateKeys);
      telemetry['classifyMs'] = Date.now() - tClassify;
      telemetry['documentTypeKey'] = classification.documentTypeKey;
      telemetry['classifyConfidence'] = classification.confidence;

      await this.db.intelligenceJob.update({
        where: { id: jobId },
        data: {
          stage: 'extract',
          documentTypeKey: classification.documentTypeKey,
          heartbeatAt: new Date(),
        },
      });

      // ── resolve schema from config-as-data (org DB → template → code); else
      // generic → freeform later
      const schema: ExtractionSchema = classification.documentTypeKey
        ? await this.resolver.resolveSchema(
            src.ownerOrgId,
            classification.documentTypeKey,
          )
        : genericExtractionSchema;

      // ── tiered extraction (native / vlm / agentic) with entitlement gating
      const tExtract = Date.now();
      const { result, engineUsed, usedAgentic } = await this.extractTiered(
        job.engineMode,
        schema,
        source,
        parsed,
        src.ownerUserId,
      );
      telemetry['extractMs'] = Date.now() - tExtract;
      telemetry['engineUsed'] = engineUsed;

      const review = decideReview(schema, result);

      // ── persist extraction + transition job/source
      await this.db.$transaction(async (tx) => {
        await tx.extraction.create({
          data: {
            sourceDocumentId: src.id,
            jobId,
            schemaKey: schema.key,
            documentTypeKey: schema.documentTypeKey ?? null,
            fields: result.fields as unknown as Prisma.InputJsonValue,
            confidence: result.confidence as unknown as Prisma.InputJsonValue,
            overallConfidence: result.overallConfidence,
          },
        });
        await tx.intelligenceJob.update({
          where: { id: jobId },
          data: {
            status: review.needsReview ? 'needs_review' : 'completed',
            stage: 'review',
            engineUsed,
            telemetry: {
              ...telemetry,
              totalMs: Date.now() - startedAtMs,
            } as Prisma.InputJsonValue,
            finishedAt: new Date(),
            heartbeatAt: new Date(),
          },
        });
        await tx.sourceDocument.update({
          where: { id: src.id },
          data: { status: 'processed' },
        });
      });

      // ── meter spend (best-effort). Every run costs one ai_attempt; an agentic
      // run additionally consumes a premium_extraction unit (the paid tier).
      if (src.ownerUserId) {
        await this.walletUsage.trackUsage(
          src.ownerUserId,
          Feature.ai_attempts,
          1,
        );
        if (usedAgentic) {
          await this.walletUsage.trackUsage(
            src.ownerUserId,
            Feature.premium_extraction,
            1,
          );
        }
      }

      this.logger.log(
        `Job ${jobId} ${review.needsReview ? 'needs review' : 'completed'} via ${engineUsed} (${review.flaggedFields.length} flagged)`,
      );
    } catch (e) {
      const message = errorMessage(e);
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.db.intelligenceJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: message,
          finishedAt: new Date(),
          telemetry: telemetry as Prisma.InputJsonValue,
        },
      });
      await this.db.sourceDocument.update({
        where: { id: src.id },
        data: { status: 'failed' },
      });
      throw e; // surfaces to BullMQ for retry; inline caller catches
    }
  }

  /**
   * Pick the engine tier and run it. Returns the result + the engine actually
   * used (for telemetry/audit) + whether the paid agentic tier was consumed.
   */
  private async extractTiered(
    mode: ExtractionEngineMode,
    schema: ExtractionSchema,
    source: SourceInput,
    parsed: NormalizedDocument | null,
    ownerUserId: string | null,
  ): Promise<{
    result: ExtractionResult;
    engineUsed: string;
    usedAgentic: boolean;
  }> {
    const agenticAvailable = this.agentic.isConfigured();
    // Entitlement is per-user (wallet). Org-owned docs (no ownerUserId) can't
    // resolve a wallet here → not entitled to auto-escalate to the paid tier.
    const entitled = ownerUserId
      ? await this.walletUsage.checkQuota(ownerUserId, Feature.premium_extraction)
      : false;

    const runAgentic = async () => {
      if (!agenticAvailable) {
        throw new Error(
          'Agentic extraction requested but not configured (set EXTRACTION_AGENTIC_BASE_URL/_API_KEY).',
        );
      }
      const result = await this.agentic.extract({ schema, source });
      return {
        result,
        engineUsed: `agentic:${this.agentic.provider}`,
        usedAgentic: true,
      };
    };
    const runNative = async () => {
      if (!parsed) throw new Error('No text layer to extract from');
      return {
        result: await this.extractWithCritic({ schema, document: parsed }),
        engineUsed: `native:${parsed.source}`,
        usedAgentic: false,
      };
    };
    const runVlm = async () => {
      this.assertVisionCanRead(source);
      return {
        result: await this.extractWithCritic({ schema, source }),
        engineUsed: `vlm:${this.vlm.name}`,
        usedAgentic: false,
      };
    };

    switch (mode) {
      case ExtractionEngineMode.agentic:
        // Entitlement is enforced at upload; re-check defensively here.
        if (!entitled) {
          throw new ForbiddenException(
            'Premium (agentic) extraction is not included in your plan.',
          );
        }
        return runAgentic();

      case ExtractionEngineMode.vlm:
        return runVlm();

      case ExtractionEngineMode.native:
        if (!parsed) {
          throw new Error(
            'No usable text layer for native extraction — this looks like a scanned document. Retry with the vision or premium engine.',
          );
        }
        return runNative();

      case ExtractionEngineMode.auto:
      default: {
        // Prefer the parse libraries: a text layer → cheap text extraction.
        if (parsed) return runNative();
        // Scanned / no text → escalate. Prefer the paid agentic tier when the
        // user is entitled and it's configured; otherwise vision.
        this.logger.debug(
          `No text layer; escalating (entitled=${entitled}, agentic=${agenticAvailable})`,
        );
        if (entitled && agenticAvailable) return runAgentic();
        return runVlm();
      }
    }
  }

  /**
   * Classify a document we couldn't parse to text (no text layer) via vision.
   * Surfaces an actionable error for the common misconfig: a scanned PDF with
   * only OpenAI configured (OpenAI chat can't read PDFs).
   */
  private async classifyByVision(source: SourceInput, candidateKeys?: string[]) {
    this.assertVisionCanRead(source);
    return this.classifier.classify({
      source,
      candidateKeys: candidateKeys ?? classifierCandidateKeys(),
    });
  }

  /**
   * Guard the vision path: PDFs need a PDF-capable vision provider. OpenAI chat
   * (our default) reads images but NOT PDFs, so a scanned PDF with no other
   * vision provider must fail with a clear, fixable message rather than the raw
   * provider error.
   */
  private assertVisionCanRead(source: SourceInput): void {
    if (source.contentType !== 'application/pdf') return; // images are fine
    const providers = this.ai.getVisionProviders();
    const hasPdfCapable =
      providers.includes('claude') || this.agentic.isConfigured();
    if (!hasPdfCapable) {
      throw new Error(
        'This appears to be a scanned PDF with no text layer. OpenAI cannot read PDFs directly — add ANTHROPIC_API_KEY (Claude reads PDFs), configure the premium agentic engine, or upload the pages as images.',
      );
    }
  }

  // ─── Public reuse surface (for the pipeline executor, docs/07) ────────────
  // Thin wrappers so the data-driven PipelineExecutorService can reuse the
  // exact same ingest/classify/extract logic — one source of truth, no drift.

  /** Build a SourceInput (base64 bytes + metadata) from a stored object. */
  async buildSourceInput(src: {
    s3Key: string;
    contentType: string;
    filename: string;
    language: string | null;
  }): Promise<SourceInput> {
    const bytes = await this.loadBytes(src.s3Key);
    return {
      data: bytes.toString('base64'),
      contentType: src.contentType,
      filename: src.filename,
      language: src.language ?? undefined,
    };
  }

  /** Parse to text (prefer libraries); null when no usable text layer. */
  async parseSource(source: SourceInput) {
    return this.parseText(source);
  }

  /**
   * Classify text-first (over parsed text when available, else vision).
   * `candidateKeys` lets the data-driven executor pass an org-resolved /
   * per-pipeline-narrowed candidate set; defaults to the in-code registry for
   * the legacy single-doc flow.
   */
  async classifyDoc(
    parsed: NormalizedDocument | null,
    source: SourceInput,
    candidateKeys?: string[],
  ) {
    return parsed
      ? this.classifier.classify({
          document: parsed,
          candidateKeys: candidateKeys ?? classifierCandidateKeys(),
        })
      : this.classifyByVision(source, candidateKeys);
  }

  /** Run tiered extraction (native/vlm/agentic) with entitlement gating. */
  async extractOne(
    mode: ExtractionEngineMode,
    schema: ExtractionSchema,
    source: SourceInput,
    parsed: NormalizedDocument | null,
    ownerUserId: string | null,
  ) {
    return this.extractTiered(mode, schema, source, parsed, ownerUserId);
  }

  private async parseText(source: SourceInput) {
    if (!this.parsing.canParse(source.contentType)) return null;
    return this.parsing.parse(source);
  }

  /** Read object bytes for any backend without modifying StorageService. */
  private async loadBytes(key: string): Promise<Buffer> {
    if (this.storage.isLocalBackend()) {
      return this.storage.readBuffer(key);
    }
    const url = await this.storage.getPresignedDownloadUrl(key);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch source ${key}: HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}
