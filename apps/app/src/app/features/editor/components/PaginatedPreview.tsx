import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from '@org/utils';
import { renderTemplateHtml } from '@org/ui';
import {
  pageProfiles,
  paginateChunks,
  splitHtmlOnPageBreaks,
  useFontsReady,
  useGoogleFont,
  debugMeasure,
  formatPaginationDebug,
  isPaginationDebug,
  type PageSizeKey,
} from '@org/document-templates';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 0.85;

export type PaginatedPreviewProps = {
  html: string;
  values: Record<string, string>;
  /** Paper size — drives page dimensions, margins, and stamp-paper reserved zone. */
  pageSize?: PageSizeKey;
  /** Extra already-rendered HTML appended after the body (e.g. signatures + audit). */
  appendHtml?: string;
  /** Document-level font (any Google Fonts family). Loaded on demand; applied
   *  via the `--doc-font` CSS var. Must match what the exported PDF uses. */
  fontFamily?: string;
  /** Currently-selected page (0-based) — highlighted and scrolled into view. */
  activePage?: number;
  /** Called when the user clicks a page, so selection stays in sync elsewhere. */
  onSelectPage?: (index: number) => void;
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
  appendHtml,
  fontFamily,
  activePage,
  onSelectPage,
  className,
}: PaginatedPreviewProps) {
  const docFont = fontFamily?.trim() || undefined;
  const chunks = useMemo(
    () => splitHtmlOnPageBreaks(appendHtml ? html + appendHtml : html),
    [html, appendHtml],
  );
  const p = pageProfiles[pageSize] ?? pageProfiles.a4;
  const valuesKey = useMemo(() => JSON.stringify(values), [values]);

  // Auto-pagination via the SHARED paginator (same algorithm the artboard PDF
  // renderer uses) so the preview and the exported PDF break identically.
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<string[]>(() =>
    chunks.map((c) => renderTemplateHtml(c, values)),
  );

  // Re-measure once the document fonts have loaded — measuring against a system
  // fallback breaks pages at the wrong place (and disagrees with the PDF).
  const fontsReady = useFontsReady();
  // The chosen Google font must also be loaded before measuring.
  const docFontReady = useGoogleFont(docFont);

  useLayoutEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const filled = chunks.map((c) => renderTemplateHtml(c, values));
    const next = paginateChunks(host, filled, p);
    setPages(next);
    if (isPaginationDebug() && fontsReady && docFontReady) {
      console.log(
        formatPaginationDebug(
          debugMeasure(host, filled, p, 'PREVIEW/APP', next.length),
        ),
      );
    }
  }, [chunks, valuesKey, pageSize, p, values, fontsReady, docFontReady]);

  // Per-document font applied to the measuring host and the visible pages (both
  // descend from the container below) via the --doc-font custom property.
  const docFontStyle = docFont
    ? ({ '--doc-font': `'${docFont.replace(/'/g, '')}'` } as CSSProperties)
    : undefined;

  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Scroll the selected page into view when the selection changes elsewhere
  // (Pages panel / editor caret), keeping all three surfaces in sync.
  useEffect(() => {
    if (activePage == null) return;
    const el = pageEls.current[activePage];
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [activePage, pages.length]);

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
        'relative h-full min-h-0 bg-muted',
        className,
      )}
      style={docFontStyle}
    >
      {/* Offscreen measuring host for auto-pagination (not visible). */}
      <div
        ref={measureRef}
        aria-hidden
        className="document-preview-page"
        style={{
          position: 'absolute',
          left: '-99999px',
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      />

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
            const isActive = activePage === i;
            return (
              <div
                key={i}
                ref={(el) => {
                  pageEls.current[i] = el;
                }}
                className="flex-none scroll-mt-8"
              >
                <div
                  onClick={onSelectPage ? () => onSelectPage(i) : undefined}
                  className={cn(
                    'relative bg-white text-zinc-900 shadow-xl outline-2 outline-offset-2 transition-[outline-color]',
                    onSelectPage && 'cursor-pointer',
                    isActive ? 'outline-primary' : 'outline-transparent',
                  )}
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
                      className="absolute inset-x-0 top-0 flex items-center justify-center border-b border-dashed border-warning/70 bg-warning/10 text-[10px] font-medium uppercase tracking-wide text-warning"
                      style={{ height: `${reservedTop}mm` }}
                    >
                      Pre-printed stamp area — kept clear
                    </div>
                  )}
                  <div
                    className="document-preview-page"
                    dangerouslySetInnerHTML={{ __html: pageHtml }}
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

function MinusIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
