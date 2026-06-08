# Editor UI/UX redesign — mockups for decision

Two editors share the same problem today: a flat wall of ~12–13 equal-weight
toolbar buttons, no grouping, no visual hierarchy, and the 3 panels run together
with thin separators and no headers.

- **Freeform editor** — `apps/app/.../editor/TemplateEditor.tsx` (rich-text +
  live preview; used for AI drafts and templates).
- **Structured builder** — `apps/app/.../documents/builder/BuilderShell.tsx`
  (schema-driven form + artboard preview).

Pick a toolbar option (A / B / C) below. The **panel** improvements at the end
apply regardless of which toolbar you choose.

Legend: `✨`=AI · `💬`=Comments · `✍`=Signatures · `🕐`=History/Versions ·
`🔗`=Share · `⊟`=Preview toggle · `▾`=dropdown menu.

---

## 0. CURRENT STATE (what we're fixing)

### Freeform editor — today
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← 📄 Rent Agreement   [Templates][Save to my docs][✨Draft with AI][✨Revise with AI][Copy] │
│    Agreements · 3/8     [Comments][Signatures][History][Share][A4 ▾][Word][Export PDF][⊟]   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
   ↑ 13 buttons, all the same weight, wrapping to 2 ragged rows on smaller screens
┌──────────┬───────────────────────────┬───────────────────────────┐
│ Fields   │ [B I U H1 H2 …] toolbar    │   page                    │
│ Pages    │  document body…            │                           │
└──────────┴───────────────────────────┴───────────────────────────┘
   ↑ panels separated by thin grey bars, no titles, no breathing room
```

### Structured builder — today
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← [Untitled document............]  (form|preview)  ● Saved  A4 ▾ [Language][Comments]      │
│                                                  [Signatures][History][Share][Export PDF]   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
┌──────────┬───────────────────────────┬───────────────────────────┐
│ Sections │   form fields             │   artboard preview        │
│ + Risks  │                           │                           │
└──────────┴───────────────────────────┴───────────────────────────┘
```

**Problems:** no primary/secondary hierarchy (Export PDF looks like Copy);
collaboration, file, and output actions are interleaved; nothing is grouped;
panels lack headers; the broken `bg-destructive` token means the page-delete
hover and error text render with no colour.

---

## Option A — Grouped toolbar + menus  ★ recommended

One clean row. Primary actions stay visible; collaboration collapses to a compact
icon group with tooltips; low-frequency file actions fold into a `File ▾` menu.

### A — Freeform editor
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ←  📄 Rent Agreement            ┆  ✨ Draft with AI   Revise  ┆  💬 ✍ 🕐 🔗  ┆  File▾  A4▾  [ Export PDF ]  ⊟ │
│    Agreements · 3/8 fields · ●  ┆       (creative)            ┆  (collaborate) ┆  (doc)        (primary)         │
└────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                    │
                                                         File ▾ opens:
                                                         ┌────────────────────────┐
                                                         │ ⌗  Browse templates…   │
                                                         │ ⧉  Copy document text  │
                                                         │ ⬇  Download Word (.doc)│
                                                         │ 🖨  Print              │
                                                         │ ──────────────────────│
                                                         │ ☁  Save to my documents│  (local mode only)
                                                         └────────────────────────┘
┌─ Fields ──────────┬─ Editor ───────────────────────┬─ Preview ────────────────┐
│  Completion ▓▓▓░ 38%│ [ B  I  U │ H1 H2 H3 │ • 1. ❝ │  ┌──────────────────────┐ │
│  ┌──────────────┐  │  │ ⬅ ➡ ⬌ │ ▦ │ {{}} ⏎ ]      │  │  Rent Agreement       │ │
│  │ Tenant name  │  │                                │  │  This deed…           │ │
│  └──────────────┘  │  document body …               │  └──────────────────────┘ │
│  Pages ▸           │                                │                            │
└────────────────────┴────────────────────────────────┴────────────────────────────┘
  │ 1,240 chars · 198 words · Page 1            ● Saved to cloud 12:04 │   ← unified status bar
