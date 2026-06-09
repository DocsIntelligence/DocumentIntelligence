import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  type ExtractionRequest,
  type ExtractionResult,
  type IExtractionEngine,
  type NormalizedDocument,
  type SourceInput,
} from '@org/doc-intelligence';
import type { AiService } from '../../ai/ai.service';
import { VlmExtractionEngine } from './vlm-extraction.engine';

/**
 * Premium, **vendor-agnostic** agentic extraction engine (docs/05 §4, §5 —
 * "paid agent AI … configurable"). A hosted agentic document parser
 * (LlamaParse / Reducto / a self-hosted service) reads the document at high
 * fidelity (layout, tables, scanned/Hindi) and returns clean markdown/text;
 * we then run the **same** schema-driven structured extraction over that text.
 *
 * Configurable entirely via env — point it at any vendor without code changes:
 *   EXTRACTION_AGENTIC_BASE_URL    POST endpoint (synchronous JSON contract)
 *   EXTRACTION_AGENTIC_API_KEY     bearer token
 *   EXTRACTION_AGENTIC_MODEL       optional model/preset sent in the body
 *   EXTRACTION_AGENTIC_RESPONSE_PATH  dot-path to the text in the JSON response
 *                                  (e.g. "markdown", "data.text"); auto-detected
 *                                  from common fields when unset
 *   EXTRACTION_AGENTIC_PROVIDER    label for telemetry (e.g. "llamaparse")
 *
 * The request contract is a single JSON POST `{ filename, contentType, data
 * (base64), model }`. Vendors with async/multipart/polling APIs need a small
 * adapter tweak here — the seam is isolated to `callAgenticParser`.
 */
export class AgenticExtractionEngine implements IExtractionEngine {
  readonly name = 'agentic';
  private readonly logger = new Logger(AgenticExtractionEngine.name);
  private readonly delegate: VlmExtractionEngine;

  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly model?: string;
  private readonly responsePath?: string;
  readonly provider: string;

  constructor(
    private readonly config: ConfigService,
    ai: AiService,
  ) {
    this.delegate = new VlmExtractionEngine(ai);
    this.baseUrl = this.config.get<string>('EXTRACTION_AGENTIC_BASE_URL');
    this.apiKey = this.config.get<string>('EXTRACTION_AGENTIC_API_KEY');
    this.model = this.config.get<string>('EXTRACTION_AGENTIC_MODEL');
    this.responsePath = this.config.get<string>(
      'EXTRACTION_AGENTIC_RESPONSE_PATH',
    );
    this.provider =
      this.config.get<string>('EXTRACTION_AGENTIC_PROVIDER') ?? 'agentic';
  }

  /** True only when the adapter is configured — gates registry selection. */
  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async extract(req: ExtractionRequest): Promise<ExtractionResult> {
    if (!req.source) {
      throw new Error('Agentic engine requires source bytes');
    }
    if (!this.isConfigured()) {
      throw new Error('Agentic engine not configured');
    }

    const text = await this.callAgenticParser(req.source);
    const document: NormalizedDocument = {
      pages: [{ page: 1, text }],
      language: req.source.language,
      source: 'vlm',
    };
    this.logger.debug(
      `${this.provider} parsed ${text.length} chars; delegating to structured extract`,
    );
    // Structured extraction over the high-fidelity text (default provider).
    return this.delegate.extract({ schema: req.schema, document });
  }

  /** The isolated vendor seam: POST bytes, return high-fidelity text. */
  private async callAgenticParser(source: SourceInput): Promise<string> {
    const res = await axios.post(
      this.baseUrl as string,
      {
        filename: source.filename,
        contentType: source.contentType,
        data: source.data, // base64
        ...(this.model ? { model: this.model } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
        maxBodyLength: Infinity,
      },
    );
    const text = this.extractText(res.data);
    if (!text) {
      throw new Error(
        `Agentic parser returned no text (check EXTRACTION_AGENTIC_RESPONSE_PATH)`,
      );
    }
    return text;
  }

  /** Pull the text out of a vendor response — configured path or common fields. */
  private extractText(data: unknown): string {
    if (typeof data === 'string') return data;
    if (this.responsePath) {
      const v = this.responsePath
        .split('.')
        .reduce<unknown>(
          (node, key) =>
            node && typeof node === 'object'
              ? (node as Record<string, unknown>)[key]
              : undefined,
          data,
        );
      return typeof v === 'string' ? v : '';
    }
    // Auto-detect common high-fidelity-text fields across vendors.
    const obj = (data ?? {}) as Record<string, unknown>;
    for (const key of ['markdown', 'text', 'content', 'result', 'data']) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return v;
      if (v && typeof v === 'object') {
        const nested = this.extractText(v);
        if (nested) return nested;
      }
    }
    return '';
  }
}
