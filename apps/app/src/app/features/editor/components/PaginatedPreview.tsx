import { useMemo } from 'react';
import { cn } from '@org/utils';
import { renderTemplateHtml } from '@org/ui';

export type PaginatedPreviewProps = {
  html: string;
  values: Record<string, string>;
  className?: string;
};

/**
 * Render a Tiptap HTML document split into A4 pages on `<div data-page-break>` markers.
 * Tokens like `{{key}}` are replaced with the supplied values.
 */
export function PaginatedPreview({
  html,
  values,
  className,
}: PaginatedPreviewProps) {
  const pages = useMemo(() => splitOnPageBreaks(html), [html]);

  return (
    <div
      className={cn(
        'flex min-h-full flex-col items-center gap-6 bg-zinc-100 px-6 py-8 dark:bg-zinc-900',
        className,
      )}
    >
      {pages.map((pageHtml, i) => (
        <div key={i} className="relative w-full max-w-[210mm]">
          <div
            className="min-h-[297mm] w-full rounded-sm bg-white text-zinc-900 shadow-lg"
            style={{ padding: '20mm 18mm 18mm 18mm' }}
          >
            <div
              className="document-preview-page"
              dangerouslySetInnerHTML={{
                __html: renderTemplateHtml(pageHtml, values),
              }}
            />
          </div>
          <div className="mt-1.5 text-center text-[11px] font-medium text-foreground/45">
            Page {i + 1} of {pages.length}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Split top-level HTML at every `<div data-page-break>...</div>` block. */
function splitOnPageBreaks(html: string): string[] {
  if (!html) return [''];
  const re = /<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi;
  const parts = html.split(re);
  // Drop trailing empty pages (e.g. from a closing pagebreak) but keep at least one
  const cleaned = parts
    .map((p) => p.trim())
    .filter((p, i, arr) => i === 0 || p.length > 0 || arr.length === 1);
  return cleaned.length > 0 ? cleaned : [''];
}
