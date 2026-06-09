import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ExtractionEngineMode,
  Feature,
  Prisma,
} from '@prisma/client';
import {
  decideReview,
  genericExtractionSchema,
  getExtractionSchema,
  classifierCandidateKeys,
  type ExtractionResult,
  type ExtractionSchema,
  type SourceInput,
} from '@org/doc-intelligence';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { errorMessage } from '../common/error.util';
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

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly walletUsage: WalletUsageService,
    private readonly parsing: ParsingService,
    config: ConfigService,
  ) {
    this.classifier = new ClassifierEngine(ai);
    this.vlm = new VlmExtractionEngine(ai);
    this.agentic = new AgenticExtractionEngine(config, ai);
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

      // ── classify → the generator's DocumentType key (§11.2)
      const tClassify = Date.now();
      const classification = await this.classifier.classify({
        source,
        candidateKeys: classifierCandidateKeys(),
      });
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

      // ── resolve schema: known type → its pack; else generic → freeform later
      const schema: ExtractionSchema = classification.documentTypeKey
        ? (getExtractionSchema(classification.documentTypeKey) ??
          genericExtractionSchema)
        : genericExtractionSchema;

      // ── tiered extraction (native / vlm / agentic) with entitlement gating
      const tExtract = Date.now();
      const { result, engineUsed, usedAgentic } = await this.extractTiered(
        job.engineMode,
        schema,
        source,
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
    const runVlm = async () => ({
      result: await this.vlm.extract({ schema, source }),
      engineUsed: `vlm:${this.vlm.name}`,
      usedAgentic: false,
    });

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

      case ExtractionEngineMode.native: {
        const parsed = await this.parseText(source);
        if (!parsed) {
          throw new Error(
            'No usable text layer for native extraction — retry with the vlm or agentic engine.',
          );
        }
        return {
          result: await this.vlm.extract({ schema, document: parsed }),
          engineUsed: `native:${parsed.source}`,
          usedAgentic: false,
        };
      }

      case ExtractionEngineMode.auto:
      default: {
        // Free fast path: text layer → structured-extract over text.
        const parsed = await this.parseText(source);
        if (parsed) {
          return {
            result: await this.vlm.extract({ schema, document: parsed }),
            engineUsed: `native:${parsed.source}`,
            usedAgentic: false,
          };
        }
        // Scanned/no text → escalate. Prefer the paid agentic tier when the
        // user is entitled and it's configured; otherwise vision.
        this.logger.debug(
          `No text layer; escalating (entitled=${entitled}, agentic=${agenticAvailable})`,
        );
        if (entitled && agenticAvailable) return runAgentic();
        return runVlm();
      }
    }
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
