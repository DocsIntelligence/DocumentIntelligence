import { Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import type {
  IParser,
  NormalizedDocument,
  SourceInput,
} from '@org/doc-intelligence';

const DOCX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** DOCX → plain text via mammoth (the standard, well-maintained DOCX reader). */
export class DocxParser implements IParser {
  readonly name = 'mammoth-docx';
  private readonly logger = new Logger(DocxParser.name);

  supports(contentType: string): boolean {
    return DOCX_TYPES.has(contentType);
  }

  async parse(input: SourceInput): Promise<NormalizedDocument> {
    const buffer = Buffer.from(input.data, 'base64');
    const { value } = await mammoth.extractRawText({ buffer });
    this.logger.debug(`mammoth extracted ${value.length} chars`);
    // DOCX has no fixed page model — treat the whole doc as one logical page.
    return {
      pages: [{ page: 1, text: value.trim() }],
      language: input.language,
      source: 'native_text',
    };
  }
}
