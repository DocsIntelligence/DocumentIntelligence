# Build Log — resumable implementation tracker

> **Purpose:** so anyone (you or a fresh Claude session) can pick up exactly where we left off.
> Mirrors the harness task list but survives across sessions. Update the **Current state** and
> **Next step** blocks every time you stop. Phase order: **editor first, then flows.**

## How to resume in a new session
1. Read this file top-to-bottom.
2. Read [`03-technical-design.md`](03-technical-design.md) for the how, [`02-product-roadmap.md`](02-product-roadmap.md) for the why/order.
3. Run `pnpm nx run app:typecheck` and `pnpm nx run api:typecheck` to see the live baseline.
4. Pick the lowest-numbered unchecked task below.

## Architecture decisions locked so far
- **Two builders, by paradigm** (confirmed in code):
  - **Structured/form builder** — `/documents/:id/edit` → `features/documents/builder/BuilderShell`. Backend-wired (CRUD/catalog/render-payload/snapshot/exports), artboard-iframe preview, risks panel, real PDF export. Use for highly structured docs (rent agreement).
  - **Freeform WYSIWYG editor** — `/editor` → `features/editor/TemplateEditor`. The home for **AI-drafted + court/narrative documents**. Currently disconnected from backend (local HTML templates, client-side export, faked AI, dead transliteration toggle). **This is the "editor" we make proper first.**
- **Editors live in `apps/app`** (React). `apps/web` (Next.js) = landing pages only.
- **Single source of truth per structured doc type** = `DocumentTypeBundle` in `libs/document-schema`.
- **AI provider** = Claude (`claude-opus-4-8`) via `@anthropic-ai/sdk`, added alongside existing OpenAI+Gemini; structured outputs for schema-conforming generation; never let the model author statutory citations.

## Baseline at session start (2026-06-07)
- `pnpm nx run app:typecheck` → **1 error**: `BuilderForm.tsx:138` compares widget to `'inventory'` (not in `FieldWidget`). Everything else compiles.
- Freeform editor (`TemplateEditor`) typechecks but: transliteration extension not wired, AI generate is fake, export is client-side HTML, no backend persistence.

---

## PHASE 1 — Editor (do first)

- [x] **T1 · Fix app typecheck** (`BuilderForm.tsx:138` `'inventory'` widget). **DONE 2026-06-07** — added `'inventory'` and `'boolean'` to the `FieldWidget` union in `libs/document-schema/src/types.ts` (both are real: schema defines `inventory` array; BuilderForm renders a boolean widget). `pnpm nx run app:typecheck` → green.
- [x] **T2 · Wire transliteration into `TemplateEditor`.** **DONE 2026-06-07** — added `TransliterationExtension` to the TipTap config, `ext.storage.state` sync effect on `enabled`/`language`, `SuggestionPopover` render in the (now `relative`) editor scroll container, and `handleSuggestionSelect`. Mirrors the proven `document-editor.tsx` pattern. Typechecks green. **⚠ Runtime smoke-test pending:** the live Google-Input-Tools round-trip (toggle अ On → type "namaste" + space → Devanagari) needs the dev server + a browser; not verified headless.
- [x] **T3 · Editor story decided.** **DONE 2026-06-07** — `TemplateEditor` (apps/app, `/editor`) is the **canonical freeform editor**. The lib `DocumentEditor` (`@org/ui`) has **zero source consumers** (the `.next` hits are stale dev-bundle chunks of the `@org/ui` barrel); it remains as an unused reusable primitive. **Follow-up (deferred):** extract TemplateEditor's editor core into the lib as one shared engine, or delete `DocumentEditor` — don't leave two long-term.
- [x] **T4 · Editor polish.** **DONE 2026-06-07** — page-break divider already existed (`.editor-page-break` dashed label, hidden in preview); shortcuts adequate (StarterKit + `Mod-Enter` page break). Added the real gap: **debounced localStorage autosave + restore-on-mount** (`DRAFT_KEY`, `{templateId,html,values,savedAt}`) so a refresh no longer loses work, a restore toast, and a "Saved hh:mm" status indicator. App typechecks green. (Backend persistence is T7.)

## PHASE 2 — Flows (after editor)

