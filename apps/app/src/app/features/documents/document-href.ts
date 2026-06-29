/**
 * Where a document opens depends on its kind:
 *  - `freeform` authored as Markdown (`data.format === 'markdown'`) → the
 *    Markdown editor at /documents/:id/markdown
 *  - `freeform` (editor / AI drafts) → the rich-text editor at /documents/:id/draft
 *  - everything else (schema-driven types) → the structured builder at /documents/:id/edit
 *
 * `data` is only present on the detail response (the list omits it); when it's
 * absent a Markdown freeform doc falls back to the rich-text draft editor,
 * which reads the same persisted `data.html`.
 */
import { isMarkdownDocumentData } from '@org/dto';

export function documentHref(d: {
  id: string;
  documentType?: { key?: string | null } | null;
  data?: { format?: unknown } | null;
}): string {
  if (d.documentType?.key === 'freeform') {
    return isMarkdownDocumentData(d.data as { format?: 'markdown' } | null)
      ? `/documents/${d.id}/markdown`
      : `/documents/${d.id}/draft`;
  }
  return `/documents/${d.id}/edit`;
}
