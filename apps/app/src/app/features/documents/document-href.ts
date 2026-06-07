/**
 * Where a document opens depends on its kind:
 *  - `freeform` (editor / AI drafts) → the rich-text editor at /documents/:id/draft
 *  - everything else (schema-driven types) → the structured builder at /documents/:id/edit
 */
export function documentHref(d: {
  id: string;
  documentType?: { key?: string | null } | null;
}): string {
  return d.documentType?.key === 'freeform'
    ? `/documents/${d.id}/draft`
    : `/documents/${d.id}/edit`;
}
