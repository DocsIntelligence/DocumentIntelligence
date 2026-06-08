import { useEffect, useState } from 'react';

/**
 * Font faces every document page renders with. Pagination measures block
 * heights in JS (`paginateChunks`); if it measures while a system fallback is
 * still standing in for these fonts, the computed page breaks won't match the
 * final paint — text reflows by a line and whole blocks bump to the next page,
 * leaving blank gaps (the preview ↔ exported-PDF mismatch).
 *
 * Keep this list in lockstep with:
 *   - the `@fontsource/*` imports in `apps/app/src/main.tsx` and
 *     `apps/artboard/src/main.tsx` (which actually load the faces), and
 *   - the `.doc-page` (`Page.tsx`) / `.document-preview-page` (`editor.css`)
 *     `font-family` stacks (which select them).
 */
const DOC_FONT_SPECS = [
  '400 16px "Inter"',
  '700 16px "Inter"',
  '400 16px "Noto Sans Devanagari"',
  '700 16px "Noto Sans Devanagari"',
];

/**
 * Resolve once the document fonts are loaded — or immediately if the FontFace
 * API is unavailable. The loads are triggered explicitly (`fonts.load`) rather
 * than waiting on `fonts.ready` alone, because a face nothing has rendered yet
 * is never "pending" and `ready` would resolve before it loads.
 */
export function loadDocumentFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return Promise.resolve();
  }
  const fonts = document.fonts;
  return Promise.all(
    DOC_FONT_SPECS.map((spec) => fonts.load(spec).catch(() => undefined)),
  )
    .then(() => fonts.ready)
    .then(() => undefined);
}

/**
 * React flag that flips to `true` once the document fonts have loaded. Add it
 * to a measuring effect's dependency array so the pagination pass re-runs
 * against the real font metrics after the first (possibly fallback) pass.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadDocumentFonts().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}
