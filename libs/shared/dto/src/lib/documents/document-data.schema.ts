import { z } from 'zod';

/**
 * Schema for a freeform Document's `data` JSON blob — the payload the editor
 * persists and reloads. It is the single source of truth shared by the React
 * editor (`apps/app`) and the API, so both agree on the shape of what's stored
 * under `Document.data` for `documentTypeKey: 'freeform'`.
 *
 * A freeform document is authored in one of two surfaces, distinguished by
 * `format`:
 *  - `richtext` (default): the TipTap WYSIWYG editor — `html` is canonical.
 *  - `markdown`: the Markdown editor — `markdown` is canonical and `html` is
 *    the rendered projection kept in sync so the PDF / Word / share / preview
 *    pipeline (all HTML-based) keeps working unchanged.
 */

/** Which authoring surface produced the document. */
export const documentFormatSchema = z.enum(['richtext', 'markdown']);
export type DocumentFormat = z.infer<typeof documentFormatSchema>;

/** Form-field input controls for `{{placeholder}}` tokens. */
export const placeholderTypeSchema = z.enum([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'email',
]);
export type PlaceholderType = z.infer<typeof placeholderTypeSchema>;

export const placeholderOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type PlaceholderOption = z.infer<typeof placeholderOptionSchema>;

/** A typed definition for a document placeholder/field. */
export const placeholderDefSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: placeholderTypeSchema,
  hint: z.string().optional(),
  placeholder: z.string().optional(),
  default: z.string().optional(),
  options: z.array(placeholderOptionSchema).optional(),
  wide: z.boolean().optional(),
});
export type PlaceholderDef = z.infer<typeof placeholderDefSchema>;

/**
 * The `data` blob of a freeform / markdown document. `html` is always present
 * (canonical for richtext, derived for markdown); `markdown` is present only
 * for markdown documents.
 */
export const freeformDocumentDataSchema = z.object({
  /** Authoring surface; absent on legacy docs is treated as `richtext`. */
  format: documentFormatSchema.optional(),
  /** Rendered HTML — what the preview / export / share pipeline consumes. */
  html: z.string().default(''),
  /** Canonical Markdown source (markdown documents only). */
  markdown: z.string().optional(),
  /** Values for `{{placeholder}}` tokens, keyed by placeholder key. */
  values: z.record(z.string(), z.string()).optional(),
  /** Gallery template id this draft started from, if any. */
  templateId: z.string().optional(),
  /** Document-level font family (any Google Fonts family). */
  fontFamily: z.string().optional(),
  /** Typed field defs for the document's tokens. */
  fields: z.array(placeholderDefSchema).optional(),
});
export type FreeformDocumentData = z.infer<typeof freeformDocumentDataSchema>;

/** True when a document's `data` was authored in the Markdown editor. */
export function isMarkdownDocumentData(
  data: Pick<FreeformDocumentData, 'format'> | null | undefined,
): boolean {
  return data?.format === 'markdown';
}
