/**
 * AI Provider interface — implement this to add a new LLM provider.
 * The AiService picks the first available provider at runtime.
 *
 * The text path (`generate`/`stream`) is the original, stable surface used by
 * `legal-ai`. The vision / structured-extraction / embedding methods are
 * **additive and optional** (Document Intelligence, docs/05) — a provider that
 * can't do them simply omits them and advertises `supportsVision()` /
 * `supportsEmbedding()` as `false`. `AiService` only routes a step to a provider
 * that advertises the capability, so existing call sites are untouched.
 */
export interface AiProvider {
  readonly name: string;
  isAvailable(): boolean;
  generate(prompt: string, options?: GenerateOptions): Promise<AiResponse>;
  stream(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;

  // ─── Document Intelligence (optional, capability-negotiated) ──────────────

  /** True if this provider can read images / PDFs as input (VLM-native). */
  supportsVision?(): boolean;
  /** True if this provider exposes a text-embedding endpoint (for RAG). */
  supportsEmbedding?(): boolean;
  /**
   * Read a (possibly multimodal) input and return JSON conforming to `schema`.
   * Implemented via the provider's native structured-output / tool-use mode so
   * the model is *forced* to emit valid JSON — no brittle string parsing.
   */
  extract?<T>(
    input: MultimodalInput,
    schema: JsonSchema,
    options?: ExtractOptions,
  ): Promise<Structured<T>>;
  /** Embed texts for retrieval (Phase 2 RAG). Returns one vector per input. */
  embed?(texts: string[]): Promise<number[][]>;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

/**
 * Granular token accounting — superset of every billing dimension the
 * supported providers expose. Providers populate the lanes they actually
 * report; absent values are `0` (not undefined) so the recorder can sum
 * without null-checks.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache-read input — billed at a discount. */
  cachedInputTokens: number;
  /** Anthropic cache-write input — billed at a premium. */
  cacheWriteTokens: number;
  /** Reasoning / thinking tokens (o-series, Anthropic ext-thinking). */
  reasoningTokens: number;
  /** Sum of every billable lane. */
  totalTokens: number;
}

export interface AiResponse {
  text: string;
  /** Legacy convenience (= usage.totalTokens). */
  tokensUsed: number;
  /** Granular token breakdown for the usage ledger / cost engine. */
  usage?: TokenUsage;
  model: string;
  provider: string;
  /** Provider request id (Anthropic x-request-id, OpenAI request-id). */
  requestId?: string;
  /** 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | … */
  finishReason?: string;
}

// ─── Multimodal / structured types (Document Intelligence) ──────────────────

/**
 * One part of a multimodal prompt. `data` is always base64 (no data-URI
 * prefix). Providers map these onto their own content-block shapes.
 */
export type MultimodalPart =
  | { kind: 'text'; text: string }
  | { kind: 'image'; mediaType: string; data: string }
  | { kind: 'document'; mediaType: string; data: string };

export type MultimodalInput = MultimodalPart[];

/** A JSON Schema object (draft-07-ish) describing the expected extraction. */
export type JsonSchema = Record<string, unknown>;

export interface ExtractOptions {
  systemPrompt?: string;
  maxTokens?: number;
  /** Stable name for the output tool/function (provider-specific plumbing). */
  schemaName?: string;
  /** Human description of what to extract — appended to the schema's intent. */
  instruction?: string;
}

/** Result of a structured extraction — `data` already validated against schema. */
export interface Structured<T> {
  data: T;
  tokensUsed: number;
  usage?: TokenUsage;
  model: string;
  provider: string;
  requestId?: string;
  finishReason?: string;
}
