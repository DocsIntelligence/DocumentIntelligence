# PDF print learnings — page breaks, paddings, fonts (portable)

**Status:** standing reference · **Updated:** 2026-06-09 · **Audience:** anyone
building HTML→PDF document rendering, here or in **another app**.

This is the distilled, app-agnostic version of what it took to make this repo's
**live preview** and its **exported PDF** break pages and pad margins identically.
It's written so you can port the approach to a different codebase. For the
in-repo *diagnostic tool* (the on-demand measurement report), see
[`PAGINATION_DEBUG.md`](PAGINATION_DEBUG.md) — this doc is the *why* and the
*rules*; that one is the *how to debug a specific divergence*.

---

## 0. The one root cause behind 90% of "the PDF looks wrong"

You almost always have **two rendering surfaces**, and they disagree:

| Surface | Runs in | Styled by |
| --- | --- | --- |
| On-screen preview | the app, a normal browser tab | the app's CSS (often with a CSS reset like Tailwind preflight) |
| Exported PDF | **headless Chrome / Puppeteer**, loading a separate render page | that render page's CSS (usually **no** reset) |

Page breaks, padding, and page count match **only if three things are identical
in both surfaces**:

1. **The same fonts are actually loaded** before anything measures.
2. **The same CSS metrics** (font-size, line-height, margins, list/table padding)
   apply to every element that contributes height.
3. **Neither surface silently relies on a global reset the other lacks.**

Internalize this and most "padding is off / extra blank page / content shifted
down" bugs become obvious. Everything below is a consequence of it.

---

## 1. Size pages in physical units (mm), and let the page own its margins

- Set page **outer** dimensions in `mm` via inline style, not px. Browsers and
  the PDF engine agree on physical mm; px depends on DPI assumptions.
- Drive the PDF page box from CSS, not the PDF library's margin options:
  ```css
  @page { size: 210mm 297mm; margin: 0; }   /* A4; margin 0 — page owns padding */
  ```
  and in Puppeteer:
  ```js
  await page.pdf({ preferCSSPageSize: true, printBackground: true,
                   margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  ```
- **The page element, not the PDF engine, owns the inner margins** — apply them
  as `padding` on the page box with `box-sizing: border-box`. This is what makes
  padding identical between preview and PDF: the same padded box renders in both.
- Keep a single **page-profile table** (width/height/margins per page size) as
  data, so every surface reads the same numbers. (Here: `_internals/page-sizes.ts`.)

## 2. `min-height`, not fixed `height`; `overflow: visible`

A logical "page" element should use `min-height: <H>mm` with `overflow: visible`,
plus `break-after: page`. Then:

- A block taller than one sheet **flows onto the next sheet** in the paged
  renderer instead of being clipped.
- Each logical page still starts on a fresh sheet.

Fixed `height` + `overflow: hidden` is the classic "content gets cut off at the
bottom" bug.

## 3. Loading fonts is the #1 cause of preview ≠ PDF

If pagination measures block heights while a **system fallback font** is still
standing in for your real font, the computed breaks won't match the final paint:
text reflows by a line, blocks bump to the next page, you get blank gaps. Rules:

- **Self-host/bundle the exact faces** (e.g. `@fontsource/*`), don't rely on a CDN
  or system fonts — the headless renderer may not have them, and a near-miss
  metric still shifts wrapping. Import the **same weights** in both apps.
- **Explicitly `await document.fonts.load(spec)` for every family+weight** you
  render, *before* measuring — then await `document.fonts.ready`. Do **not** rely
  on `fonts.ready` alone: a face that nothing has rendered yet is never "pending,"
  so `ready` resolves before it loads.
  ```js
  await Promise.all(SPECS.map(s => document.fonts.load(s).catch(() => {})));
  await document.fonts.ready;
  ```
