# Implementation Plan: Legal Documents Platform

## Overview

This plan implements a template-based legal-document SaaS on the existing Nx starter. Phase 0 lays the foundation (Prisma models, NestJS module stubs, shared libs). Phase 1 delivers rent agreement end-to-end. Phase 2 adds sharing/signing. Phase 3+ expands document types and multi-persona features.

Always run lint + typecheck after each batch:

```
pnpm nx run-many -t lint --projects=api,app,web
pnpm nx run-many -t typecheck --projects=api,app,web
```

Database commands assume Postgres is reachable. If not, generate SQL only and skip the apply step.

## Tasks

### Phase 0 — Foundation

- [x] 1. Add Prisma models for documents domain
  - File: `tools/prisma/schema.prisma`
  - Added DocumentType/DocumentTemplate/Document/DocumentVersion/DocumentShare/DocumentSigner/DocumentExport/DocumentComment/Organisation/OrgMember/BrandingProfile and the supporting enums
  - Reverse relations added to `User`

- [x] 2. Generate Prisma migration
  - Applied: `tools/prisma/migrations/20260517121213_add_documents_domain/`
  - Prisma Client regenerated

- [x] 3. Seed base DocumentType + DocumentTemplate rows
  - Extended `tools/prisma/seed.ts` with rent_agreement (templates: rent-classic, rent-bilingual), rti (rti-default-en, rti-default-hi), legal_notice (notice-formal)
  - Each seeded as system-owned

- [x] 4. Stub NestJS documents module
  - Files under `apps/api/src/app/documents/`: documents.module.ts, documents.controller.ts, documents.service.ts, documents.dto.ts
  - Registered in app.module.ts
  - CRUD endpoints in place; create-doc path calls `WalletUsageService.checkQuota('documents')` + `trackUsage` on success

- [x] 5. Scaffold libs/document-schema (TS lib)
  - Minimal package.json + project.json + eslint config, mirroring `libs/shared/dto`
  - Exposes registry pattern (`registerDocumentType`, `getBundle`, `requireBundle`)
  - Lints clean
  - Path alias `@org/document-schema` added to `tsconfig.base.json`

- [x] 6. Scaffold libs/document-templates (React lib)
  - Minimal package.json + project.json + eslint config
  - Page primitives (`Page`, `PagePrintStyles`), `Paginator`, `StampPaperFrame`
  - Template registry (`getTemplate`, `TemplateRenderer`)
  - Lints clean
  - Path alias `@org/document-templates` added to `tsconfig.base.json`

- [x] 7. Scaffold apps/artboard (Vite React app)
  - Manual minimal scaffold (mirrors `apps/app` shape) rather than the generator
  - Files: `apps/artboard/{project.json, package.json, index.html, tsconfig.app.json, vite.config.mts, eslint.config.mjs, src/main.tsx, src/app/LivePreview.tsx, src/app/RenderRoute.tsx}`
  - Vite plugins: `react`, `nxViteTsPaths` (resolves `@org/document-templates`)
  - Build produces `dist/apps/artboard/{index.html, assets/}` (445 kB, 135 kB gzip)
  - Routes: `/` listens for postMessage `{type:'doc:update', payload:{componentKey,data,pageSize}}`; `/render/:componentKey` accepts `?data=<base64>` for dev or `?docId&token` for production; sets `window.__ARTBOARD_READY__` after pagination settles

- [x] 8. Seed plans for documents pricing
  - Added Starter Monthly (₹199) and Agency Monthly (₹2499); Free + Pro already existed
  - Seed run completed

- [x] 9. tsconfig path aliases
  - Added `@org/document-schema` and `@org/document-templates` to `tsconfig.base.json`

- [x] 9.1 Add INTERNAL_RENDER_TOKEN env var
  - Required by `apps/api` documents `renderPayload()` and `apps/artboard /render/:componentKey`
  - Set in `.env` and `.env.example`. Any opaque random string ≥ 32 chars.

