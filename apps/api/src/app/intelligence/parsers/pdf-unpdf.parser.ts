import { Logger } from '@nestjs/common';
import { extractText, getDocumentProxy } from 'unpdf';
import type {
  IParser,
  NormalizedDocument,
  SourceInput,
} from '@org/doc-intelligence';

/**
 * PDF text layer → per-page text via unpdf (a bundler/serverless-safe pdfjs
 * wrapper that ships its own pdfjs build — no worker/asset wiring needed). This
 * is the PRIMARY PDF parser; the pdf-parse parser is the fallback when this
 * yields too little text (ParsingService chains them).
 */
export class UnpdfParser implements IParser {
  readonly name = 'unpdf';
  private readonly logger = new Logger(UnpdfParser.name);

  supports(contentType: string): boolean {
    return contentType === 'application/pdf';
  }

  async parse(input: SourceInput): Promise<NormalizedDocument> {
    const bytes = new Uint8Array(Buffer.from(input.data, 'base64'));
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = text.map((t, i) => ({ page: i + 1, text: (t ?? '').trim() }));
    this.logger.debug(
      `unpdf extracted ${totalPages} pages, ${pages.reduce((n, p) => n + p.text.length, 0)} chars`,
    );
    return {
      pages,
      language: input.language,
      source: 'native_text',
    };
  }
}
