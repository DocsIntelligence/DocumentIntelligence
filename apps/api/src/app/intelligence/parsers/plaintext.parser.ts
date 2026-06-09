import type {
  IParser,
  NormalizedDocument,
  SourceInput,
} from '@org/doc-intelligence';

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
]);

/** Plain-text / markdown — decode UTF-8 directly, no library needed. */
export class PlainTextParser implements IParser {
  readonly name = 'plaintext';

  supports(contentType: string): boolean {
    return TEXT_TYPES.has(contentType);
  }

  async parse(input: SourceInput): Promise<NormalizedDocument> {
    const text = Buffer.from(input.data, 'base64').toString('utf8').trim();
    return {
      pages: [{ page: 1, text }],
      language: input.language,
      source: 'native_text',
    };
  }
}
