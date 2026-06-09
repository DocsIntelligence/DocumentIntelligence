import { Injectable, Logger } from '@nestjs/common';
import {
  EngineRegistry,
  type IParser,
  type NormalizedDocument,
  type SourceInput,
} from '@org/doc-intelligence';
import { errorMessage } from '../common/error.util';
import { DocxParser } from './parsers/docx.parser';
import { PdfParseParser } from './parsers/pdf-pdfparse.parser';
import { PlainTextParser } from './parsers/plaintext.parser';
import { UnpdfParser } from './parsers/pdf-unpdf.parser';

/** Below this many characters we treat a parse as "no usable text layer". */
const MIN_USABLE_CHARS = 24;

/**
 * The free, native-text fast path (docs/05 §4): turn an uploaded DOCX/PDF/text
 * file into a NormalizedDocument using **multiple parsing libraries with
 * fallback**. For PDFs, unpdf is tried first and pdf-parse second — if the
 * first yields too little text (tricky text layer), the second gets a shot
 * before we declare the document "scanned" and hand it to a vision/agentic
 * engine. Registry order = priority; same-format parsers chain as fallbacks.
 */
@Injectable()
export class ParsingService {
  private readonly logger = new Logger(ParsingService.name);
  private readonly registry = new EngineRegistry<IParser>();

  constructor() {
    this.registry
      .register(new DocxParser())
      .register(new UnpdfParser()) // primary PDF
      .register(new PdfParseParser()) // fallback PDF
      .register(new PlainTextParser());
  }

  /** True if any registered parser claims this content type. */
  canParse(contentType: string): boolean {
    return this.registry.list().some((p) => p.supports(contentType));
  }

  /**
   * Parse to text, trying every parser that supports the content type in
   * registry order. Returns the first result with a usable text layer; returns
   * null when no parser produces enough text (→ scanned → vision/agentic).
   * Every fallback hop is logged (no silent downgrade).
   */
  async parse(input: SourceInput): Promise<NormalizedDocument | null> {
    const candidates = this.registry
      .list()
      .filter((p) => p.supports(input.contentType));

    if (candidates.length === 0) {
      this.logger.warn(`No parser for content type ${input.contentType}`);
      return null;
    }

    let best: NormalizedDocument | null = null;
    let bestChars = 0;

    for (const parser of candidates) {
      try {
        const doc = await parser.parse(input);
        const chars = doc.pages.reduce((n, p) => n + p.text.length, 0);
        this.logger.debug(`${parser.name} → ${chars} chars`);
        if (chars >= MIN_USABLE_CHARS) return doc; // good enough, stop early
        if (chars > bestChars) {
          best = doc;
          bestChars = chars;
        }
        this.logger.warn(
          `${parser.name} yielded only ${chars} chars — trying next parser`,
        );
      } catch (e) {
        this.logger.warn(`${parser.name} failed: ${errorMessage(e)}`);
      }
    }

    // Nothing cleared the threshold. Return the best partial (may be null) so
    // the caller can decide: empty/null → treat as scanned.
    return bestChars > 0 ? best : null;
  }
}
