import { Page, PagePrintStyles } from '../_internals/Page';
import type { TemplateProps } from '../_registry';

/**
 * Freeform document template — renders editor-authored / AI-generated HTML
 * (componentKey `freeform`). The body is raw HTML with `{{placeholder}}`
 * tokens; `<div data-page-break>` markers split it into pages. This is what
 * makes the standard PDF pipeline (Puppeteer → artboard /render) work for
 * documents that don't have a fixed schema-driven template.
 */
export interface FreeformData {
  html?: string;
  values?: Record<string, string>;
}

export function FreeformDocument({
  data,
  pageSize,
}: TemplateProps<FreeformData>) {
  const values = data?.values ?? {};
  const filled = fillPlaceholders(data?.html ?? '', values);
  const pages = splitOnPageBreaks(filled);

  return (
    <>
      <PagePrintStyles pageSize={pageSize} />
      {pages.map((pageHtml, i) => (
        <Page
          key={i}
          pageSize={pageSize}
          isFirst={i === 0}
          pageNumber={i + 1}
          totalPages={pages.length}
        >
          <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
        </Page>
      ))}
    </>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function fillPlaceholders(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key: string) => {
    const v = values[key];
    return v && v.trim()
      ? escapeHtml(v)
      : `<span style="background:#fef3c7;color:#92400e;padding:0 2px;border-radius:2px">[${escapeHtml(
          key,
        )}]</span>`;
  });
}

/** Split top-level HTML at every `<div data-page-break ...>...</div>` marker. */
function splitOnPageBreaks(html: string): string[] {
  if (!html) return [''];
  const parts = html.split(/<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi);
  const cleaned = parts
    .map((p) => p.trim())
    .filter((p, i, arr) => i === 0 || p.length > 0 || arr.length === 1);
  return cleaned.length > 0 ? cleaned : [''];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