```

### A — Structured builder
```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ ←  Rent Agreement (Untitled)…   ┆  🌐 Language  ┆  💬 ✍ 🕐 🔗  ┆  A4▾   ● Saved   [ Export PDF ] │
│    Agreement                    ┆               ┆  (collaborate) ┆        (status)   (primary)     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
┌─ Sections ────────┬─ Details ──────────────────────┬─ Preview ────────────────┐
│  ▸ Parties        │  Parties                       │  ┌──────────────────────┐ │
│  ▸ Property       │  ┌──────────────┐               │  │  (live artboard)      │ │
│  ▸ Term & rent    │  │ Landlord     │  ✨            │  │                      │ │
│  ───────────────  │  └──────────────┘               │  └──────────────────────┘ │
│  ⚠ Risks (2)      │                                │                            │
└────────────────────┴────────────────────────────────┴────────────────────────────┘
```

- **Pros:** cleanest, scales to small screens (icons + menus collapse first),
  one obvious primary button, clear left→right rhythm (identity → create →
  collaborate → file → output).
- **Cons:** Word/Print/Templates are one click deeper (in `File ▾`).
- **Build cost:** medium. New `DropdownMenu` for File; a small segmented
  icon-button group component reused by both editors.

---

## Option B — Right actions sidebar

A slim labelled rail on the far right. Top bar shrinks to identity + the single
primary button. Everything else lives in titled groups in the rail.

### B — Freeform editor
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  📄 Rent Agreement · Agreements · 3/8 fields            [ Export PDF ]    │
├──────────┬───────────────────────────┬─────────────────┬──────────────────┤
│ Fields   │ [B I U │ H1 H2 │ • 1. ❝]   │  Preview        │  CREATE          │
│ Compl.38%│                            │  ┌────────────┐ │   ✨ Draft       │
│ ┌──────┐ │  document body…            │  │  page      │ │   ✨ Revise      │
│ │Tenant│ │                            │  │            │ │  ─────────────   │
│ └──────┘ │                            │  └────────────┘ │  COLLABORATE     │
│ Pages ▸  │                            │                 │   🔗 Share       │
│          │                            │                 │   💬 Comments    │
│          │                            │                 │   ✍ Signatures  │
│          │                            │                 │   🕐 History     │
│          │                            │                 │  ─────────────   │
│          │                            │                 │  DOCUMENT        │
│          │                            │                 │   ⌗ Templates    │
│          │                            │                 │   A4 ▾  page size │
│          │                            │                 │  ─────────────   │
│          │                            │                 │  EXPORT          │
│          │                            │                 │   ⧉ Copy text    │
│          │                            │                 │   ⬇ Word         │
│          │                            │                 │   🖨 Print       │
└──────────┴───────────────────────────┴─────────────────┴──────────────────┘
```

