import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AiProvider,
  AiResponse,
  GenerateOptions,
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

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.modelName =
      this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-opus-4-8';

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

    return {
      text,
      tokensUsed:
        (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0),
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
}
