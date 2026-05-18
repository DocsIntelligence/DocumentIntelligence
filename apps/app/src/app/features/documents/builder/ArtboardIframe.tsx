import type { FieldClickEvent } from '@org/document-templates';
import { useEffect, useRef, useState } from 'react';

const ARTBOARD_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_ARTBOARD_URL ?? 'http://localhost:4210';

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

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (ev.source !== iframeRef.current?.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'artboard:ready') {
        setReady(true);
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

  return (
    <div className="h-full bg-foreground/5 overflow-auto">
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
