import { TemplateRenderer, type PageSizeKey } from '@org/document-templates';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

/**
 * Server-render entry. The PDF worker (Puppeteer) navigates to
 *   /render/:componentKey?docId=...&token=...
 * and waits for `window.__ARTBOARD_READY__ === true` before invoking
 * `page.pdf()`.
 *
 * The artboard fetches the document from the API using an internal
 * service token (not the user's session). For local dev, the route also
 * accepts a base64'd `?data=` query-parameter so you can render without
 * the API loop.
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
        if (dataParam) {
          const json = JSON.parse(atob(dataParam));
          if (!cancelled) setState({ data: json, pageSize });
          return;
        }

        if (!docId || !token) {
          throw new Error('Missing docId or token query parameter');
        }

        const apiBase =
          (import.meta as unknown as { env: Record<string, string> }).env
            .VITE_API_URL ?? 'http://localhost:3000';
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
