import { Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import type {
  IParser,
  NormalizedDocument,
  SourceInput,
} from '@org/doc-intelligence';

/**
 * PDF text layer → per-page text via pdf-parse (v2). FALLBACK PDF parser — used
 * when unpdf returns too little text, since the two pdfjs-based readers
 * sometimes disagree on tricky text layers. A second independent attempt is
 * cheap insurance before declaring a PDF "scanned" and routing it to vision.
 */
export class PdfParseParser implements IParser {
  readonly name = 'pdf-parse';
  private readonly logger = new Logger(PdfParseParser.name);

  supports(contentType: string): boolean {
    return contentType === 'application/pdf';
  }

  async parse(input: SourceInput): Promise<NormalizedDocument> {
    const data = new Uint8Array(Buffer.from(input.data, 'base64'));
    const parser = new PDFParse(
      input.password ? { data, password: input.password } : { data },
    );
    try {
      const result = await parser.getText();
      const pages = result.pages.map((p) => ({
        page: p.num,
        text: (p.text ?? '').trim(),
      }));
      this.logger.debug(
        `pdf-parse extracted ${result.total} pages, ${result.text.length} chars`,
      );
      return {
        pages: pages.length ? pages : [{ page: 1, text: result.text.trim() }],
        language: input.language,
        source: 'native_text',
      };
    } finally {
      await parser.destroy();
    }
  }
}
