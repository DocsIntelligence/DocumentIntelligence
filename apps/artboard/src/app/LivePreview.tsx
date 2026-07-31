import {
  TemplateRenderer,
  type FieldClickEvent,
  type PageSizeKey,
} from '@org/document-templates';
import { useEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const clampZoom = (z: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

/**
 * Live-preview screen. Embedded inside the builder UI as an iframe. The
 * parent posts `{ type: 'doc:update', payload: { componentKey, data,
 * pageSize } }` whenever the form changes.
 *
 * Editable mode: every <EditableField> in the template is clickable. On
 * click we post `{ type: 'artboard:field-click', payload }` back to the
 * parent so it can render an in-place popover. Coordinates in `rect` are
 * in the iframe's *viewport* (post-scroll), so the parent must offset by
 * the iframe element's own bounding rect.
 *
 * No authentication required — the iframe only renders what its host
 * sends it. It never fetches from the API.
 */

interface PreviewState {
  componentKey: string;
  data: unknown;
  pageSize: PageSizeKey;
  headerText?: string;
  footerText?: string;
}

const DEFAULT_STATE: PreviewState = {
  componentKey: 'rent-agreement.classic',
  data: {},
  pageSize: 'a4',
};

export function LivePreview() {
  const [state, setState] = useState<PreviewState>(DEFAULT_STATE);
  // Zoom is owned jointly with the host: the host's buttons send `doc:zoom`;
  // trackpad/touch gestures (which the iframe captures, not the host) are
  // handled here and reported back via `artboard:zoom`.
  const [zoom, setZoom] = useState(0.85);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Apply + report a new zoom in one place so host and iframe stay in sync.
  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    window.parent?.postMessage(
      { type: 'artboard:zoom', payload: { zoom: z } },
      '*',
    );
  };

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'doc:zoom') {
        if (typeof msg.payload?.zoom === 'number')
          setZoom(clampZoom(msg.payload.zoom));
        return;
      }
      if (msg.type !== 'doc:update') return;
      const { componentKey, data, pageSize, headerText, footerText } =
        msg.payload ?? {};
      if (!componentKey || !pageSize) return;
      setState({ componentKey, data, pageSize, headerText, footerText });
    }
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'artboard:ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Pinch / ctrl+wheel zoom (mirrors the freeform PaginatedPreview gestures).
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad pinch / ctrl+wheel only
      e.preventDefault();
      applyZoom(zoomRef.current - e.deltaY * 0.01);
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
      applyZoom(base.zoom * (dist / base.dist));
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  function onFieldClick(e: FieldClickEvent) {
    window.parent?.postMessage(
      { type: 'artboard:field-click', payload: e },
      '*',
    );
  }

  return (
    <div style={{ zoom }}>
      <TemplateRenderer
        componentKey={state.componentKey}
        data={state.data}
        pageSize={state.pageSize}
        headerText={state.headerText}
        footerText={state.footerText}
        editable
        onFieldClick={onFieldClick}
      />
    </div>
  );
}