- **Re-run pagination after fonts are ready** (a `fontsReady` flag in the
  measuring effect's deps), so the final pass uses real metrics.
- Keep **three lists in lockstep**: the font specs you preload, the
  `@fontsource` (or equivalent) imports that load the faces, and the CSS
  `font-family` stacks that select them. Drift between them = silent fallback.
- For multi-script docs, always **trail a script-specific fallback** in the stack
  (here Latin `Inter` → `"Noto Sans Devanagari"` for Hindi) so missing glyphs
  don't swap fonts mid-line and change metrics.

## 4. Pin every height-affecting metric identically in both surfaces

The two page stylesheets must be byte-identical for anything that affects height:
`font-size`, `line-height`, `margin`, list `padding-left`, table cell `padding`,
heading sizes. Here `.doc-page` (PDF, `Page.tsx`) and `.document-preview-page`
(preview, `editor.css`) are kept in sync by hand, each with a header comment
saying so. Pick one of:

- **Best:** extract the shared print CSS into one module both surfaces import, so
  they *can't* drift.
- **Acceptable:** duplicate but pin every property explicitly and cross-comment.

## 5. The reset trap (the single most-bitten bug)

If the app loads a CSS reset (Tailwind **preflight** zeroes `h1–h6` margins and
font-sizes, also `blockquote`, `hr`, `dl`, `fieldset`) but the headless render
page does **not**, then any element you didn't style explicitly inherits
**different defaults** in each surface. Real example from this repo: an unstyled
`<h3>` measured ~22px in the app (preflight) but ~60px in the PDF (UA default
`1.17em` + `1em` margins) → an entire extra page.

**Fix:** explicitly pin `h1–h6` (and every reset-dependent tag you emit) in the
print stylesheet — never let the UA default decide. Treat "is this element styled
the same with and without a reset?" as a release check.

## 6. Never let content spill outside the column

```css
.doc-page          { overflow-wrap: anywhere; word-break: break-word; }
.doc-page img      { max-width: 100%; height: auto; }
.doc-page pre      { white-space: pre-wrap; overflow-wrap: anywhere; }
.doc-page td, th   { overflow-wrap: anywhere; }
```
Long URLs/tokens, oversized images, and wide tables are the usual culprits for
"text runs off the right edge in the PDF."

## 7. Break hints

```css
h1, h2, h3      { break-after: avoid; }   /* don't strand a heading at page foot */
li, tr, img     { break-inside: avoid; }  /* don't split a row/item across sheets */
```

## 8. If you paginate in JS (measure-then-pack)

This repo measures blocks in a hidden mirror and packs them into page-height
buckets (`_internals/Paginator.tsx`). Lessons:

- **Measure at the real content width** — a hidden element sized to
  `pageWidth − leftMargin − rightMargin` in **mm**, `visibility: hidden`,
  positioned offscreen.
- **mm→px:** browsers treat `1mm ≈ 96/25.4 px` (96dpi). Use the same factor when
  converting the page-height budget, or your buckets won't match the paint.
- **The first page can have a smaller budget** than the rest (a reserved top zone
  — e.g. pre-printed stamp paper). Track first-page vs rest-page capacity
  separately.
- **Atomic blocks aren't split** — pass only top-level *block* children
  (sections/paragraphs/tables). A single block taller than a page will overflow
  (see §2); compose with that in mind.
- **Use `useLayoutEffect`** for the measure pass (avoid a flash of wrong layout),
  guarded for SSR.
- **Residual mismatch:** even with identical heights, the JS budget vs. Chrome's
  actual sheet fill can differ by a hair, so a tightly-packed page spills. Either
  add a small safety margin to the budget, or prefer **native CSS paged media**
  (let Chrome break) over JS packing when you don't need per-block control.

> Tradeoff: JS measure-then-pack gives you control (repeated headers, reserved
> zones, "page N of M") but must chase Chrome's metrics. Native CSS paged media
> (`break-*`) is simpler and always matches the paint, but gives less control.
> If you only need clean breaks, start with native paged media.

## 9. Driving headless Chrome (operational gotchas)

From this repo's Puppeteer pipeline (`pdf-renderer.service.ts`):

- **Inject the document data via `page.evaluateOnNewDocument`, not the URL.** A
  large document on the query string blows the server's request-line/header limit
  → HTTP 431. Injecting over the DevTools protocol has no size cap and avoids a
  second network hop.
- **Gate on an explicit readiness flag**, not just `networkidle0`: have the page
  set `window.__READY__ = true` after fonts load + pagination settles, and
  `await page.waitForFunction('window.__READY__ === true')`. Otherwise you snapshot
  mid-layout.
- `printBackground: true` (else backgrounds/shading vanish), `preferCSSPageSize:
  true`, zero PDF margins (§1).
- **Remote browser hostname:** a containerized browser (Browserless) resolves
  `localhost` to itself, not your app host — rewrite to `host.docker.internal`
  (or a LAN IP). Set a viewport so first layout isn't a tiny default.
- Support both **connect** (shared remote Chrome → `disconnect`, don't `close`)
  and **launch** (local Chromium with `--no-sandbox --disable-dev-shm-usage`).

---

## 10. Portable checklist for the other app

Work top-down; the early items cause the most damage:

- [ ] One **page-profile table** (mm width/height/margins) read by every surface.
- [ ] Page box: mm dims, `box-sizing: border-box`, margins as **padding**,
      `min-height` + `overflow: visible` + `break-after: page`.
- [ ] `@page { size: …mm …mm; margin: 0 }` + Puppeteer `preferCSSPageSize: true`,
      zero margins, `printBackground: true`.
- [ ] Fonts **self-hosted**, same weights imported in **both** surfaces.
- [ ] Explicit `fonts.load(spec)` for each face **before** measuring; re-run
      layout when ready; multi-script fallback trails the stack.
- [ ] The preview page-class and the PDF page-class are **metric-identical**
      (font-size, line-height, margins, list/table padding) — ideally one shared
      CSS module.
- [ ] **Every tag you emit is explicitly styled** — no reliance on a reset that
      exists in only one surface. Pin `h1–h6`, `blockquote`, `hr`, `dl`.
- [ ] Overflow guards: `overflow-wrap`, `img{max-width:100%}`, `pre`, table cells.
- [ ] Break hints: `break-after: avoid` on headings, `break-inside: avoid` on
      rows/items/images.
- [ ] Headless: inject data (not via URL), wait on a readiness flag, set viewport,
      handle remote-browser hostname.
- [ ] Build a **side-by-side measurement report** (per-block heights + fonts-loaded
      booleans) for both surfaces so divergences are diagnosable, not guessed at.
      (See [`PAGINATION_DEBUG.md`](PAGINATION_DEBUG.md) for this repo's
      implementation you can copy.)

---

## 11. Where this repo implements each idea (reference)

- Page box, `@page`, pinned metrics, reset-trap fixes, overflow/break rules —
  `libs/document-templates/src/_internals/Page.tsx` (`Page`, `PagePrintStyles`).
- Page-profile table (sizes/margins/reserved zones) —
  `libs/document-templates/src/_internals/page-sizes.ts`.
- JS measure-then-pack paginator —
  `libs/document-templates/src/_internals/Paginator.tsx`
  (and `paginate-html.ts` for the freeform/HTML path).
- Font preloading + ready gate —
  `libs/document-templates/src/_internals/use-fonts-ready.ts`; faces loaded in
  `apps/app/src/main.tsx` and `apps/artboard/src/main.tsx`.
- Headless Chrome → PDF pipeline —
  `apps/api/src/app/documents/exports/pdf-renderer.service.ts`.
- Diagnostic report + diagnosis matrix — [`PAGINATION_DEBUG.md`](PAGINATION_DEBUG.md).
