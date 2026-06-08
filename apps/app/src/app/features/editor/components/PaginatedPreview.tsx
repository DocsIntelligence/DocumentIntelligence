import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@org/utils';
import { renderTemplateHtml } from '@org/ui';
import { pageProfiles, type PageSizeKey } from '@org/document-templates';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 0.85;

export type PaginatedPreviewProps = {
  html: string;
  values: Record<string, string>;
  /** Paper size — drives page dimensions, margins, and stamp-paper reserved zone. */
  pageSize?: PageSizeKey;
  className?: string;
};

/**
 * Document preview: pages at the selected paper size, dimensions from the
 * shared `pageProfiles` so the preview matches the exported PDF.
 *
 * Gestures (deliberate, not react-zoom-pan-pinch — that library treats
 * trackpad scroll as zoom):
 *   - plain wheel / two-finger scroll → scrolls the document (native)
 *   - pinch (trackpad pinch = ctrl+wheel, or touch pinch) → zoom
 *   - no drag-to-pan
 */
export function PaginatedPreview({
  html,
  values,
  pageSize = 'a4',
  className,
}: PaginatedPreviewProps) {
  const pages = useMemo(() => splitOnPageBreaks(html), [html]);
  const p = pageProfiles[pageSize] ?? pageProfiles.a4;

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const clamp = (z: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
  const zoomIn = () => setZoom((z) => clamp(z + 0.1));
  const zoomOut = () => setZoom((z) => clamp(z - 0.1));
  const reset = () => setZoom(DEFAULT_ZOOM);

  // Native (non-passive) listeners so we can preventDefault on pinch only.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // ctrlKey is set by the browser for trackpad pinch and ctrl+wheel.
      if (e.ctrlKey) {
        e.preventDefault();
        setZoom((z) => clamp(z - e.deltaY * 0.01));
      }
      // otherwise: let the container scroll natively.
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const base = pinch.current;
      if (!base) {
        pinch.current = { dist, zoom: zoomRef.current };
        return;
      }
      e.preventDefault();
      setZoom(() => clamp(base.zoom * (dist / base.dist)));
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative h-full min-h-0 bg-zinc-100 dark:bg-zinc-900',
        className,
      )}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
        <ZoomButton label="Zoom out" onClick={zoomOut}>
          <MinusIcon />
        </ZoomButton>
        <button
          type="button"
          title="Reset zoom"
          onClick={reset}
          className="min-w-10 rounded-md px-1 text-[11px] font-medium text-foreground/60 hover:bg-secondary/70 hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <ZoomButton label="Zoom in" onClick={zoomIn}>
          <PlusIcon />
        </ZoomButton>
      </div>

      <div
        ref={scrollRef}
        className="h-full w-full overflow-auto"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        <div
          className="flex flex-col items-center gap-6 p-8"
          style={{ zoom, width: 'max-content', minWidth: '100%' }}
        >
          {pages.map((pageHtml, i) => {
            const reservedTop = i === 0 ? p.reservedTopMm : 0;
            return (
              <div key={i} className="flex-none">
                <div
                  className="relative bg-white text-zinc-900 shadow-xl"
                  style={{
                    width: `${p.widthMm}mm`,
                    minHeight: `${p.heightMm}mm`,
                    boxSizing: 'border-box',
                    paddingTop: `${reservedTop + p.marginTopMm}mm`,
                    paddingRight: `${p.marginRightMm}mm`,
                    paddingBottom: `${p.marginBottomMm}mm`,
                    paddingLeft: `${p.marginLeftMm}mm`,
                  }}
                >
                  {reservedTop > 0 && (
                    <div
                      className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-dashed border-amber-400/70 bg-amber-50/60 text-[10px] font-medium uppercase tracking-wide text-amber-700"
                      style={{ height: `${reservedTop}mm` }}
                    >
                      Pre-printed stamp area — kept clear
                    </div>
                  )}
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
            );
          })}
        </div>
      </div>
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
    .map((s) => s.trim())
    .filter((s, i, arr) => i === 0 || s.length > 0 || arr.length === 1);
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
