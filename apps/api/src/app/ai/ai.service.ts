import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageRecorderService } from '../ai-usage/ai-usage.recorder';
import type {
  AiProvider,
  AiResponse,
  ExtractOptions,
  GenerateOptions,
  JsonSchema,
  MultimodalInput,
  Structured,
  TokenUsage,
} from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

/** Empty fallback for providers that don't return a granular usage block. */
const emptyUsage = (totalTokens = 0): TokenUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
  totalTokens,
});

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: AiProvider[];
  /**
   * Optional `provider:model` allow-list (env AI_MODEL_WHITELIST, comma-sep).
   * Empty = allow all. When set, an explicit model request outside the list
   * fails fast — cheap guardrail against spending on invalid combos (docs/05
   * §1). Provider defaults (no explicit model) are always allowed.
   */
  private readonly modelWhitelist: Set<string>;

  constructor(
    private readonly claude: ClaudeProvider,
    private readonly openai: OpenAiProvider,
    private readonly gemini: GeminiProvider,
    private readonly config: ConfigService,
    private readonly usage: AiUsageRecorderService,
  ) {
    // Priority order is config-driven: AI_DEFAULT_PROVIDER goes first, the rest
    // are fallbacks in a stable order. Default = OpenAI (the current default
    // provider); set AI_DEFAULT_PROVIDER=claude|gemini to switch.
    const byName: Record<string, AiProvider> = {
      openai,
      claude,
      gemini,
    };
    const preferred = (
      this.config.get<string>('AI_DEFAULT_PROVIDER') ?? 'openai'
    ).toLowerCase();
    const order = [
      preferred,
      ...Object.keys(byName).filter((n) => n !== preferred),
    ];
    this.providers = order.map((n) => byName[n]).filter(Boolean);

    this.modelWhitelist = new Set(
      (this.config.get<string>('AI_MODEL_WHITELIST') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  /** Get list of available providers */
  getAvailableProviders(): string[] {
    return this.providers.filter((p) => p.isAvailable()).map((p) => p.name);
  }

  /** Generate a response using the first available provider (with fallback) */
  async generate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<AiResponse> {
    const available = this.providers.filter((p) => p.isAvailable());
    if (available.length === 0) {
      throw new BadRequestException(
        'No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.',
      );
    }

    for (let i = 0; i < available.length; i++) {
      const provider = available[i];
      const start = Date.now();
      try {
        const response = await provider.generate(prompt, options);
        await this.usage.record({
          operation: 'generate',
          provider: response.provider,
          model: response.model,
          durationMs: Date.now() - start,
          usage: response.usage ?? emptyUsage(response.tokensUsed),
          attempt: i + 1,
          status: 'success',
          finishReason: response.finishReason,
          requestId: response.requestId,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          inputBytes: prompt.length,
          outputBytes: response.text.length,
        });
        return response;
      } catch (error) {
        const err = error as Error;
        await this.usage.record({
          operation: 'generate',
          provider: provider.name,
          model: 'unknown',
          durationMs: Date.now() - start,
          attempt: i + 1,
          status: 'error',
          errorMessage: err.message,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          inputBytes: prompt.length,
        });
        this.logger.warn(`${provider.name} failed: ${err.message}`);
        if (i === available.length - 1) throw error; // Last provider, re-throw
      }
    }

    throw new BadRequestException('All AI providers failed');
  }

  /** Stream a response using the first available provider */
  async *stream(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<string> {
    const available = this.providers.filter((p) => p.isAvailable());
    if (available.length === 0) {
      throw new BadRequestException('No AI provider configured.');
    }

    // Use first available (no fallback for streaming — too complex to retry mid-stream).
    // Token usage isn't available on the SSE stream; record a best-effort row at end.
    const provider = available[0];
    const start = Date.now();
    let bytesOut = 0;
    let firstTokenAt: number | undefined;
    try {
      for await (const chunk of provider.stream(prompt, options)) {
        if (firstTokenAt === undefined) firstTokenAt = Date.now();
        bytesOut += chunk.length;
        yield chunk;
      }
      await this.usage.record({
        operation: 'generate',
        provider: provider.name,
        model: 'unknown',
        durationMs: Date.now() - start,
        latencyToFirstTokenMs: firstTokenAt ? firstTokenAt - start : undefined,
        status: 'success',
        streamed: true,
        inputBytes: prompt.length,
        outputBytes: bytesOut,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
    } catch (error) {
      const err = error as Error;
      await this.usage.record({
        operation: 'generate',
        provider: provider.name,
        model: 'unknown',
        durationMs: Date.now() - start,
        status: 'error',
        streamed: true,
        errorMessage: err.message,
        inputBytes: prompt.length,
        outputBytes: bytesOut,
      });
      throw err;
    }
  }

  /** Generate using a specific provider by name */
  async generateWith(
    providerName: string,
    prompt: string,
    options?: GenerateOptions,
  ): Promise<AiResponse> {
    const provider = this.providers.find(
      (p) => p.name === providerName && p.isAvailable(),
    );
    if (!provider)
      throw new BadRequestException(`Provider "${providerName}" not available`);
    const start = Date.now();
    try {
      const response = await provider.generate(prompt, options);
      await this.usage.record({
        operation: 'generate',
        provider: response.provider,
        model: response.model,
        durationMs: Date.now() - start,
        usage: response.usage ?? emptyUsage(response.tokensUsed),
        status: 'success',
        finishReason: response.finishReason,
        requestId: response.requestId,
      });
      return response;
    } catch (error) {
      const err = error as Error;
      await this.usage.record({
        operation: 'generate',
        provider: provider.name,
        model: 'unknown',
        durationMs: Date.now() - start,
        status: 'error',
        errorMessage: err.message,
      });
      throw err;
    }
  }

  // ─── Document Intelligence (capability-negotiated) ───────────────────────

  /** Providers that are configured AND advertise vision + structured extract. */
  getVisionProviders(): string[] {
    return this.providers
      .filter((p) => p.isAvailable() && p.supportsVision?.() && p.extract)
      .map((p) => p.name);
  }

  /**
   * Structured extraction with capability negotiation + observable fallback
   * (docs/05 §4, ARCHITECTURE_PRINCIPLES). Tries each vision-capable provider
   * in priority order; a failure is logged (no silent downgrade) and the next
   * is tried. Throws if none can extract.
   */
  async extract<T>(
    input: MultimodalInput,
    schema: JsonSchema,
    options?: ExtractOptions,
  ): Promise<Structured<T>> {
    const capable = this.providers.filter(
      (p) => p.isAvailable() && p.supportsVision?.() && p.extract,
    );
    if (capable.length === 0) {
      throw new BadRequestException(
        'No vision-capable AI provider configured for extraction. Set ANTHROPIC_API_KEY (Claude is multimodal).',
      );
    }

    for (let i = 0; i < capable.length; i++) {
      const provider = capable[i];
      if (!provider.extract) continue; // filtered above; narrows away the `!`
      const start = Date.now();
      try {
        const response = await provider.extract<T>(input, schema, options);
        await this.usage.record({
          operation: 'extract',
          provider: response.provider,
          model: response.model,
          durationMs: Date.now() - start,
          usage: response.usage ?? emptyUsage(response.tokensUsed),
          attempt: i + 1,
          status: 'success',
          finishReason: response.finishReason,
          requestId: response.requestId,
          maxTokens: options?.maxTokens,
          metadata: options?.schemaName
            ? { schemaName: options.schemaName }
            : undefined,
        });
        return response;
      } catch (error) {
        const err = error as Error;
        await this.usage.record({
          operation: 'extract',
          provider: provider.name,
          model: 'unknown',
          durationMs: Date.now() - start,
          attempt: i + 1,
          status: 'error',
          errorMessage: err.message,
        });
        this.logger.warn(`extract: ${provider.name} failed: ${err.message}`);
        if (i === capable.length - 1) throw error;
      }
    }
    throw new BadRequestException('All extraction providers failed');
  }

  /** Extract using a specific provider by name (no fallback). */
  async extractWith<T>(
    providerName: string,
    input: MultimodalInput,
    schema: JsonSchema,
    options?: ExtractOptions,
  ): Promise<Structured<T>> {
    const provider = this.providers.find(
      (p) => p.name === providerName && p.isAvailable(),
    );
    if (!provider?.extract) {
      throw new BadRequestException(
        `Provider "${providerName}" cannot extract`,
      );
    }
    const start = Date.now();
    try {
      const response = await provider.extract<T>(input, schema, options);
      await this.usage.record({
        operation: 'extract',
        provider: response.provider,
        model: response.model,
        durationMs: Date.now() - start,
        usage: response.usage ?? emptyUsage(response.tokensUsed),
        status: 'success',
        finishReason: response.finishReason,
        requestId: response.requestId,
      });
      return response;
    } catch (error) {
      const err = error as Error;
      await this.usage.record({
        operation: 'extract',
        provider: provider.name,
        model: 'unknown',
        durationMs: Date.now() - start,
        status: 'error',
        errorMessage: err.message,
      });
      throw err;
    }
  }

  /** True when at least one available provider can produce embeddings. Lets
   *  callers (e.g. the search indexer) degrade to keyword-only without catching. */
  canEmbed(): boolean {
    return this.providers.some(
      (p) => p.isAvailable() && p.supportsEmbedding?.() && !!p.embed,
    );
  }

  /** Embed texts for RAG. Wired in Phase 2; throws until a provider supports it. */
  async embed(texts: string[]): Promise<number[][]> {
    const provider = this.providers.find(
      (p) => p.isAvailable() && p.supportsEmbedding?.() && p.embed,
    );
    if (!provider?.embed) {
      throw new BadRequestException(
        'No embedding-capable AI provider configured (RAG is Phase 2).',
      );
    }
    const start = Date.now();
    const totalChars = texts.reduce((acc, t) => acc + t.length, 0);
    try {
      const vectors = await provider.embed(texts);
      // Embedding APIs don't return tokens per call in LangChain's wrapper;
      // approximate as 1 token / 4 chars (OpenAI rough rule). Cost engine
      // multiplies against inputPer1M of the matching embedding model.
      const approxTokens = Math.ceil(totalChars / 4);
      await this.usage.record({
        operation: 'embed',
        provider: provider.name,
        model:
          (provider as { embeddingModel?: string }).embeddingModel ??
          'text-embedding-3-small',
        durationMs: Date.now() - start,
        usage: {
          ...emptyUsage(approxTokens),
          inputTokens: approxTokens,
          totalTokens: approxTokens,
        },
        status: 'success',
        metadata: { batchSize: texts.length, totalChars },
      });
      return vectors;
    } catch (error) {
      const err = error as Error;
      await this.usage.record({
        operation: 'embed',
        provider: provider.name,
        model: 'text-embedding-3-small',
        durationMs: Date.now() - start,
        status: 'error',
        errorMessage: err.message,
        metadata: { batchSize: texts.length, totalChars },
      });
      throw err;
    }
  }

  /**
   * Whitelist guard for explicit `provider:model` requests. No-op when the
   * whitelist is empty (allow all). Fail fast on a disallowed combo.
   */
  assertModelAllowed(provider: string, model: string): void {
    if (this.modelWhitelist.size === 0) return;
    const combo = `${provider}:${model}`;
    if (!this.modelWhitelist.has(combo)) {
      throw new BadRequestException(
        `Model combo "${combo}" is not in AI_MODEL_WHITELIST.`,
      );
    }
  }
}
