# Pagination diagnostic — preview vs. exported PDF

A reusable, **off-by-default** tool for debugging why the freeform document's
**live preview** and its **exported PDF** disagree on page breaks (extra blank
space, an extra page, a block bumped down, different page counts).

It exists permanently in the codebase behind a runtime flag — nothing is
commented out, and you never need to rebuild to use it.

> **See also** [`PDF_PRINT_LEARNINGS.md`](PDF_PRINT_LEARNINGS.md) — the portable
> principles + checklist behind all this (page sizing, fonts, the reset trap),
> written to carry the approach to another app. This doc is the debugger; that
> one is the rulebook.

---

## Why preview and PDF can diverge

Both surfaces share ONE paginator — `paginateChunks()` in
`libs/document-templates/src/_internals/paginate-html.ts`. It measures each
top-level block's height in a hidden host and packs blocks into page-sized
buckets. The two surfaces differ only in **where** they measure:

| Surface      | Runs in                                  | Measures inside          | Styled by                    |
| ------------ | ---------------------------------------- | ------------------------ | ---------------------------- |
| Live preview | the **app** (`:5200`)                    | `.document-preview-page` | `editor.css`                 |
| Exported PDF | the **artboard** via Puppeteer (`:4210`) | `.doc-page`              | `Page.tsx` `PagePrintStyles` |

For the breaks to match, three things must hold in both contexts:

1. **Same fonts loaded** — Hindi especially (Inter + Noto Sans Devanagari are
   bundled via `@fontsource` in both `apps/app/src/main.tsx` and
   `apps/artboard/src/main.tsx`). A different font ⇒ different line wrapping ⇒
   different block heights.
2. **Same CSS metrics** — `.doc-page` and `.document-preview-page` must be
   byte-identical for every property that affects height (font-size,
   line-height, margins, list padding, table padding). They are kept in sync by
   hand; each file has a header comment saying so.
3. **No reliance on a global reset present in one app but not the other** — the
   app loads Tailwind's _preflight_ (which resets `h1–h6` margins/sizes); the
   artboard does **not**. Any element you don't style explicitly inherits
   different defaults in each. (This is exactly the `h3` bug — see History.)

The diagnostic exposes all three at once.

---

## How to enable it

It prints two reports you compare: `[PREVIEW/APP]` and `[ARTBOARD/PDF]`.

### Preview (app, `:5200`)

Logged to the browser console. Turn it on with **either**:

- Add `?paginationDebug=1` to the editor URL, **or**
- In DevTools console: `localStorage.paginationDebug = '1'` then reload.

Open the editor, look at the console for the `[PREVIEW/APP] …` block.

### Exported PDF (artboard, `:4210`)

Printed as a yellow box at the top of **page 1 of the PDF itself** (so you can
read it from the exported file). Turn it on by setting an env var on the **API**
and re-exporting:

```bash
PAGINATION_DEBUG=1   # in .env (or the api process env), then restart the api
```

The API appends `?paginationDebug=1` to the artboard render URL; the artboard
renders the box. (You can also force it in any browser context directly with
`window.__PAGINATION_DEBUG__ = true` or the `?paginationDebug=1` URL param.)

Leave `PAGINATION_DEBUG` unset for normal exports — the box never appears.

---

## Reading the output

```
[PREVIEW/APP] pages=3 Inter=true Noto=true firstH=971 fullH=971 w=658
font=Inter, "Noto Sans Devanagari", "Segoe UI", system-ui, sans-serif
H1:48 P:96 H2:45 P:74 H3:22 P:30 UL:150 ...
```

- `pages` — resulting page count.
- `Inter` / `Noto` — whether each document font is **actually loaded**
  (`document.fonts.check`). If `false`, that's your problem.
- `firstH` / `fullH` — content-height budget (px) for the first / subsequent
  pages. `firstH < fullH` only on stamp-paper sizes (reserved top zone).
- `w` — content width (px) the blocks are measured at.
- `font` — the computed font stack of the first block.
- `TAG:height` list — measured outer height (px, incl. margins) of every
  top-level block, in order.

## Diagnosis matrix

Compare the two reports for the **same document**:

| Observation                              | Cause                                                                                               | Fix                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Inter`/`Noto` differ (e.g. PDF `false`) | Font not loaded in that context                                                                     | Rebuild/restart that app; `rm -rf node_modules/.vite` so Vite re-bundles the `@fontsource` deps; confirm the imports in its `main.tsx`.                                   |
| Fonts match, but a `TAG:height` differs  | CSS metric divergence between `.doc-page` and `.document-preview-page`                              | Find the first differing block tag; pin that element identically in BOTH stylesheets. Watch for elements only reset by Tailwind preflight (headings, blockquote, hr, dl). |
| Heights identical, `pages` differ        | The JS budget vs. Chrome's actual sheet fill (a packed page renders a hair over `fullH` and spills) | Add a small safety margin to the budget, or move the PDF to native CSS paged media.                                                                                       |

---

## Where the code lives

- `paginate-html.ts` — `isPaginationDebug()`, `debugMeasure()`,
  `formatPaginationDebug()`, `PaginationDebug`.
- `freeform/index.tsx` (`FreeformDocument`) — renders the PDF overlay.
- `apps/app/.../PaginatedPreview.tsx` — console-logs the preview report.
- `apps/api/.../pdf-renderer.service.ts` — appends `?paginationDebug=1` when
  `PAGINATION_DEBUG` is set.

## History — bugs this caught

- **Fonts not bundled** (preview≠PDF on Hindi): added `@fontsource` Inter + Noto
  Sans Devanagari to both apps; unified the `.doc-page` / `.document-preview-page`
  font stacks; gated pagination on `document.fonts.ready`.
- **`.doc-page` root missing `font-size: 11pt`** → unpinned content measured at
  the UA default (~16px) in the PDF → early breaks.
- **`h3` divergence** (PDF 4 pages, preview 3): `h3` was unstyled, so it used
  Tailwind's preflight reset in the app (22px) but the UA default
  (1.17em + 1em margins = 60px) in the artboard. Fixed by pinning `h3–h6`
  identically in both stylesheets.
