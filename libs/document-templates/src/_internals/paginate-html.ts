import type { PageProfile } from './page-sizes';

/**
 * Shared HTML pagination used by BOTH the in-app live preview
 * (`PaginatedPreview`) and the artboard PDF renderer (`FreeformDocument`), so
 * the freeform preview and the printed/exported PDF break pages at exactly the
 * same places.
 *
 * The two callers must measure against the SAME page typography (font,
 * line-height, margins) for the results to match — see `.doc-page` /
 * `.document-preview-page`, which are kept in sync.
 */

/** Split top-level HTML at every `<div data-page-break ...>...</div>` marker. */
export function splitHtmlOnPageBreaks(html: string): string[] {
  if (!html) return [''];
  const parts = html.split(/<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi);
  const cleaned = parts
    .map((s) => s.trim())
    .filter((s, i, arr) => i === 0 || s.length > 0 || arr.length === 1);
  return cleaned.length > 0 ? cleaned : [''];
}

const mmToPx = (mm: number) => (mm * 96) / 25.4;

/**
 * Runtime toggle for the pagination diagnostic — OFF by default, no rebuild
 * needed. Returns true when ANY of these is set (see docs/PAGINATION_DEBUG.md):
 *   - `globalThis.__PAGINATION_DEBUG__ === true`
 *   - URL query `?paginationDebug=1` — works for the app editor URL AND the
 *     artboard render URL (the PDF worker appends it when `PAGINATION_DEBUG=1`
 *     is set on the API), so the diagnostic prints into the exported PDF.
 *   - `localStorage.paginationDebug === '1'` (app: set once in the console).
 *
 * Drives the on-page (PDF) overlay in `FreeformDocument` and the console log in
 * the app's `PaginatedPreview`.
 */
export function isPaginationDebug(): boolean {
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as { __PAGINATION_DEBUG__?: boolean }).__PAGINATION_DEBUG__ ===
      true
  ) {
    return true;
  }
  if (typeof window === 'undefined') return false;
  try {
    const v = new URLSearchParams(window.location.search).get(
      'paginationDebug',
    );
    if (v && v !== '0' && v !== 'false') return true;
    return window.localStorage?.getItem('paginationDebug') === '1';
  } catch {
    return false;
  }
}

export interface PaginationDebug {
  label: string;
  pages: number;
  firstH: number;
  fullH: number;
  contentWidth: number;
  fontInter: boolean;
  fontNoto: boolean;
  computedFont: string;
  blocks: { tag: string; h: number }[];
}

/**
 * Measure each top-level block's outer height in `host` (the same way the
 * paginator does) and report it alongside which document fonts are actually
 * loaded and the computed font of the first block. Used to diff the app's
 * `.document-preview-page` measuring context against the artboard's `.doc-page`
 * one — if the per-block heights match, any page-count difference is
 * environmental (fonts not loaded in the artboard); if they differ, the CSS
 * metrics diverge.
 */
export function debugMeasure(
  host: HTMLElement,
  chunks: string[],
  profile: PageProfile,
  label: string,
  pages: number,
): PaginationDebug {
  const fullH = mmToPx(
    profile.heightMm - profile.marginTopMm - profile.marginBottomMm,
  );
  const firstH = Math.max(40, fullH - mmToPx(profile.reservedTopMm));
  const contentWidth = mmToPx(
    profile.widthMm - profile.marginLeftMm - profile.marginRightMm,
  );
  host.style.width = `${contentWidth}px`;
  const blocks: { tag: string; h: number }[] = [];
  let firstComputed = '';
  for (const chunk of chunks) {
    host.innerHTML = chunk;
    for (const el of Array.from(host.children) as HTMLElement[]) {
      if (!firstComputed) firstComputed = getComputedStyle(el).fontFamily;
      blocks.push({ tag: el.tagName, h: Math.round(blockHeight(el)) });
    }
  }
  host.innerHTML = '';
  const fonts =
    typeof document !== 'undefined' && 'fonts' in document
      ? document.fonts
      : null;
  return {
    label,
    pages,
    firstH: Math.round(firstH),
    fullH: Math.round(fullH),
    contentWidth: Math.round(contentWidth),
    fontInter: fonts ? fonts.check('11pt "Inter"') : false,
    fontNoto: fonts ? fonts.check('11pt "Noto Sans Devanagari"') : false,
    computedFont: firstComputed,
    blocks,
  };
}

/** Render a PaginationDebug as a compact one-line-ish string. */
export function formatPaginationDebug(d: PaginationDebug): string {
  return (
    `[${d.label}] pages=${d.pages} Inter=${d.fontInter} Noto=${d.fontNoto} ` +
    `firstH=${d.firstH} fullH=${d.fullH} w=${d.contentWidth}\n` +
    `font=${d.computedFont}\n` +
    d.blocks.map((b) => `${b.tag}:${b.h}`).join(' ')
  );
}

/** Measured outer height of an element (border-box + vertical margins). */
function blockHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return (
    el.offsetHeight +
    parseFloat(cs.marginTop || '0') +
    parseFloat(cs.marginBottom || '0')
  );
}