- [x] **T5 · Backend: Claude provider + config.** **DONE 2026-06-07** — installed `@anthropic-ai/sdk@0.102.0`; `ai/providers/claude.provider.ts` uses the official SDK directly (default `claude-opus-4-8`; **no `temperature`/`top_p`/`budget_tokens`** — they 400 on Opus 4.8; thinking omitted = fast default). Registered FIRST in the fallback chain (`ai.service.ts`) + `ai.module.ts`. Added `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` to `config/schema.ts` (+ warning group) and `.env.example`. `tsc -p apps/api/tsconfig.app.json` → exit 0. **⚠ Runtime call to Anthropic pending** (needs `ANTHROPIC_API_KEY` + running api).
- [x] **T6 · Backend: `/legal-ai/generate` + `/legal-ai/revise`.** **DONE 2026-06-07** — both endpoints produce editor-ready HTML with `{{placeholders}}`, grounded by doc type when known (`getBundle`). Guardrails: disclaimer returned separately, no model-authored statute citations (`{{applicable_law}}` placeholder), no judicial impersonation; quota metering + 24h cache reused. DTOs + controller + api-client (`generate`/`revise`) added. *(Structured-output-vs-Zod for the form builder is a noted future enhancement — the editor flow is HTML-based.)*
- [x] **T7 · Persist freeform editor to `Document` model.** **DONE 2026-06-07** — backend auto-provisions a `freeform` DocumentType+template (also added to seed). `TemplateEditor` gained a `persistence` prop: `local` (localStorage, unchanged `/editor`) vs `bound` (backend doc). New route `/documents/:id/draft` (`DraftEditorPage`) loads `data.{html,values,templateId}` and debounce-autosaves via PATCH. `/editor` got "Save to my documents" → creates a freeform doc → navigates to the bound editor.
- [x] **T8 · Real PDF/Word export for freeform docs.** **DONE 2026-06-07** — added a `freeform` template component (`libs/document-templates`) that renders editor HTML (placeholders filled, page-break split, page-size aware) and registered it under `componentKey: 'freeform'`, so the **existing Puppeteer PDF pipeline works for freeform docs unchanged**. Added Word (`.doc`) export: dependency-free, Word/LibreOffice-openable, rendered inline (CPU-only) via `DocxRendererService`; `format: 'doc'` added to the export DTO + api-client; freeform-only for now. *(True OOXML `.docx` via a converter is a future swap of `buildWordHtml`.)*
- [x] **T9 · Unified new-doc picker + AI draft entry.** **DONE 2026-06-07** — `NewDocumentPicker` now leads with **Draft with AI** (brief → `/legal-ai/generate` → create freeform doc → open bound editor) and **Blank document** (→ `/editor`), then the structured-template grid. The editor gained decoupled `onAiGenerate`/`onAiRevise` props → "Draft with AI" / "Revise with AI" toolbar actions (prompt → call → replace content → toast w/ disclaimer; Ctrl/Cmd+Z to undo). Wired in both `EditorDemo` and `DraftEditorPage` via `useLegalAiService`.

## Later (tracked in 04-progress-tracker.md, not this session)
Court-document scaffolding + citation library (BNS/BNSS/BSA), sharing/comments, eSign (Digio), org/marketplace, long-tail doc types.

---

## Session journal (append newest at bottom)

