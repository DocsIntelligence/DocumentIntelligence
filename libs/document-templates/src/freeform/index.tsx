import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Page, PagePrintStyles } from '../_internals/Page';
import { pageProfiles } from '../_internals/page-sizes';
import {
  paginateChunks,
  splitHtmlOnPageBreaks,
  debugMeasure,
  formatPaginationDebug,
  isPaginationDebug,
} from '../_internals/paginate-html';
import { useFontsReady } from '../_internals/use-fonts-ready';
import { useGoogleFont } from '../_internals/google-font';
import type { TemplateProps } from '../_registry';

/**
 * Freeform document template — renders editor-authored / AI-generated HTML
 * (componentKey `freeform`). The body is raw HTML with `{{placeholder}}`
 * tokens; `<div data-page-break>` markers force a page break.
 *
 * Pagination uses the SAME shared measuring paginator as the in-app live
 * preview (`PaginatedPreview`), so the preview and the exported PDF break at
 * identical positions and number pages consistently. The first render falls
 * back to one page per manual chunk (no measuring yet) so the PDF is never
 * blank if the measuring pass is somehow skipped; a layout-effect then
 * re-paginates by measured height before the renderer signals readiness.
 */
/**
 * Per-field type metadata for a freeform doc's `{{tokens}}`, mirroring the
 * editor's `PlaceholderDef` (kept structurally identical here so the lib stays
 * app-independent). Lets a converted doc render typed inputs (date/number/
 * select/…) instead of generic text fields. Optional — absent ⇒ all text.
 */
export interface FreeformFieldDef {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'email';
  hint?: string;
  placeholder?: string;
  default?: string;
  options?: { value: string; label: string }[];
  wide?: boolean;
}

export interface FreeformData {
  html?: string;
  values?: Record<string, string>;
  /** Document-level font: any Google Fonts family name. Loaded on demand and
   *  applied via the `--doc-font` CSS var; falls back to bundled Inter. */
  fontFamily?: string;
  /** Typed field definitions for the doc's tokens (see {@link FreeformFieldDef}). */
  fields?: FreeformFieldDef[];
}

const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function FreeformDocument({
  data,
  pageSize,
}: TemplateProps<FreeformData>) {
  const profile = pageProfiles[pageSize];
  const values = data?.values ?? {};
  const fontFamily = data?.fontFamily?.trim() || undefined;
  const filled = fillPlaceholders(data?.html ?? '', values);

  // Filled HTML split on manual page breaks — the units the paginator packs.
  const chunks = useMemo(() => splitHtmlOnPageBreaks(filled), [filled]);

  const measureRef = useRef<HTMLDivElement | null>(null);
  // Fallback: one page per manual chunk until the measured pass runs.
  const [pages, setPages] = useState<string[]>(chunks);
  const [debug, setDebug] = useState('');

  // Re-paginate once fonts load. In the Puppeteer PDF render the fonts arrive
  // after first mount, so the initial measure uses a fallback face; without
  // this re-run the page breaks (and page count) diverge from the live preview.
  const fontsReady = useFontsReady();
  // The chosen Google font (if any) must also be loaded before measuring.
  const docFontReady = useGoogleFont(fontFamily);

  useIsomorphicLayoutEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    // Measure ONLY once the real fonts are loaded. Measuring against a system
    // fallback (taller) makes the PDF break pages early and leave a blank foot;
    // gating here means the only measured pass is the correct one (no race with
    // a later re-measure that the PDF capture might miss). Until then, the
    // one-page-per-chunk fallback stands.
    if (!fontsReady || !docFontReady) return;
    const next = paginateChunks(host, chunks, profile);
    setPages(next);
    if (isPaginationDebug()) {
      setDebug(
        formatPaginationDebug(
          debugMeasure(host, chunks, profile, 'ARTBOARD/PDF', next.length),
        ),
      );
    }
  }, [chunks, pageSize, profile, fontsReady, docFontReady]);

  // Per-document font, applied to every page (and the measuring host, which
  // inherits it) via the --doc-font custom property.
  const rootStyle = fontFamily
    ? ({ ['--doc-font']: `'${fontFamily.replace(/'/g, '')}'` } as CSSProperties)
    : undefined;

  return (
    <div style={rootStyle}>
      <PagePrintStyles pageSize={pageSize} />

      {debug && (
        <pre
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999,
            margin: 0,
            padding: '4px 6px',
            maxWidth: '190mm',
            background: 'rgba(255,255,0,0.92)',
            color: '#000',
            font: '7px/1.3 monospace',
            whiteSpace: 'pre-wrap',
            border: '1px solid #f00',
          }}
        >
          {debug}
        </pre>
      )}

      {/* Hidden measuring host — same .doc-page typography as the rendered
          pages so measured heights predict the real layout. */}
      <div
        ref={measureRef}
        aria-hidden
        className="doc-page"
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          visibility: 'hidden',
          pointerEvents: 'none',
          padding: 0,
          margin: 0,
          boxShadow: 'none',
          minHeight: 0,
        }}
      />

      {pages.map((pageHtml, i) => (
        <Page
          key={i}
          pageSize={pageSize}
          isFirst={i === 0}
          pageNumber={i + 1}
          totalPages={pages.length}
        >
          <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
        </Page>
      ))}
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────────

function fillPlaceholders(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_full, key: string) => {
      const v = values[key];
      return v && v.trim()
        ? escapeHtml(v)
        : `<span style="background:#fef3c7;color:#92400e;padding:0 2px;border-radius:2px">[${escapeHtml(
            key,
          )}]</span>`;
    },
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
