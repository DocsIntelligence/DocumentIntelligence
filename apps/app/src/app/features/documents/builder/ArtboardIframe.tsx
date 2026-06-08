import type { FieldClickEvent } from '@org/document-templates';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const ARTBOARD_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_ARTBOARD_URL ?? 'http://localhost:4210';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 0.85;
const clampZoom = (z: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

interface Props {
  componentKey: string;
  data: unknown;
  pageSize: string;
  language?: string;
  jurisdiction?: string | null;
  /**
   * Fired when a user clicks an EditableField inside the rendered template.
   * The `iframeRect` is supplied so the parent can position a popover at
   * the right screen coordinates without re-measuring.
   */
  onFieldClick?: (
    e: FieldClickEvent,
    iframeRect: { top: number; left: number },
  ) => void;
}

/**
 * Right pane. Embeds apps/artboard in an iframe and posts the current
 * document state on every change. The artboard signals readiness via
 * `{type:'artboard:ready'}`; field clicks come back as
 * `{type:'artboard:field-click', payload}`.
 *
 * Zoom matches the freeform editor's PaginatedPreview: corner ⊕/⊖ controls
 * (here) drive the zoom via `doc:zoom`; trackpad pinch / ctrl+wheel are handled
 * inside the iframe (it captures those events) and reported back as
 * `artboard:zoom` so the % indicator stays in sync. Scroll is native to the
 * artboard document.
 */
export function ArtboardIframe({
  componentKey,
  data,
  pageSize,
  language,
  jurisdiction,
  onFieldClick,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const zoomIn = () => setZoom((z) => clampZoom(z + 0.1));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.1));
  const reset = () => setZoom(DEFAULT_ZOOM);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'artboard:ready') {
        setReady(true);
        return;
      }
      if (msg.type === 'artboard:zoom') {
        if (typeof msg.payload?.zoom === 'number') setZoom(clampZoom(msg.payload.zoom));
        return;
      }
      if (msg.type === 'artboard:field-click' && onFieldClick) {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const r = iframe.getBoundingClientRect();
        onFieldClick(msg.payload as FieldClickEvent, {
          top: r.top,
          left: r.left,
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onFieldClick]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        type: 'doc:update',
        payload: { componentKey, data, pageSize, language, jurisdiction },
      },
      '*',
    );
  }, [componentKey, data, pageSize, language, jurisdiction, ready]);

  // Push zoom changes (from the buttons here) into the iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: 'doc:zoom', payload: { zoom } }, '*');
  }, [zoom, ready]);

  return (
    <div className="relative h-full overflow-auto bg-foreground/5">
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

      <iframe
        ref={iframeRef}
        title="Document preview"
        src={ARTBOARD_URL}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full border-0 bg-white"
      />
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
