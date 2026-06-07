import { useMemo, type ReactNode } from 'react';
import { cn } from '@org/utils';
import { renderTemplateHtml } from '@org/ui';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export type PaginatedPreviewProps = {
  html: string;
  values: Record<string, string>;
  className?: string;
};

/**
 * Render a Tiptap HTML document split into A4 pages on `<div data-page-break>`
 * markers. Tokens like `{{key}}` are replaced with the supplied values. The
 * page stack is zoom/pan/pinch-able (scroll to zoom, drag to pan) with a small
 * control cluster — better than a fixed-scale preview for dense documents.
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
        'relative h-full min-h-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900',
        className,
      )}
    >
      <TransformWrapper
        minScale={0.25}
        maxScale={3}
        initialScale={0.75}
        centerOnInit
        centerZoomedOut
        wheel={{ step: 0.08 }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
              <ZoomButton label="Zoom out" onClick={() => zoomOut()}>
                <MinusIcon />
              </ZoomButton>
              <ZoomButton label="Fit" onClick={() => resetTransform()}>
                <FitIcon />
              </ZoomButton>
              <ZoomButton label="Zoom in" onClick={() => zoomIn()}>
                <PlusIcon />
              </ZoomButton>
            </div>

            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
            >
              <div className="flex flex-col items-center gap-6 p-8">
                {pages.map((pageHtml, i) => (
                  <div key={i} className="relative w-[210mm] flex-none">
                    <div
                      className="min-h-[297mm] w-full rounded-sm bg-white text-zinc-900 shadow-xl"
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
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-secondary/70 hover:text-foreground"
    >
      {children}
    </button>
  );
}

/** Split top-level HTML at every `<div data-page-break>...</div>` block. */
function splitOnPageBreaks(html: string): string[] {
  if (!html) return [''];
  const re = /<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi;
  const parts = html.split(re);
  const cleaned = parts
    .map((p) => p.trim())
    .filter((p, i, arr) => i === 0 || p.length > 0 || arr.length === 1);
  return cleaned.length > 0 ? cleaned : [''];
}

function MinusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function FitIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
