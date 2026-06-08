import { TemplateRenderer, type PageSizeKey } from '@org/document-templates';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/**
 * Server-render entry. The PDF worker (Puppeteer) navigates to
 *   /render/:componentKey?docId=...&token=...
 * and waits for `window.__ARTBOARD_READY__ === true` before invoking
 * `page.pdf()`.
 *
 * Data is resolved in priority order:
 *   1. `window.__ARTBOARD_DATA__` — injected by the PDF worker via
 *      `page.evaluateOnNewDocument` (no URL size limit; avoids HTTP 431).
 *   2. `?data=` URL-encoded JSON — convenient for local dev / older callers.
 *   3. `?docId=&token=` — fetch the render-payload from the API with an
 *      internal service token (not the user's session).
 */

interface RenderState {
  data: unknown;
  pageSize: PageSizeKey;
}

const VALID_PAGE_SIZES: PageSizeKey[] = [
  'a4',
  'legal',
  'foolscap',
  'stamp_paper_in_10',
  'stamp_paper_in_20',
  'stamp_paper_in_50',
  'stamp_paper_in_100',
  'stamp_paper_in_500',
];

function isPageSize(v: string | null): v is PageSizeKey {
  return v !== null && (VALID_PAGE_SIZES as string[]).includes(v);
}

declare global {
  interface Window {
    __ARTBOARD_READY__?: boolean;
    __ARTBOARD_ERROR__?: string;
    /** Document data injected by the PDF worker (avoids a huge ?data= URL). */
    __ARTBOARD_DATA__?: unknown;
  }
}

export function RenderRoute() {
  const { componentKey = '' } = useParams();
  const [search] = useSearchParams();
  const [state, setState] = useState<RenderState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const dataParam = search.get('data');
      const docId = search.get('docId');
      const token = search.get('token');
      const pageSizeParam = search.get('pageSize');

      const pageSize: PageSizeKey = isPageSize(pageSizeParam)
        ? pageSizeParam
        : 'a4';

      try {
        // Preferred path: the PDF worker injects the data as a global before
        // any script runs (no URL size limit → no HTTP 431 on big docs).
        if (window.__ARTBOARD_DATA__ !== undefined) {
          if (!cancelled)
            setState({ data: window.__ARTBOARD_DATA__, pageSize });
          return;
        }

        if (dataParam) {
          // URL-encoded JSON (UTF-8 safe). Legacy callers that base64'd
          // ASCII data still work because `decodeURIComponent` is a no-op
          // on a clean base64 alphabet — but we recommend URL-encoded
          // JSON going forward (set by pdf-renderer.service.ts).
          const json = JSON.parse(decodeURIComponent(dataParam));
          if (!cancelled) setState({ data: json, pageSize });
          return;
        }

        if (!docId || !token) {
          throw new Error('Missing docId or token query parameter');
        }

        const apiBase =
          (import.meta as unknown as { env: Record<string, string> }).env
            .VITE_API_URL ?? 'http://localhost:3000/api';
        const res = await fetch(
          `${apiBase}/documents/${encodeURIComponent(docId)}/render-payload`,
          {
            headers: { 'x-render-token': token },
          },
        );
        if (!res.ok) throw new Error(`API ${res.status}`);
        const body = await res.json();
        if (!cancelled) {
          setState({ data: body.data, pageSize: body.pageSize ?? pageSize });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
        window.__ARTBOARD_ERROR__ = msg;
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [search]);

  useEffect(() => {
    if (state) {
      // Give the paginator a tick to settle before signalling readiness.
      const t = setTimeout(() => {
        window.__ARTBOARD_READY__ = true;
      }, 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state]);

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: 24,
          fontFamily: 'system-ui',
          color: '#991b1b',
        }}
      >
        Render failed: {error}
      </div>
    );
  }
  if (!state) return null;

  return (
    <TemplateRenderer
      componentKey={componentKey}
      data={state.data}
      pageSize={state.pageSize}
    />
  );
}
