import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type {
  AiProvider,
  AiResponse,
  GenerateOptions,
  LcUsageMetadata,
} from './ai-provider.interface';
import { tokenUsageFromLc } from './ai-provider.interface';

@Injectable()
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private model: ChatGoogleGenerativeAI | null = null;
  private modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    this.modelName =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-flash';

    if (apiKey) {
      this.model = new ChatGoogleGenerativeAI({
        apiKey,
        model: this.modelName,
        temperature: 0.7,
        maxRetries: 1,
      });
      this.logger.log(`Gemini initialized (model: ${this.modelName})`);
    } else {
      this.logger.warn('Gemini not configured — GEMINI_API_KEY missing');
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  async generate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<AiResponse> {
    if (!this.model) throw new Error('Gemini not available');

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt)
      messages.push(new SystemMessage(options.systemPrompt));
    messages.push(new HumanMessage(prompt));

    const response = await this.model.invoke(messages);
    const usage = tokenUsageFromLc(
      response.usage_metadata as LcUsageMetadata | undefined,
    );

    return {
      text: response.content as string,
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
    if (!this.model) throw new Error('Gemini not available');

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt)
      messages.push(new SystemMessage(options.systemPrompt));
    messages.push(new HumanMessage(prompt));

    const stream = await this.model.stream(messages);
    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string' && content) {
        yield content;
      }
    }
  }
}