const isHeading = (el: HTMLElement) => /^H[1-6]$/.test(el.tagName);

/**
 * Containers whose children may be redistributed across a page boundary. A long
 * list (or wrapper div) that doesn't fit the space left on a page is split — its
 * leading items stay and fill the page, the rest continue on the next — instead
 * of the whole block jumping down and leaving a blank gap. (Tables/images are
 * left atomic: splitting them cleanly needs header-repeat / can't be halved.)
 */
const SPLITTABLE = new Set(['OL', 'UL', 'DIV', 'SECTION', 'BLOCKQUOTE']);

/** A heading stranded with < this many px of room below it is pushed down to
 *  sit with the content that follows (avoids an orphaned heading at page foot). */
const KEEP_WITH_NEXT_PX = 48;

/**
 * Measure already-filled HTML chunks against a page profile and pack their
 * top-level blocks into page-sized buckets. A manual page break (the boundary
 * between chunks) always starts a new page; within a chunk, blocks flow onto the
 * next page when they no longer fit, and a too-tall splittable container is
 * divided across the boundary so pages fill completely. Only the first page
 * reserves the stamp-paper top zone.
 *
 * The SAME function drives the live preview and the PDF renderer, so they break
 * (and split) identically.
 *
 * @param host  a mounted, hidden measuring element whose CSS matches the
 *              rendered page (same class as the visible pages). Its width is
 *              set here to the page's content width.
 * @param chunks placeholder-filled HTML, already split on manual breaks.
 * @returns one HTML string per resulting physical page.
 */
export function paginateChunks(
  host: HTMLElement,
  chunks: string[],
  profile: PageProfile,
): string[] {
  const fullH = mmToPx(
    profile.heightMm - profile.marginTopMm - profile.marginBottomMm,
  );
  const firstH = Math.max(40, fullH - mmToPx(profile.reservedTopMm));
  host.style.width = `${mmToPx(
    profile.widthMm - profile.marginLeftMm - profile.marginRightMm,
  )}px`;

  const out: string[] = [];
  let bucket: string[] = [];
  let used = 0;
  let budget = firstH; // only the first page reserves the stamp zone

  // Start a fresh page, banking whatever is on the current one.
  const newPage = () => {
    out.push(bucket.join(''));
    bucket = [];
    used = 0;
    budget = fullH;
  };
  const place = (htmlStr: string, h: number) => {
    bucket.push(htmlStr);
    used += h;
  };

  // Split a container by its children: greedily fill the current page, then
  // continue on fresh pages. Ordered lists keep numbering via `start`.
  const splitContainer = (el: HTMLElement) => {
    const kids = Array.from(el.children) as HTMLElement[];
    const heights = kids.map(blockHeight);
    const isOl = el.tagName === 'OL';
    const baseStart = isOl
      ? parseInt(el.getAttribute('start') || '1', 10) || 1
      : 1;

    let i = 0;
    let placedKids = 0;
    while (i < kids.length) {
      const group: HTMLElement[] = [];
      let groupH = 0;
      while (i < kids.length) {
        const kh = heights[i];
        // A single child taller than a whole empty page can't be split further:
        // place it alone and accept the overflow (CSS lets it spill / re-break).
        if (group.length === 0 && used === 0 && kh > budget) {
          group.push(kids[i]);
          groupH += kh;
          i++;
          break;
        }
        if (used + groupH + kh > budget) break;
        group.push(kids[i]);
        groupH += kh;
        i++;
      }
      if (group.length === 0) {
        // Nothing fit in the space left → move to a new page and retry.
        newPage();
        continue;
      }
      const clone = el.cloneNode(false) as HTMLElement;
      if (isOl) clone.setAttribute('start', String(baseStart + placedKids));
      group.forEach((k) => clone.appendChild(k.cloneNode(true)));
      place(clone.outerHTML, groupH);
      placedKids += group.length;
      if (i < kids.length) newPage(); // more children remain
    }
  };

  const addBlock = (el: HTMLElement) => {
    const h = blockHeight(el);
    // Don't strand a heading at the foot of a page away from its content.
    if (isHeading(el) && used > 0 && budget - (used + h) < KEEP_WITH_NEXT_PX) {
      newPage();
    }
    if (used + h <= budget) {
      place(el.outerHTML, h);
      return;
    }
    if (SPLITTABLE.has(el.tagName) && el.children.length > 1) {
      splitContainer(el);
      return;
    }
    // Atomic block that doesn't fit: start it on a fresh page.
    if (used > 0) newPage();
    place(el.outerHTML, h);
  };

  for (let ci = 0; ci < chunks.length; ci++) {
    host.innerHTML = chunks[ci];
    const kids = Array.from(host.children) as HTMLElement[];
    for (const el of kids) addBlock(el);
    // Manual page break between chunks → force the next chunk onto a new page.
    if (ci < chunks.length - 1) {
      out.push(bucket.join(''));
      bucket = [];
      used = 0;
      budget = fullH;
    }
  }
  out.push(bucket.join(''));
  host.innerHTML = '';

  // Drop trailing blank pages (keep at least one page).
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out.length ? out : [''];
}