- [x] 9.2 Legal-AI module (clause rewrite + rule suggest)
  - `apps/api/src/app/legal-ai/{legal-ai.module.ts, legal-ai.service.ts, legal-ai.controller.ts, legal-ai.dto.ts}`
  - Wraps existing `AiService`; sources prompts from `@org/document-schema` registry
  - In-memory 24h cache keyed by `sha256(promptId | version | userMessage)`
  - Decrements `WalletUsage.ai_attempts` via existing `WalletUsageService`
  - Appends disclaimer on every output
  - Endpoints: `POST /legal-ai/clause-rewrite`, `POST /legal-ai/rule-suggest`

- [x] 9.3 Documents render-payload endpoint
  - `GET /documents/:id/render-payload` (public, x-render-token header)
  - Returns `{componentKey, data, pageSize, language, jurisdiction}` to artboard's `RenderRoute`

### Phase 1 — Rent agreement end-to-end

- [x] 10. Schema registry in libs/document-schema
  - `src/types.ts`, `src/_registry.ts`, `src/rent-agreement/{schema.ts, form-metadata.ts, risks.ts, prompts.ts, index.ts}`
  - Zod schemas for parties/property/term/rent_deposit/utilities/rules/witnesses, plus `RentAgreementDraftSchema` for autosave
  - Form metadata with widgets/helperText/showIf/aiPromptKey
  - Risk rules with effective-date annotations: registration threshold by state, KA/MTA deposit caps, notice/lock-in sanity, late-fee punitiveness
  - Versioned prompts for clause rewrite, rule suggestion, lock-in explainer, party formatting, missing-clause scan

- [x] 11. Page primitives in libs/document-templates
  - `_internals/page-sizes.ts` — profile per `PageSizeKey` with mm-precise width/height/margins/reservedTop
  - `_internals/Page.tsx` + `PagePrintStyles` — `@page` CSS, on-screen frame, page numbers
  - `_internals/Paginator.tsx` — ResizeObserver-driven measurement; splits blocks across pages
  - `_internals/StampPaperFrame.tsx` — visual outline of reserved zone (screen-only)
  - `_internals/format.ts` — INR/date/party formatters

- [x] 12. Rent agreement classic template
  - `src/rent-agreement/classic/index.tsx`
  - Pure component `(data, pageSize) => ReactNode`
  - English, single column, paginator-driven, A4 + stamp-paper variants
  - Sections: heading, parties (landlord/tenant), premises, term, rent, deposit, utilities table, rules, termination, governing law, witnesses

- [ ] 13. Rent agreement bilingual template
  - `src/rent-agreement/bilingual/index.tsx`
  - Headings in Hindi/Marathi; body in English; same data contract

- [x] 14. Wire artboard to templates
  - `LivePreview.tsx` consumes `@org/document-templates`'s `TemplateRenderer` on postMessage updates
  - `RenderRoute.tsx` consumes the same `TemplateRenderer` for server-side renders

- [x] 15. Builder UI in apps/app
  - **Services**: added `createDocumentsService` + `createLegalAiService` to `@org/api-client`; instantiated in `apps/app/src/main.tsx`; exposed via `ServicesProvider` React context
  - **State**: TanStack Query for catalog/list/detail; local `useState` + `useDebounce(800ms)` autosave via `PATCH /documents/:id`. Redux slice deferred — not needed at this scale; reintroduce if cross-tab sync becomes a requirement.
  - **Pages**:
    - `/documents` — `DocumentsList.tsx` (grid of docs, empty state, new-doc CTA)
    - `/documents/new` — `NewDocumentPicker.tsx` (type → template selector)
    - `/documents/:id/edit` — `BuilderPage.tsx` → `BuilderShell.tsx` (full-bleed, no MainLayout)
  - **Builder panes**:
    - `SectionsTree.tsx` (left) — section anchors derived from `bundle.sectionOrder`
    - `BuilderForm.tsx` (middle) — derived inputs from `formMetadata`; widget-aware (text/textarea/date/number/currency/checkbox); `showIf` evaluator; per-field AI button when `aiPromptKey` is set
    - `ArtboardIframe.tsx` (right) — embeds `apps/artboard`; postMessage `{type:'doc:update'}` on every change; re-sends after `artboard:ready` signal
    - `RisksPanel.tsx` — renders deterministic risk warnings; jump-to-field navigation
  - **AI integration**: clicking a field's AI button calls `POST /legal-ai/clause-rewrite` with the field value; result replaces the value in-place; toast on cached/error
  - **Header**: title input + autosave status badge ("Saving…"/"Saved"/"Save failed") + disabled Share / Export PDF buttons (wired to upcoming Phase 2 work)
  - **Navigation**: "Documents" link added to MainLayout profile dropdown
  - **Env**: `VITE_ARTBOARD_URL` (default `http://localhost:5210`) consumed by `ArtboardIframe`
  - **Validation**: app builds clean (456 modules, 316 KB gzip), lints clean for all new files (0 errors, 0 warnings from new code)

