import { useEffect, useState } from 'react';

/**
 * Loads an arbitrary Google Fonts family on demand so a document can be set to
 * "any font by name". Used by BOTH the in-app live preview and the artboard PDF
 * renderer (and the artboard's readiness gate) — the same family must be loaded
 * in both, or the PDF won't match the preview.
 *
 * Weights match the document typography (regular body + bold headings). The
 * Devanagari fallback in the `.doc-page` / `.document-preview-page` stacks still
 * covers glyphs a chosen Latin font lacks (India-first documents).
 */
const WEIGHTS = '400;500;600;700';

/** Google Fonts `family=` expects spaces as `+` (e.g. `Noto+Serif+Devanagari`). */
function familyParam(family: string): string {
  return family.trim().replace(/\s+/g, '+');
}

/** The Google Fonts CSS2 stylesheet URL for a family at the document weights. */
export function googleFontCssUrl(family: string): string {
  return `https://fonts.googleapis.com/css2?family=${familyParam(
    family,
  )}:wght@${WEIGHTS}&display=swap`;
}

/** Per-href promise cache so a family is fetched/awaited at most once. */
const loads = new Map<string, Promise<void>>();

/**
 * Inject the stylesheet `<link>` for `family` (idempotent) and resolve once its
 * faces have loaded. Resolves immediately for an empty family or where the
 * FontFace API is unavailable, and on a stylesheet load error (so callers never
 * hang on a typo'd family name).
 */
export function ensureGoogleFont(family?: string | null): Promise<void> {
  const fam = (family ?? '').trim();
  if (!fam || typeof document === 'undefined') return Promise.resolve();

  const href = googleFontCssUrl(fam);
  const cached = loads.get(href);
  if (cached) return cached;

  const p = new Promise<void>((resolve) => {
    const fonts = document.fonts;
    const loadFaces = () => {
      if (!fonts) {
        resolve();
        return;
      }
      Promise.all([
        fonts.load(`400 16px "${fam}"`),
        fonts.load(`700 16px "${fam}"`),
      ])
        .catch(() => undefined)
        .then(() => fonts.ready)
        .then(() => resolve());
    };

    const existing = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[data-doc-font]'),
    ).find((l) => l.href === href);

    if (existing) {
      loadFaces();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-doc-font', fam);
    link.addEventListener('load', loadFaces, { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(link);
  });

  loads.set(href, p);
  return p;
}

/**
 * React flag that flips to `true` once `family` has loaded (immediately when no
 * family is set). Add it to a measuring effect's deps so pagination re-runs
 * against the chosen font's metrics. Resets to `false` whenever `family`
 * changes so the page split is recomputed for the new font.
 */
export function useGoogleFont(family?: string | null): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    void ensureGoogleFont(family).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [family]);
  return ready;
}
