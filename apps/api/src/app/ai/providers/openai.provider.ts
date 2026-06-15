import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  type HumanMessageFields,
} from '@langchain/core/messages';

/** The content shape LangChain's HumanMessage constructor accepts. */
type HumanContent = HumanMessageFields['content'];
import type {
  AiProvider,
  AiResponse,
  ExtractOptions,
  GenerateOptions,
  JsonSchema,
  LcUsageMetadata,
  MultimodalInput,
  Structured,
} from './ai-provider.interface';
import { tokenUsageFromLc } from './ai-provider.interface';

@Injectable()
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAiProvider.name);
  private model: ChatOpenAI | null = null;
  private modelName: string;
  /** Vision/extraction model — gpt-4o family is multimodal + structured-output. */
  private readonly visionModel: string;
  private embeddings: OpenAIEmbeddings | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.modelName = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
    this.visionModel =
      this.config.get<string>('OPENAI_VISION_MODEL') ?? this.modelName;

    if (apiKey) {
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        model: this.modelName,
        temperature: 0.7,
        streaming: false,
        maxRetries: 1,
      });
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
        model:
          this.config.get<string>('OPENAI_EMBED_MODEL') ??
          'text-embedding-3-small',
      });
      this.logger.log(`OpenAI initialized (model: ${this.modelName})`);
    } else {
      this.logger.warn('OpenAI not configured — OPENAI_API_KEY missing');
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }

  async generate(
    prompt: string,
    options?: GenerateOptions,
  ): Promise<AiResponse> {
    if (!this.model) throw new Error('OpenAI not available');

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt)
      messages.push(new SystemMessage(options.systemPrompt));
    messages.push(new HumanMessage(prompt));

    const response = await this.model.invoke(messages);
    const usage = tokenUsageFromLc(response.usage_metadata as LcUsageMetadata);

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
    if (!this.model) throw new Error('OpenAI not available');

    const streamingModel = new ChatOpenAI({
      openAIApiKey: this.config.get<string>('OPENAI_API_KEY'),
      model: this.modelName,
      streaming: true,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens,
    });

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt)
      messages.push(new SystemMessage(options.systemPrompt));
    messages.push(new HumanMessage(prompt));

    const stream = await streamingModel.stream(messages);
    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string' && content) {
        yield content;
      }
    }
  }

  // ─── Document Intelligence ───────────────────────────────────────────────

  /**
   * OpenAI chat reads IMAGES (png/jpeg/webp/gif) natively via `image_url`, but
   * NOT PDFs in the chat API — so the pipeline routes PDFs through the
   * parse-to-text path and only hands images here. We advertise vision so the
   * registry routes image extraction to us; a stray `document` part throws.
   */
  supportsVision(): boolean {
    return this.model !== null;
  }

  supportsEmbedding(): boolean {
    return this.embeddings !== null;
  }

  /**
   * Structured extraction via OpenAI's JSON-schema structured-output mode
   * (forced — the model must return schema-shaped JSON). Works over text and/or
   * image parts in one message.
   */
  async extract<T>(
    input: MultimodalInput,
    schema: JsonSchema,
    options?: ExtractOptions,
  ): Promise<Structured<T>> {
    if (!this.model) throw new Error('OpenAI not available');

    const visionModel = new ChatOpenAI({
      openAIApiKey: this.config.get<string>('OPENAI_API_KEY'),
      model: this.visionModel,
      temperature: 0,
      maxRetries: 1,
    });

    const structured = visionModel.withStructuredOutput<Record<string, unknown>>(
      schema,
      {
        name: options?.schemaName ?? 'record_extraction',
        method: 'jsonSchema',
        includeRaw: true,
      },
    );

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt)
      messages.push(new SystemMessage(options.systemPrompt));
    messages.push(new HumanMessage({ content: this.toContent(input) }));

    const res = await structured.invoke(messages);
    const raw = res.raw as AIMessage;
    const usage = tokenUsageFromLc(
      raw?.usage_metadata as LcUsageMetadata | undefined,
    );

    return {
      data: res.parsed as T,
      tokensUsed: usage.totalTokens,
      usage,
      model: this.visionModel,
      provider: this.name,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) throw new Error('OpenAI embeddings not available');
    return this.embeddings.embedDocuments(texts);
  }

  /** Map our multimodal parts onto LangChain's content-block shape. */
  private toContent(input: MultimodalInput): HumanContent {
    const blocks = input.map((part) => {
      switch (part.kind) {
        case 'text':
          return { type: 'text', text: part.text };
        case 'image':
          return {
            type: 'image_url',
            image_url: { url: `data:${part.mediaType};base64,${part.data}` },
          };
        case 'document':
          throw new Error(
            'OpenAI chat cannot read PDFs directly — use the text-parse path or a vision provider for PDFs.',
          );
      }
    });
    // LangChain accepts these provider blocks at runtime; the v1 content union
    // is stricter than the legacy block shapes, so cast through unknown.
    return blocks as unknown as HumanContent;
  }
}
