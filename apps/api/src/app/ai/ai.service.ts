import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  AiProvider,
  AiResponse,
  GenerateOptions,
} from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly providers: AiProvider[];

  constructor(
    private readonly claude: ClaudeProvider,
    private readonly openai: OpenAiProvider,
    private readonly gemini: GeminiProvider,
  ) {
    // Priority order: Claude (default) → OpenAI → Gemini as fallbacks
    this.providers = [claude, openai, gemini];
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
      try {
        return await available[i].generate(prompt, options);
      } catch (error) {
        this.logger.warn(
          `${available[i].name} failed: ${(error as Error).message}`,
        );
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

    // Use first available (no fallback for streaming — too complex to retry mid-stream)
    yield* available[0].stream(prompt, options);
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
    return provider.generate(prompt, options);
  }
}
