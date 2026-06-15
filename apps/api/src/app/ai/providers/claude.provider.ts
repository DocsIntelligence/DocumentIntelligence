import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AiProvider,
  AiResponse,
  ExtractOptions,
  GenerateOptions,
  JsonSchema,
  MultimodalInput,
  Structured,
} from './ai-provider.interface';

/**
 * Claude provider (official @anthropic-ai/sdk — NOT a LangChain shim, so we keep
 * direct access to structured outputs / prompt caching / adaptive thinking).
 *
 * Opus 4.8 constraints baked in:
 *  - NO `temperature` / `top_p` / `top_k` (they 400) — `options.temperature` is ignored.
 *  - NO `budget_tokens`; thinking is adaptive-only and OFF when the field is omitted
 *    (we omit it here for a fast, cheap default — the document-generation path can
 *    opt into adaptive thinking explicitly).
 *  - `max_tokens` is required; we default to 16000 (safe for non-streaming HTTP).
 */
@Injectable()
export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private readonly logger = new Logger(ClaudeProvider.name);
  private client: Anthropic | null = null;
  private modelName: string;

  /**
   * Model used for vision / structured extraction. Defaults to the same model
   * as text; override with ANTHROPIC_VISION_MODEL to point extraction at a
   * cheaper/faster multimodal model than the document-drafting default.
   */
  private readonly visionModel: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.modelName =
      this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-8';
    this.visionModel =
      this.config.get<string>('ANTHROPIC_VISION_MODEL') ?? this.modelName;

    if (apiKey) {
      this.client = new Anthropic({ apiKey, maxRetries: 1 });
      this.logger.log(`Claude initialized (model: ${this.modelName})`);
    } else {
      this.logger.warn('Claude not configured — ANTHROPIC_API_KEY missing');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<AiResponse> {
    if (!this.client) throw new Error('Claude not available');

    const res = await this.client.messages.create({
      model: this.modelName,
      max_tokens: options?.maxTokens ?? 16000,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');

    const u = res.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    } | undefined;
    const usage = {
      inputTokens: u?.input_tokens ?? 0,
      outputTokens: u?.output_tokens ?? 0,
      cachedInputTokens: u?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u?.cache_creation_input_tokens ?? 0,
      reasoningTokens: 0,
      totalTokens:
        (u?.input_tokens ?? 0) +
        (u?.output_tokens ?? 0) +
        (u?.cache_creation_input_tokens ?? 0),
    };
    return {
      text,
      tokensUsed: usage.totalTokens,
      usage,
      model: this.modelName,
      provider: this.name,
    };
  }

  async *stream(
    prompt: string,
    options?: GenerateOptions,
  ): AsyncGenerator<string> {
    if (!this.client) throw new Error('Claude not available');

    const stream = this.client.messages.stream({
      model: this.modelName,
      max_tokens: options?.maxTokens ?? 16000,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
  }

  // ─── Document Intelligence ───────────────────────────────────────────────

  /** Claude (Opus/Sonnet 4.x) is natively multimodal — images and PDFs. */
  supportsVision(): boolean {
    return this.client !== null;
  }

  /** Anthropic exposes no embeddings endpoint; RAG uses another provider. */
  supportsEmbedding(): boolean {
    return false;
  }

  /**
   * Structured extraction via forced tool-use: the model MUST call the single
   * output tool, whose `input_schema` is the caller's JSON Schema, so the
   * returned `input` is schema-shaped JSON (no string parsing, no markdown
   * fences). Accepts text + image + PDF parts in one message.
   */
  async extract<T>(
    input: MultimodalInput,
    schema: JsonSchema,
    options?: ExtractOptions,
  ): Promise<Structured<T>> {
    if (!this.client) throw new Error('Claude not available');

    const toolName = options?.schemaName ?? 'record_extraction';
    const content = input.map((part) => {
      switch (part.kind) {
        case 'text':
          return { type: 'text' as const, text: part.text };
        case 'image':
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: part.mediaType as 'image/png',
              data: part.data,
            },
          };
        case 'document':
          return {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: part.data,
            },
          };
      }
    });

    const res = await this.client.messages.create({
      model: this.visionModel,
      max_tokens: options?.maxTokens ?? 8000,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      tools: [
        {
          name: toolName,
          description:
            options?.instruction ??
            'Record the structured data extracted from the document.',
          input_schema: schema as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user', content }],
    });

    const toolUse = res.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      throw new Error('Claude returned no structured tool_use block');
    }

    const u2 = res.usage as {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    } | undefined;
    const usage = {
      inputTokens: u2?.input_tokens ?? 0,
      outputTokens: u2?.output_tokens ?? 0,
      cachedInputTokens: u2?.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u2?.cache_creation_input_tokens ?? 0,
      reasoningTokens: 0,
      totalTokens:
        (u2?.input_tokens ?? 0) +
        (u2?.output_tokens ?? 0) +
        (u2?.cache_creation_input_tokens ?? 0),
    };
    return {
      data: toolUse.input as T,
      tokensUsed: usage.totalTokens,
      usage,
      model: this.visionModel,
      provider: this.name,
    };
  }
}
