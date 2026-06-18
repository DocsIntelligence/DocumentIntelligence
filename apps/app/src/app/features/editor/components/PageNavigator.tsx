import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@org/ui';
import { cn } from '@org/utils';

export type PageNavigatorProps = {
  html: string;
  onJumpToPage: (pageIndex: number) => void;
  onAddPage: () => void;
  onRemovePage: (pageIndex: number) => void;
  activePage?: number;
};

/**
 * Lists the pages of the document by counting `data-page-break` markers in
 * the current HTML, with controls to add, remove, and jump to each.
 */
export function PageNavigator({
  html,
  onJumpToPage,
  onAddPage,
  onRemovePage,
  activePage,
}: PageNavigatorProps) {
  const { t } = useTranslation();
  const pages = useMemo(() => extractPagePreviews(html), [html]);

  return (
    <div className="flex flex-col gap-2 px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/55">
          {t('editor.pages.heading', 'Pages ({{count}})', {
            count: pages.length,
          })}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onAddPage}
        >
          <span className="text-sm leading-none">+</span>{' '}
          {t('editor.pages.add', 'Add Page')}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {pages.map((preview, i) => (
          <div
            key={i}
            className={cn(
              'group flex items-stretch overflow-hidden rounded-md border border-border bg-background transition-colors',
              activePage === i && 'border-primary/60 ring-1 ring-primary/40',
            )}
          >
            <button
              type="button"
              onClick={() => onJumpToPage(i)}
              className="flex flex-1 items-start gap-2 px-2 py-2 text-left hover:bg-secondary/40"
            >
              <span className="flex size-7 flex-none items-center justify-center rounded bg-secondary/60 text-[11px] font-semibold text-foreground/70">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {preview.title ||
                    t('editor.pages.pageN', 'Page {{n}}', { n: i + 1 })}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[10px] text-foreground/55">
                  {preview.snippet || t('editor.pages.empty', '(empty)')}
                </div>
              </div>
            </button>
            {pages.length > 1 && (
              <button
                type="button"
                onClick={() => onRemovePage(i)}
                className="flex w-7 flex-none items-center justify-center text-foreground/40 opacity-0 transition-all hover:bg-error/50 hover:text-error group-hover:opacity-100"
                title={t('editor.pages.remove', 'Remove page')}
                aria-label={t('editor.pages.removeN', 'Remove page {{n}}', {
                  n: i + 1,
                })}
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-1 text-[10px] leading-relaxed text-foreground/45">
        {t('editor.pages.tipPrefix', 'Tip: press')}{' '}
        <kbd className="rounded bg-secondary/40 px-1">Ctrl</kbd>+
        <kbd className="rounded bg-secondary/40 px-1">Enter</kbd>{' '}
        {t(
          'editor.pages.tipSuffix',
          'in the editor to insert a page break at the cursor.',
        )}
      </p>
    </div>
  );
}

type PagePreview = {
  title: string;
  snippet: string;
};

/** Pull a heading + a snippet of text from each page (split on page-break markers). */
function extractPagePreviews(html: string): PagePreview[] {
  const re = /<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi;
  const parts = html.split(re);
  const cleaned = parts.length === 0 ? [''] : parts;
  return cleaned.map((part) => {
    const titleMatch = part.match(/<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/i);
    const title = titleMatch ? stripTags(titleMatch[2]).slice(0, 60) : '';
    const text = stripTags(part).replace(/\s+/g, ' ').trim();
    return {
      title,
      snippet: text.slice(0, 100),
    };
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
}
