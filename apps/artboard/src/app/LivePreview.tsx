import {
  TemplateRenderer,
  type FieldClickEvent,
  type PageSizeKey,
} from '@org/document-templates';
import { useEffect, useState } from 'react';

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
}

const DEFAULT_STATE: PreviewState = {
  componentKey: 'rent-agreement.classic',
  data: {},
  pageSize: 'a4',
};

export function LivePreview() {
  const [state, setState] = useState<PreviewState>(DEFAULT_STATE);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type !== 'doc:update') return;
      const { componentKey, data, pageSize } = msg.payload ?? {};
      if (!componentKey || !pageSize) return;
      setState({ componentKey, data, pageSize });
    }
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'artboard:ready' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function onFieldClick(e: FieldClickEvent) {
    window.parent?.postMessage(
      { type: 'artboard:field-click', payload: e },
      '*',
    );
  }

  return (
    <TemplateRenderer
      componentKey={state.componentKey}
      data={state.data}
      pageSize={state.pageSize}
      editable
      onFieldClick={onFieldClick}
    />
  );
}