- [ ] 16. Documents API full CRUD + autosave
  - Add PATCH /documents/:id validating data against DocumentType.schema via registry
  - Create DocumentVersion row every Nth patch

- [x] 17. PDF export endpoint + BullMQ worker
  - **Deps**: added `puppeteer-core@^24.10` (no embedded Chromium). For prod, bundle `@sparticuz/chromium` and point `PUPPETEER_EXECUTABLE_PATH` at its binary.
  - **API**:
    - `apps/api/src/app/documents/exports/exports.dto.ts` — Zod DTO for `{ format: 'pdf', pageSize? }`
    - `exports.service.ts` — `enqueueExport()` creates DocumentExport row and adds a `doc-pdf` job; `getExport()` returns status; `PDF_QUEUE_ENABLED` token reflects whether REDIS_URL is set
    - `pdf-render.processor.ts` — BullMQ `@Processor('doc-pdf')`. Launches Puppeteer at `PUPPETEER_EXECUTABLE_PATH`, navigates to `${ARTBOARD_URL}/render/:componentKey?docId&token&pageSize`, waits for `window.__ARTBOARD_READY__===true` (15s timeout), runs `page.pdf({ printBackground:true, preferCSSPageSize:true })`, uploads via existing `StorageService` to `documents/<id>/exports/<id>.pdf`, writes sha256 checksum + bytesize back to DocumentExport
    - `exports.module.ts` — `forRootAsync()` mirroring MailModule; gracefully degrades when REDIS_URL absent (creates DocumentExport with `failed` status + helpful error message)
  - **Endpoints** (all authenticated, scoped to user/org):
    - `POST /documents/:id/exports` → enqueue, returns `{ id, status, ... }`
    - `GET /documents/:id/exports/:exportId` → status poll
    - `GET /documents/:id/exports/:exportId/download` → presigned S3 URL (or `{ready:false, status, error}`)
  - **Builder UI**:
    - `builder/useExportPdf.ts` — hook that enqueues, polls every 1500ms (≤60s), fetches presigned URL on success
    - Export PDF button in `BuilderShell.tsx` triggers the hook; auto-opens the URL in a new tab when ready; toasts on failure
  - **api-client**: extended with `enqueueExport`, `getExport`, `getExportDownload`
  - **Env vars** documented in `.env.example`: `PUPPETEER_EXECUTABLE_PATH`, `PUPPETEER_LAUNCH_ARGS`, `REDIS_URL`, `ARTBOARD_URL`, `INTERNAL_RENDER_TOKEN`
  - **Validation**: api + app + artboard all build clean. New files lint clean (0 errors, 0 warnings). 6 pre-existing lint issues in unrelated admin/auth/settings files left as-is.

- [ ] 18. Risk panel in builder
  - Sidebar in BuilderShell.tsx calling `risksFor(type)(data)` on every form change
  - Shows warning list with anchor links back to the field

- [ ] 19. Paywall on export
  - Before enqueueing export, call `WalletUsageService.checkQuota(user.id, Feature.documents)`
  - Decrement once per document (not per export)
  - Block export for free tier on stamp-paper sizes

### Phase 2 — Sharing, signing, collaboration

- [x] 20. Share-link issuing (API)
  - `apps/api/src/app/shares/{shares.module.ts, shares.controller.ts, shares.service.ts, shares.dto.ts}`
  - `POST /shares` (auth) issues a 48-char hex token; optional bcrypt'd password; optional expiry
  - `POST /shares/public/:token` (public, throttled to 10/min) resolves the document; returns `{requiresPassword: true}` on locked links
  - Registered in `app.module.ts`

