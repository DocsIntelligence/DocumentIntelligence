import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { SettingsService, SETTINGS } from '../settings/settings.service';
import type { TokenUsage } from '../ai/providers/ai-provider.interface';
import { aiUsageContext } from './ai-usage.context';
import { computeCost, findBuiltInPricing } from './pricing';

/**
 * Per-call usage record. The recorder normalises everything into an
 * `AiUsage` row and computes cost from the active rate card. One row per
 * concrete AI invocation — success or failure — so dashboards can answer
 * "how many attempts failed?" just by counting rows.
 */
export interface RecordableCall {
  /** Logical operation: 'classify' | 'extract' | 'generate' | … */
  operation: string;
  provider: string;
  model: string;
  modelVersion?: string;
  /** End-to-end wall-clock duration. */
  durationMs: number;
  /** Granular token breakdown from the provider response. */
  usage?: TokenUsage;
  /** Alternate billable units (LlamaParse pages, TTS chars, …). */
  unitsUsed?: number;
  unitType?: string;
  /** Outcome. */
  status?: 'success' | 'error' | 'timeout' | 'rate_limited' | 'cancelled' | 'partial';
  attempt?: number;
  retryOfId?: string;
  finishReason?: string;
  errorCode?: string;
  errorMessage?: string;
  /** Provider request id, idempotency key, schema name, etc. */
  requestId?: string;
  idempotencyKey?: string;
  latencyToFirstTokenMs?: number;
  queuedMs?: number;
  temperature?: number;
  maxTokens?: number;
  inputBytes?: number;
  outputBytes?: number;
  streamed?: boolean;
  /** Tags + free-form metadata override / merge with the context's values. */
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Writes one `AiUsage` row per AI call. Gated by the `AI_USAGE_TRACKING_ENABLED`
 * setting (system → org → user override). Computes USD cost from the active
 * rate card (DB row → built-in seed → zero). Reads attribution
 * (`userId`/`orgId`/related-entity ids) from `aiUsageContext` so call sites
 * don't have to thread fields through.
 */
@Injectable()
export class AiUsageRecorderService {
  private readonly logger = new Logger(AiUsageRecorderService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly settings: SettingsService,
  ) {}

