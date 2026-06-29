import { isMarkdownDocumentData } from '@org/dto';

/**
 * The label shown for a document's "type". Markdown-authored freeform documents
 * read as "Markdown" rather than the shared "Freeform" type name; everything
 * else uses its document-type name. Rich-text / AI freeform docs stay
 * "Freeform" — only the surface that produced markdown is relabelled.
 */
export function documentTypeLabel(
  d: {
    documentType?: { key?: string | null; name?: string | null } | null;
    data?: { format?: unknown } | null;
  },
  fallback = 'Document',
): string {
  if (
    d.documentType?.key === 'freeform' &&
    isMarkdownDocumentData(d.data as { format?: 'markdown' } | null)
  ) {
    return 'Markdown';
  }
  return d.documentType?.name ?? fallback;
}

/**
 * The secondary "template" label shown under a document title. Markdown docs
 * read as "Markdown" instead of the shared "Freeform" template name; everything
 * else uses its template name.
 */
export function documentTemplateLabel(
  d: {
    template?: { name?: string | null } | null;
    data?: { format?: unknown } | null;
  },
  fallback = '—',
): string {
  if (isMarkdownDocumentData(d.data as { format?: 'markdown' } | null)) {
    return 'Markdown';
  }
  return d.template?.name ?? fallback;
}