### B — Structured builder
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  Rent Agreement (Untitled)…                            [ Export PDF ]     │
├──────────┬───────────────────────────┬─────────────────┬──────────────────┤
│ Sections │   form fields             │  Preview        │  CREATE          │
│ Parties  │                           │  ┌────────────┐ │   🌐 Language    │
│ Property │   ┌──────────────┐  ✨     │  │ artboard   │ │  COLLABORATE     │
│ Term     │   │ Landlord     │         │  │            │ │   🔗 Share       │
│ ───────  │   └──────────────┘         │  └────────────┘ │   💬 Comments    │
│ ⚠Risks(2)│                           │                 │   ✍ Signatures  │
│          │                           │                 │   🕐 History     │
│          │                           │                 │  ─────────────   │
│          │                           │                 │  DOCUMENT        │
│          │                           │                 │   A4 ▾  page size │
└──────────┴───────────────────────────┴─────────────────┴──────────────────┘
```

- **Pros:** most discoverable — every action labelled and grouped, nothing
  hidden in a menu; the top bar becomes very calm.
- **Cons:** eats ~200px of horizontal width (4th column) — preview/editor get
  narrower; on laptops that's real estate you may want for the document. Needs a
  collapse toggle for small screens. This is now a **4-pane** layout, not 3.
- **Build cost:** higher. New rail component + responsive collapse; both editors
  go from 3 to 4 regions.

---

## Option C — Two-row toolbar

Row 1 = identity + primary. Row 2 = a single grouped strip with every secondary
action labelled (separated into File · Collaborate · Document clusters).

### C — Freeform editor
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  📄 Rent Agreement · Agreements · 3/8       ✨ Draft  Revise  [Export PDF] ⊟│
├──────────────────────────────────────────────────────────────────────────┤
│ ⌗ Templates  ⧉ Copy  ⬇ Word  🖨 Print  ┆  🔗 Share  💬 Comments  ✍ Sign  🕐 History  ┆  A4 ▾ │
├──────────┬───────────────────────────┬───────────────────────────────────┤
│ Fields   │ [B I U │ H1 H2 │ • 1. ❝]   │  Preview                          │
│ Pages    │  document body…            │  ┌──────────────┐                 │
│          │                            │  │   page       │                 │
└──────────┴───────────────────────────┴───────────────────────────────────┘
```

### C — Structured builder
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  Rent Agreement (Untitled)…                 🌐 Language  ● Saved [Export PDF]│
├──────────────────────────────────────────────────────────────────────────┤
│ 🔗 Share  💬 Comments  ✍ Signatures  🕐 History          ┆          A4 ▾   │
├──────────┬───────────────────────────┬───────────────────────────────────┤
│ Sections │   form fields             │  artboard preview                 │
└──────────┴───────────────────────────┴───────────────────────────────────┘
```

- **Pros:** everything visible, zero hidden menus, no extra column; clear
  clusters.
- **Cons:** costs ~40px of vertical height permanently; two toolbars stacked
  above the editor toolbar (3 horizontal bars total) can feel heavy.
- **Build cost:** low–medium. Mostly a re-layout of existing buttons into a
  second flex row + separators.

---

## Panel improvements (apply to ALL options)

```
BEFORE                                AFTER
┌────┬─────────┬────┐                ┌─ Fields ───┬─ Editor ─────┬─ Preview ──┐
│    │         │    │   ───────▶     │ titled,    │ titled,      │ titled,    │
│    │         │    │                │ scroll-    │ sticky       │ zoom +     │
└────┴─────────┴────┘                │ area, pad  │ format bar   │ page count │
  thin bars, no titles               └────────────┴──────────────┴────────────┘
```

1. **Panel headers** — each of the 3 panes gets a small uppercase title row
   (`FIELDS` / `EDITOR` / `PREVIEW`) so the regions read as distinct cards.
2. **Resizable handles** — thicker, with a visible grip dot on hover (already
   partly there in freeform; add to builder, which is currently a fixed CSS
   grid → switch to the same resizable `Group`/`Panel`).
3. **Sticky sub-toolbars** — the rich-text format bar and the preview's
   page-size/zoom stay pinned while their pane scrolls.
4. **Unified status bar** — one footer strip: left = doc stats (chars/words/
   page or risk count), right = save state. Same component in both editors.
5. **Preview chrome** — page background, soft shadow, and a `Page X / Y` +
   zoom control header so it reads as paper.
6. **Token fix** — replace the dead `bg-destructive`/`text-destructive` (no such
   theme token) with `error` so delete-hover and error states actually colour.

---

## Recommendation

**Option A (grouped toolbar + menus)** for both editors. It gives the strongest
hierarchy, keeps all three document panes as wide as possible (no 4th column, no
second toolbar row), collapses most gracefully on small screens, and reuses one
new icon-group + one dropdown across both editors. Options B and C are fine but
trade either horizontal width (B) or vertical height (C) for having fewer hidden
menus.

If discoverability of Word/Print matters more than compactness, **C** is the
fallback. **B** only makes sense if you expect power users on wide monitors who
want every action one click away.