  async record(call: RecordableCall): Promise<void> {
    const ctx = aiUsageContext.get() ?? {};
    const resolveCtx = { userId: ctx.userId, orgId: ctx.orgId };

    // Bail early when tracking is disabled at the user/org/system level.
    const enabled = await this.settings.get(
      SETTINGS.AI_USAGE_TRACKING_ENABLED,
      resolveCtx,
    );
    if (!enabled) return;

    // Per-scope gate. Narrowest attached subject wins: a call attached to a
    // batch is gated by the batch toggle even if it also names a pipelineRun.
    // Settings.get is cached (30s), so the extra lookups are essentially free.
    if (ctx.batchId) {
      if (!(await this.settings.get(SETTINGS.AI_USAGE_TRACKING_BATCH, resolveCtx))) return;
    } else if (ctx.pipelineRunId) {
      if (!(await this.settings.get(SETTINGS.AI_USAGE_TRACKING_PIPELINE_RUN, resolveCtx))) return;
    } else if (ctx.sourceDocumentId) {
      if (!(await this.settings.get(SETTINGS.AI_USAGE_TRACKING_SOURCE, resolveCtx))) return;
    } else if (ctx.documentId) {
      if (!(await this.settings.get(SETTINGS.AI_USAGE_TRACKING_DOCUMENT, resolveCtx))) return;
    } else {
      if (!(await this.settings.get(SETTINGS.AI_USAGE_TRACKING_UNSCOPED, resolveCtx))) return;
    }

    // Per-operation skip list (e.g. drop noisy 'embed' or 'classify' lanes).
    const skipOps = await this.settings.get(
      SETTINGS.AI_USAGE_TRACKING_SKIP_OPS,
      resolveCtx,
    );
    if (Array.isArray(skipOps) && skipOps.includes(call.operation)) return;

    // Per-org retention window — stamped on the row so a later admin change
    // doesn't retroactively shorten/extend already-recorded rows.
    const retentionDays = await this.settings.get(
      SETTINGS.AI_USAGE_RETENTION_DAYS,
      resolveCtx,
    );

    const usage = call.usage ?? {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    };
    const unitsUsed = call.unitsUsed ?? usage.totalTokens;
    const unitType = call.unitType ?? 'tokens';

    // Cost: prefer a live DB rate card; fall back to the seed; else zero.
    let pricingId: string | null = null;
    let costUsd = 0;
    try {
      const rateRow = await this.db.aiModelPricing.findFirst({
        where: {
          provider: call.provider,
          model: call.model,
          active: true,
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          effectiveFrom: { lte: new Date() },
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (rateRow) {
        pricingId = rateRow.id;
        costUsd = computeCost(
          {
            provider: rateRow.provider,
            model: rateRow.model,
            inputPer1M: rateRow.inputPer1M
              ? Number(rateRow.inputPer1M)
              : undefined,
            outputPer1M: rateRow.outputPer1M
              ? Number(rateRow.outputPer1M)
              : undefined,
            cachedInputPer1M: rateRow.cachedInputPer1M
              ? Number(rateRow.cachedInputPer1M)
              : undefined,
            cacheWritePer1M: rateRow.cacheWritePer1M
              ? Number(rateRow.cacheWritePer1M)
              : undefined,
            reasoningPer1M: rateRow.reasoningPer1M
              ? Number(rateRow.reasoningPer1M)
              : undefined,
            perCallUsd: rateRow.perCallUsd ? Number(rateRow.perCallUsd) : undefined,
          },
          { ...usage, unitsUsed },
        );
      } else {
        const seed = findBuiltInPricing(call.provider, call.model);
        if (seed) {
          costUsd = computeCost(seed, { ...usage, unitsUsed });
        }
      }
    } catch (err) {
      this.logger.warn(
        `cost lookup failed for ${call.provider}/${call.model}: ${
          (err as Error).message
        }`,
      );
    }

    const data: Prisma.AiUsageCreateInput = {
      userId: ctx.userId ?? null,
      orgId: ctx.orgId ?? null,
      sessionId: ctx.sessionId ?? null,
      traceId: ctx.traceId ?? null,
      parentSpanId: ctx.parentSpanId ?? null,
      operation: call.operation ?? ctx.operation ?? 'unknown',
      featureCode: ctx.featureCode ?? null,
      provider: call.provider,
      model: call.model,
      modelVersion: call.modelVersion ?? null,
      documentId: ctx.documentId ?? null,
      sourceDocumentId: ctx.sourceDocumentId ?? null,
      pipelineRunId: ctx.pipelineRunId ?? null,
      extractionId: ctx.extractionId ?? null,
      analysisRunId: ctx.analysisRunId ?? null,
      batchId: ctx.batchId ?? null,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cachedInputTokens: usage.cachedInputTokens ?? 0,
      cacheWriteTokens: usage.cacheWriteTokens ?? 0,
      reasoningTokens: usage.reasoningTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
      unitsUsed,
      unitType,
      inputBytes: call.inputBytes ?? null,
      outputBytes: call.outputBytes ?? null,
      estimatedCostUsd: new Prisma.Decimal(costUsd.toFixed(6)),
      pricingId: pricingId ?? null,
      durationMs: call.durationMs ?? 0,
      latencyToFirstTokenMs: call.latencyToFirstTokenMs ?? null,
      queuedMs: call.queuedMs ?? null,
      status: call.status ?? 'success',
      attempt: call.attempt ?? 1,
      retryOfId: call.retryOfId ?? null,
      finishReason: call.finishReason ?? null,
      errorCode: call.errorCode ?? null,
      errorMessage: call.errorMessage ?? null,
      requestId: call.requestId ?? null,
      idempotencyKey: call.idempotencyKey ?? null,
      temperature: call.temperature ?? null,
      maxTokens: call.maxTokens ?? null,
      streamed: call.streamed ?? false,
      tags: [...(ctx.tags ?? []), ...(call.tags ?? [])],
      metadata: this.mergeMetadata(ctx.metadata, call.metadata),
      retentionDays:
        typeof retentionDays === 'number' && retentionDays > 0
          ? retentionDays
          : 365,
      finishedAt: new Date(),
    };

    try {
      await this.db.aiUsage.create({ data });
    } catch (err) {
      // Never let the ledger break the user's actual call.
      this.logger.warn(
        `AiUsage write failed: ${(err as Error).message}`,
      );
    }
  }

  private mergeMetadata(
    a?: Record<string, unknown>,
    b?: Record<string, unknown>,
  ): Prisma.InputJsonValue | undefined {
    if (!a && !b) return undefined;
    return { ...(a ?? {}), ...(b ?? {}) } as Prisma.InputJsonValue;
  }
}