### 2026-06-07 — session start
- Analyzed in-flight editor code (~2k lines). Mapped the two-builder architecture (above).
- Created tasks T1–T9 (harness IDs #1–#9) + this log.

### 2026-06-07 — editor pass 1 (T1, T2, T3)
- **T1 done:** `FieldWidget` union now includes `'inventory'` + `'boolean'`; `app:typecheck` green.
- **T2 done:** transliteration fully wired into `TemplateEditor` (extension + sync effect + popover + select handler); typechecks. Runtime smoke-test of the live suggestion API still pending (needs dev server + browser).
- **T3 done:** canonical-editor decision recorded (TemplateEditor canonical; `DocumentEditor` lib unused). Physical de-dup deferred.
- **Files touched:** `libs/document-schema/src/types.ts`, `apps/app/src/app/features/editor/TemplateEditor.tsx`.
- **Stopped at:** clean checkpoint, editor compiles. Next up is **T4 (editor polish)** then **Phase 2 flows starting at T5 (Claude provider)**.
- **To verify visually:** `pnpm nx run app:serve` (or `pnpm dev:app`) → log in → `/editor` → toggle अ On, type `namaste ` and confirm Devanagari suggestions; check live preview pane + page navigator.
- **Next step for whoever resumes:** T4, or jump to T5 (backend Claude provider) — they're independent; T5 unblocks the AI-draft flow which is the headline feature.

### 2026-06-08 — Multilingual documents (Hindi / any language)
- **Backend:** `/legal-ai/generate` now writes the ENTIRE document in a requested `language` (strong system directive; keeps `{{snake_case}}` placeholder keys in Latin). DTO relaxed to accept language names (`English`, `Hindi`, `Tamil`, …). `/legal-ai/revise` gained an optional `language` → translate/rewrite the whole doc into it.
- **Shared UI:** `apps/app/.../lib/languages.tsx` — `LANGUAGE_OPTIONS` (English + 13 Indian langs from `@org/transliteration` + a few world languages) and a dialog-safe `<LanguageSelect>`.
- **Freeform:** language picker added to the editor's Draft-with-AI modal and a "Translate to (optional)" picker in the Revise modal (translate-only works with an empty instruction); also in `NewDocumentPicker`'s AI modal. Threaded through `onAiGenerate(brief, language)` / `onAiRevise(instruction, html, language)` → `EditorDemo` + `DraftEditorPage` → `legalAi`.
- **Structured:** `BuilderShell` got a "Language" button → modal that drafts a full, translated **freeform** copy from the structured data (`legalAi.generate({brief from data, language, documentTypeKey})`) and opens it at `/documents/:id/draft`. So a rent agreement (or any structured type) can be produced in any language.
- Verified: api `tsc` exit 0, `app:typecheck` green, eslint clean, `app:build` (vite) succeeds.

### 2026-06-07 — Resizable editor panes + zoomable preview
- **`react-resizable-panels`** for the freeform editor's 3-up layout (`TemplateEditor`): Sidebar │ Editor │ Preview are now drag-resizable with styled separators. ⚠️ Installed version is **4.11.2**, whose API is `Group`/`Panel`/`Separator` with `orientation` + `%`-string sizes (NOT the older `PanelGroup`/`PanelResizeHandle`/`order` API) — coded to the installed API. Applies to both `/editor` and `/documents/:id/draft`.
- **`react-zoom-pan-pinch`** in `PaginatedPreview` (the shared preview for all editor instances): scroll-to-zoom, drag-to-pan, pinch, + a zoom-out/fit/zoom-in control cluster. Pages render at true A4 width and scale.
- **Not** applied to the structured builder's `ArtboardIframe` — it's an interactive iframe whose click-to-edit coordinate math a CSS transform would break. (Could be added later with transform-aware hit-testing if needed.)
- Verified: `app:typecheck` + eslint clean, and **`app:build` (vite) succeeds** — both deps bundle.

### 2026-06-07 — Export architecture: PDF backend, DOCX frontend + builder UI
- **DOCX moved to the frontend.** Removed the backend `DocxRendererService` (+ its module/dto/controller/api-client wiring; reverted export `format` to `pdf`-only). Word export is now `apps/app/.../editor/export-word.ts` — builds Word-openable HTML from the editor's `html`+`values` and downloads a `.doc` Blob client-side (instant, no S3/poll). Rationale: it's just a wrapped HTML string the client already has.
- **PDF stays the backend Puppeteer service** (reliable, calibrated `@page`). Wired it into the freeform editor: `DraftEditorPage` uses `useExportPdf` and passes `onExportPdf`/`exportingPdf` to `TemplateEditor`. The editor's PDF button now uses the backend export when a doc is saved (bound mode); falls back to `window.print()` only in the unsaved `/editor` scratchpad. Editor top bar: "Word" (frontend) + "Export PDF" (backend) / "Print" (fallback).
- **Builder page (`/documents/:id/edit`) UI/UX:** fixed root height `h-[calc(100vh-3.5rem)]` → `h-screen` (it's full-bleed now — that gap was cutting off the right preview); added a back link; made the 3-pane responsive — `lg+` shows sections|form|preview, below `lg` the sidebar hides and a Form/Preview segmented toggle switches panes; autosave status is now a colored pill.
- Verified: api `tsc` exit 0, `app:typecheck` green, eslint clean.
- **Freeform routing bug fixed:** `DocumentsList` linked every doc to `/documents/:id/edit` (structured builder) → freeform docs hit `getBundle('freeform')`→undefined and showed "no schema registered". Added `documentHref(d)` (freeform → `/documents/:id/draft`, else `/edit`), used in `DocumentsList` + `Dashboard`; `BuilderShell` now `<Navigate>`s freeform docs to `/draft` instead of erroring.
- **Responsive app shell:** rewrote `MainLayout` — fixed left sidebar on md+ (brand, New-document CTA, icon nav with active states via `NavLink`, user footer + logout); mobile top bar + hamburger → slide-in drawer with overlay; content offset `md:pl-64`, `max-w-6xl`.
- **Editors full-bleed:** moved `/editor` and `/documents/:id/draft` out of `MainLayout` to full-bleed ProtectedRoutes (like `/documents/:id/edit`) so the shell doesn't squish them; editor root + draft states now `h-screen`; added a `backHref` "← back" link to the editor top bar (→ `/documents`).
- **Dashboard rebuilt:** greeting, 3 quick-action cards (Draft with AI / Blank editor / My documents), recent-documents grid (top 5 via `documentHref`, status pills, skeletons, empty state).
- **Polish:** `DocumentsList` cards now whole-card links with hover/lift, status pills, skeleton + dashed empty states; consistent tokens throughout.
- Verified: `app:typecheck` green, eslint clean on all changed files. (Runtime/visual check still needs the app running.)

### 2026-06-07 — Fix: export error showed "[object Object]"
- **Symptom:** a failed PDF export stored `error: "[object Object]"` — the real cause was swallowed because `String(e)` was called on a non-Error rejection (the browser transport rejects with a non-Error object).
- **Fix:** added `apps/api/src/app/common/error.util.ts` (`errorMessage` / `errorDetail`) and used it in `pdf-renderer.service`, `docx-renderer.service`, and `exports.service` (stored message + full raw detail logged). Wrapped `puppeteer.connect`/`launch` so a connection/launch failure becomes a clear message naming `CHROME_URL`/`PUPPETEER_EXECUTABLE_PATH`. api tsc exit 0.
- **Likely root cause of THAT failure** (env had `CHROME_URL=ws://localhost:8080`): Browserless/Chrome not running or refusing at that endpoint (the ~5ms failure points at the connect step). Re-run the export — `error` now carries the real message and the API log has full detail.

### 2026-06-07 — Phase 2 flows (T6–T9) — ALL TASKS COMPLETE
- **T6:** `/legal-ai/generate` + `/legal-ai/revise` (HTML drafts, guardrails, metering, cache) + api-client methods. api tsc exit 0.
- **T7:** freeform `Document` persistence — backend auto-provision + seed; editor `persistence` prop; `/documents/:id/draft` (`DraftEditorPage`) load+autosave; `/editor` "Save to my documents". app typecheck green.
- **T8:** freeform `freeform` template → existing PDF pipeline works; Word `.doc` export (`DocxRendererService`, inline, dep-free). api/artboard/app typecheck green.
- **T9:** AI draft entry in `NewDocumentPicker` + `onAiGenerate`/`onAiRevise` editor actions wired via `useLegalAiService`. Repo typecheck + targeted eslint green.
- **End-to-end flow now exists:** New → Draft with AI → edit (transliteration, placeholders, page breaks, autosave to backend) → Revise with AI → export PDF/Word.
- **⚠ Runtime verification pending for everything that needs live services** (Postgres, Redis, Anthropic key, Browserless/Chromium, S3): all changes verified by typecheck + lint only — I could not run the stack here. See "How to verify" below.
- **How to verify locally:** set `ANTHROPIC_API_KEY` + `DATABASE_URL` (+ optional `REDIS_URL`, storage, `ARTBOARD_URL`/`CHROME_URL` for PDF); `pnpm prisma:migrate:dev && pnpm prisma:seed`; `pnpm dev`. Then: `/documents/new` → Draft with AI; `/editor` → transliteration + Save to my documents; `/documents/:id/draft` → autosave + Revise with AI + export.
- **Known follow-ups (not blocking):** structured-output-vs-Zod generation for the form builder; true OOXML `.docx`; accept/reject *diff* UI for AI revise (today it replaces + relies on undo); court-doc types + citation library (BNS/BNSS/BSA) per `docs/02-product-roadmap.md` Phase C.

### 2026-06-07 — T5 (Claude provider) + T4 (editor polish)
- **T5 done:** `@anthropic-ai/sdk@0.102.0` installed; `ClaudeProvider` (official SDK, Opus-4.8-safe) registered first in the AI fallback chain; config + `.env.example` updated. `apps/api` tsc exit 0.
- **T4 done:** localStorage autosave/restore + saved indicator added to `TemplateEditor`; page-break divider/shortcuts already present. `app:typecheck` green.
- **Files touched:** `package.json`/`pnpm-lock.yaml` (anthropic sdk), `apps/api/src/app/ai/providers/claude.provider.ts` (new), `ai.service.ts`, `ai.module.ts`, `config/schema.ts`, `.env.example`, `apps/app/src/app/features/editor/TemplateEditor.tsx`.
- **Phase 1 (editor) is complete (T1–T4).** Next is the rest of Phase 2 flows.
- **Next step for whoever resumes:** **T6** — `/legal-ai/generate` + `/legal-ai/revise` (read `legal-ai.service.ts`/`legal-ai.controller.ts`/`legal-ai.dto.ts` + `document-schema` prompts; use Claude structured outputs vs the Zod schema; guardrails + metering). Then **T7** (persist freeform editor to `Document`) and **T9** (wire "Draft with AI" into the editor). To runtime-verify T5: set `ANTHROPIC_API_KEY`, `pnpm dev:api`, hit an `/ai` or `/legal-ai` endpoint.
