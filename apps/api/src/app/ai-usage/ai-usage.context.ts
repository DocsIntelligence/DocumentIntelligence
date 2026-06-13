import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request attribution carried to every AI call site. Set by the caller
 * (controller / engine / service) immediately before invoking AiService; the
 * `AiUsageRecorderService` reads it from AsyncLocalStorage so we don't have
 * to thread `userId`/`orgId`/related-entity ids through every method
 * signature.
 *
 * Usage:
 *
 *     await aiUsageContext.run(
 *       { userId, orgId, operation: 'extract', sourceDocumentId, pipelineRunId },
 *       async () => { await this.ai.extract(input, schema, opts); },
 *     );
 *
 * Anything `recordable` can be set/mutated for a single AI call; everything
 * else lives for the lifetime of the async scope. The recorder takes a
 * snapshot at write time.
 */
export interface AiUsageContextValue {
  userId?: string | null;
  orgId?: string | null;
  sessionId?: string | null;
  traceId?: string | null;
  parentSpanId?: string | null;
  operation?: string;
  featureCode?: string | null;

  // Related entity ids — any combo
  documentId?: string | null;
  sourceDocumentId?: string | null;
  pipelineRunId?: string | null;
  extractionId?: string | null;
  analysisRunId?: string | null;
  batchId?: string | null;

  tags?: string[];
  metadata?: Record<string, unknown>;
}

const als = new AsyncLocalStorage<AiUsageContextValue>();

export const aiUsageContext = {
  /** Run `fn` with the given attribution. Stores a shallow clone so
   *  callers can mutate downstream without leaking across requests. */
  run<T>(value: AiUsageContextValue, fn: () => Promise<T> | T): Promise<T> | T {
    return als.run({ ...value }, fn);
  },
  /** Current attribution (undefined when no AI call is in flight). */
  get(): AiUsageContextValue | undefined {
    return als.getStore();
  },
  /** Merge keys into the current store (no-op outside a `run`). */
  patch(patch: Partial<AiUsageContextValue>): void {
    const cur = als.getStore();
    if (!cur) return;
    Object.assign(cur, patch);
  },
};