- [ ] 21. Public share page (apps/web)
  - `apps/web/src/app/share/[token]/page.tsx`
  - Calls `POST /shares/public/:token` server-side; renders via `@org/document-templates` `TemplateRenderer`
  - Password gate; expiry/error states; noindex meta

- [ ] 22. Comments
  - DocumentComment CRUD with anchor { sectionKey, fieldPath }
  - In builder UI, show comment pins next to fields; resolve flow

- [ ] 23. Signer model
  - POST /documents/:id/signers, PATCH /signers/:id
  - Drawn/typed UI in `apps/web/src/app/share/[token]/sign/page.tsx`

- [ ] 24. Aadhaar eSign (Digio)
  - `apps/api/src/app/signers/providers/digio.provider.ts`
  - Create signing request, redirect URL, webhook handler
  - Persist signed PDF in S3; append audit-trail page using pdf-lib

### Phase 3 — RTI + Legal notice

- [ ] 25. RTI schema + templates (en + hi)
  - Field set: applicant, target department, PIO, info sought, timeframe, fee mode
  - Hindi template required

- [ ] 26. PIO directory lookup
  - Seed LookupGroup{key:'pio_directory'} with state→department→PIO entries
  - Source: cic.gov.in/state portals; manual curation in `tools/prisma/seed-data/pio.ts`

- [ ] 27. Legal notice schema + templates
  - Variants: consumer, employment, civil, cheque-bounce (NI §138)
  - Each with its own risk rules

### Phase 4 — Multi-persona

- [ ] 28. Organisation module
- [ ] 29. Branding profile applied to PDF
- [ ] 30. White-label subdomain middleware in apps/web
- [ ] 31. Lawyer verification flow (admin review of BCI evidence)
- [ ] 32. Template marketplace MVP (publish + 20% revshare)

### Phase 5 — Long tail + eStamp + PWA

See `/LEGAL_DOCS_PLAN.md` §3 Phase 5.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "name": "Wave 1 — Foundation models & scaffolding",
      "tasks": [1, 3, 4, 5, 6, 7, 8]
    },
    {
      "name": "Wave 2 — Migration & aliases",
      "tasks": [2, 9],
      "dependsOn": [1, 5, 6]
    },
    {
      "name": "Wave 3 — Schema registry & page primitives",
      "tasks": [10, 11],
      "dependsOn": [9]
    },
    {
      "name": "Wave 4 — Templates & artboard wiring",
      "tasks": [12, 13, 14],
      "dependsOn": [10, 11, 7]
    },
    {
      "name": "Wave 5 — Builder UI & API",
      "tasks": [15, 16],
      "dependsOn": [10, 14, 4]
    },
    {
      "name": "Wave 6 — Export, risks, paywall",
      "tasks": [17, 18, 19],
      "dependsOn": [14, 15, 16, 8]
    },
    {
      "name": "Wave 7 — Sharing & signing",
      "tasks": [20, 21, 22, 23, 24],
      "dependsOn": [16]
    },
    {
      "name": "Wave 8 — Additional document types",
      "tasks": [25, 26, 27],
      "dependsOn": [10]
    },
    {
      "name": "Wave 9 — Multi-persona & marketplace",
      "tasks": [28, 29, 30, 31, 32],
      "dependsOn": [16, 28]
    }
  ]
}
```

## Notes

### Cross-cutting rules

- Every new template must render for every supported jurisdiction in a Vitest snapshot test
- Every new doc type must include a risks module with at least one rule
- Every new AI prompt must have a `version: 'YYYY-MM-DD'` field; bump on any change
- Run `pnpm nx run-many -t lint typecheck test` before opening a PR

### Environment assumptions

- Postgres is reachable for migrations; if not, generate SQL only
- Redis is available for AI caching and BullMQ
- S3-compatible storage is configured for document exports
- `ARTBOARD_URL` and `INTERNAL_RENDER_TOKEN` env vars must be set for PDF rendering
