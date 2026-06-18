# TASKS — master backlog & burn-down ledger

> **This is the single durable source of truth for remaining work.** It is checked into git,
> so it survives logout / a different account / a fresh Claude session. Update the checkboxes
> here as work lands, and append details to [`BUILD_LOG.md`](BUILD_LOG.md).
>
> **Resume protocol (read this first every session):**
> 1. Read this file top-to-bottom. The first unchecked `[ ]` in the highest open tier is "next".
> 2. Cross-check against `BUILD_LOG.md` (newest entries) — it's the journal of what actually shipped.
> 3. Verify gate for every unit: `pnpm nx typecheck @org/app` + `pnpm nx build @org/api` + lint (0 errors).
> 4. Tick the box, add a one-line evidence note, append `BUILD_LOG.md`.
>
> Legend: `[ ]` not started · `[~]` partial · `[x]` done (with evidence) · 🔒 blocked (needs external thing).
> Last updated: **2026-06-13**.

---

## Tier 0 — Truth & verification (do these first; cheap, unblock everything)

- [ ] **Refresh `04-progress-tracker.md`** to match the codebase (it's stuck at 2026-06-07: claims 1 doc
      type, no Claude provider, no `/generate` — all false now). 
- [ ] **Refresh stale parts of `08-strategic-roadmap.md`** (citation validation IS wired; 15 bundles not 4;
      Schedule-1 gate done; P4.2 built).
- [ ] **`VERIFICATION_LOG.md`**: browser-walk rent-agreement (create→fill→risks→PDF→share→public) and the
      doc-intelligence flow (upload→classify→extract→review→approve→editable). Record every bug. *(Partly
      user-verified ad-hoc; needs a systematic pass.)*
- [ ] Resolve the **strategy conflict**: `06-platform-strategy` cut-list says "no heavy workflow engine /
      no marketplace", but `07` built the engine and `02/E` plan a marketplace. Pick one, write it down.

## Tier 1 — Trust & correctness moat (highest product value)

- [x] Server-side citation validation wired into legal-ai generate/revise (`citationWarnings`). *(done earlier)*
- [x] Schedule-1 eSign hard-gate by doc type (`signers.service` throws on excluded). *(done earlier)*
- [ ] **Citation-fill step**: not just validate — look up + insert the correct current section
      (`{{applicable_law}}` → BNS/BNSS/BSA) server-side. Expand section-level coverage in `@org/legal-reference`.
- [ ] **AI accept/reject diff UI** for `/legal-ai/revise` (endpoint exists; today it replaces text). Cheap, high trust.
- [x] **PII log-stripping** — `apps/api/src/app/common/redact.ts` (`redactPii` masks email/phone/Aadhaar/PAN)
      + pino `formatters.log` scrubs req url/query/msg + expanded `redact` paths (password/otp/token/set-cookie).
      Verified: `?q=email` → `[email]`. (No AI prompt logging exists, so nothing to wrap there.)
- [ ] **"Updated for BNS/BNSS/BSA (1 Jul 2024)" currentness badge** + a CrPC→BNSS diff lookup tool (UI).

## Tier 2 — Court documents (the B2B revenue bet) — promote presets → structured bundles

- [x] **Writ petition** preset + `COURT_SCAFFOLDS` entry (Art. 226/32) — **already shipped** (preset
      `writ-petition` + scaffold both exist; the docs were stale). 66 freeform presets exist total.
- [ ] **§138 cheque-bounce notice** → structured `DocumentTypeBundle` + template + risks + state libs.
- [ ] **Consumer complaint (CPA 2019)** → structured bundle (District/State/National variants).
- [ ] **Anticipatory bail** → structured bundle (BNSS sections, per-state).
- [ ] Per-state risk libraries for the above.

## Tier 3 — Export & output (advocate-grade)

- [ ] **True OOXML DOCX** through the exports pipeline (`docx` lib or headless LibreOffice worker) — today
      only a client-side `.doc` HTML exists.
- [ ] **PNG / preview-image export** (enum already supports `png`).
- [ ] **Branded output** (`BrandingProfile` → PDF/DOCX header/footer: logo, footer, Bar Council no.).
- [ ] **Calibration ruler PDF** for stamp-paper printer alignment.

## Tier 4 — Signing & collaboration

- 🔒 **eSign provider (Digio)**: invite→OTP→webhook→signed PDF→`SignerStatus.signed`. *(needs Digio creds)*
- [ ] **Render captured signature onto the exported PDF** (capture works; not painted onto artboard output).
- [ ] **Signer reorder UI**.
- [ ] **Audit-trail page** appended to signed PDF (who/when/IP/OTP txn).
- [ ] **SSE live-refresh** for comments (today react-query refetch) + true **section-anchored** comment UI
      (anchor is stored, UI is document-level).

## Tier 5 — Document intelligence (docs/05 + 07 remainder)

- [x] Phases 0–3 code-complete; pipeline engine P4.1/P4.3/P4.4; analysis + RAG; admin schema/pipeline UI. *(done)*
- [ ] **Pipeline export targets (P4.5)**: CSV / JSON batch export + webhook (today only convert→Document).
- [ ] **Batch ingest sources (P4.6)**: zip upload, then S3-prefix, then API push (today multi-file only).
- [ ] **Per-stage BullMQ queueing + StageExecution reconciler** (job reconciler exists; per-stage not).
- [ ] **Subsume legacy `IntelligenceJob`** into the pipeline engine (two parallel paths today).
- [ ] **Matter / case workspace** (multi-document grouping).
- [ ] **Document comparison / diff** (two versions or two docs).
- [ ] **Redaction / PII tooling** on uploaded docs.
- 🔒 **OCR-accuracy benchmark** on real Hindi/scanned docs + **eval harness on a gold set**. *(needs real data)*

## Tier 6 — Multi-persona, i18n, platform

- [ ] **Org/agency multi-tenancy UI/flows** (models + access checks exist; no UI: create org, invite, roles, switch).
- [ ] **Advocate verification** (BCI number → `BrandingProfile.barCouncilNumber`, manual review).
- [ ] **Hindi UI completion**: auth pages, editors + sub-components, `SharedDocumentView`, finish Settings + native QA.
- [ ] **Template marketplace** (advocate publishes; revenue share; `DocumentTemplate.ownerType` supports it).
      *(NOTE: conflicts with `06` cut-list — resolve Tier-0 strategy item first.)*
- [ ] **White-label share subdomains** (Next.js middleware + DNS wildcard).
- 🔒 **eStamp aggregator integration** (manual stamped-paper upload first). *(needs provider)*
- [ ] **PWA + offline drafting** (redux-persist already wired).

## Tier 7 — AI drafting depth (Phase A remainder)

- [ ] **Schema-structured generation**: NL brief → Zod-structured `Document.data` (today freeform HTML only).
- [ ] **Conversational intake**: tool-use loop that asks for missing required fields before generating.

## Tier 8 — Search follow-ups (docs/09 shipped; these are enhancements)

- [x] Hybrid keyword+semantic search, facets, sort, scoring v2, ⌘K palette, pagination, configurable. *(done)*
- [ ] "Did you mean?" suggestions (trgm against the corpus).
- [ ] Saved searches / recent queries in the palette.
- [ ] Per-field weight tuning in admin (title vs body).
- [ ] Search analytics (top queries, zero-result queries).

## Tier 9 — Document Vault (entities + their documents, secure, autofill) — `docs/10-document-vault-RESUME.md`

- [x] Config key `VAULT_ENCRYPTION_KEY` + design doc + this ledger entry.
- [x] Prisma `VaultEntity` / `VaultDocument` / `VaultAccessLog` + migration `document_vault` (drift-safe wrapper; 3 tables, SearchIndex indexes intact).
- [x] `VaultCryptoService` (AES-256-GCM, verified roundtrip) + `VaultService` (CRUD, encrypt-at-rest,
      mask-by-default, audited reveal/download, S3 docs) + controller + `@org/dto` schemas + module. api build ✓.
- [x] Frontend: api-client + `VaultPage` (list/create) + `VaultEntityPage` (masked detail, reveal-&-edit,
      doc upload/view/remove, delete) + `/vault` routes + sidebar nav + i18n. app typecheck/build ✓, lint 0.
- [x] Builder **"Insert from vault" autofill** — per-section button in `BuilderForm` → `VaultAutofillDialog`
      → `mapToSection` (canonical key → section leaf-field synonyms) → batch `setMany`. app typecheck/build ✓, lint 0.
- [x] **Typed + grouped fields** — field defs gained `type` (text/date/select/textarea/number/tel/email) +
      `group` + `options`; `VaultEntityPage` renders date pickers, dropdowns (states/gender/entity-type), etc., grouped.
- [x] **Scan-autofill** — doc kinds (Aadhaar/PAN/…) declare which canonical fields they fill;
      `POST …/documents/:docId/scan` vision-extracts via `AiService` → suggestions → merged into empty fields.
      "Scan & autofill" button per scannable document. (Needs a vision AI provider; gated + audited.)
- [x] **DB-backed configurable catalog + admin** — `VaultFieldConfig` + `VaultDocKindConfig` (org-scoped,
      system default seeded from code, code = ultimate fallback); `VaultConfigService` resolves org→system→code;
      admin API `/admin/vault/{fields,doc-kinds}` + `VaultConfigManager` UI (ConfigShell tab `/admin/intelligence/vault`).
- [x] **UX + lifecycle:** shared `@org/ui` `DatePicker` (calendar) used by vault + builder; entity
      **duplicate**, **enable/disable** (`isActive`, hidden from autofill when off), ⋯ actions menu (list +
      detail), muted disabled cards.
- [x] **Lookup-linked fields** — field `type: 'lookup'` + `lookupKey` pulls options from the Lookups system
      (e.g. country/state), configurable in the admin form. Reuses `useLookupOptions`.
- [ ] Later: OCR via the full intelligence pipeline (vs the direct vision call); org-override editing in the admin UI
      (`?orgId=` API supports it); freeform-editor autofill; overwrite-vs-fill-empty toggle; copy-to-clipboard on revealed values.

## Tier 10 — App-wide UI/UX consistency (standing rule: `feedback_ui_consistency`)

- [x] Audit every feature page; app largely conformant (Dashboard/DocumentsList/BatchesPage exemplary).
- [x] Native `<input type=checkbox>` → `@org/ui` `Checkbox` (BuilderForm boolean field, SearchSettingsManager kinds).
- [x] Loading `Spinner` on Settings + AdminDashboard; single-run Skip confirm in BatchDetail.
- [x] SearchPage pager → `Button`; TemplatesPage category filters → `Chip`.
- [x] Container/header normalization (Search/Vault/VaultEntity/NewDocumentPicker) — rely on MainLayout `max-w-6xl`.
- [ ] DraftWithAIPage: explicit Cancel/back; normalize Batch/Review detail container widths.
- [ ] Pass over remaining dialogs/forms for consistent footer (Cancel + primary) + inline errors.
- [x] **Jump-to-any-page** in the DataTable pager (client + server mode → all tables).
- [x] **Lean lists + per-item CRUD** (memory `feedback_ui_consistency` §5): Lookups server-paginated with
      summaries + `getOneAdmin(id)` (values on select); Vault list no longer decrypts fields (fields on select via get/reveal).
- [ ] Apply lean-CRUD to **schemas + pipelines** admin (lists still embed nested fields/stages; add summary list + GET-by-key detail).

## Tier 11 — Estate & Wealth Vault (docs/13) — new module, toggleable

> Verify-first gate (docs/13 §11.1, D.1/D.2): the physical-asset wedge + nominee/will legal
> framing are UNVALIDATED. Don't push past M3 without (a) demand evidence and (b) lawyer review.

- [x] **M1 — module shell**: `EstateVaultModule.forRoot()` gated by `ESTATE_VAULT_ENABLED`;
      `EstateVaultConfig` config-as-data (org→system→code); `/admin/estate-vault/config`.
- [x] **M2 — asset inventory**: `Asset`/`AssetValuation`/`AssetDocument`(versioned)/`WealthSnapshot`
      models + migration; CRUD + net worth + value history API; gated UI (home/list/new/detail) +
      capability-gated nav. *(build + lint green; NOT runtime-tested.)*
- [ ] **Runtime-verify M2**: browser walk (add asset → net worth → re-value → history → reveal →
      delete; toggle `ESTATE_VAULT_ENABLED` off → nav/routes gone). Record in `VERIFICATION_LOG`.
- [~] **M3 — document capture + extract-assist**: per-asset document upload + versioning (§2.3) +
      presigned download + AI extract-assist (vision → suggested asset fields, autofill on add + on
      attached docs). Backend (`asset-document.service` + `estate-document.controller`, reuses
      Storage/Ai/sourcePart) + frontend (autofill on new, Documents section on detail). Build+lint green;
      NOT runtime-tested (needs vision AI). CAS hero-upload (multi-holding import: extract array → review →
      bulk-create) + **dedupe-on-reupload** (reconcile by type+institution+masked-id) done.
      **Remaining M3 (deferred — 3rd-party)**: DigiLocker source; classify-to-asset-type beyond the AI hint.
- [x] **M6 — gap nudges + freshness/dormancy engine**: descriptive nudges (no-nominee/value/stale/dormant)
      from config thresholds; `GET /estate/nudges` + home "Things to review" card. Build+lint green; not runtime-tested.
- [~] **M5 — nominee + release**: `Nominee`/`AssetNomination`/`ReleaseGrant`/`EstateAccessLog` +
      liveness `setInterval` scheduler + owner check-in + **human-verified** admin release (§11.6) +
      token-scoped nominee register / Estate Report (§10.3) + how-to-claim per type. Backend + frontend
      done (migration `estate_nominee_release`; build+lint green). *(NOT runtime-tested; built on the
      single-key crypto — see M4.)*
- [x] **M4 — envelope encryption**: per-asset DEK (AES-256-GCM) wrapped per principal via
      HKDF-derived KEKs over `VAULT_ENCRYPTION_KEY` (`DataKey` model + migration); rotation on
      nominee removal; lazy + boot backfill of legacy blobs; nominee release reads only its
      wrapped DEK. KMS swap deferred to an ops change (no schema change). Build+lint green; NOT
      runtime-tested. *(Not zero-knowledge — accepted v1 trade-off, docs/13 §1.1.)*
- [x] **M5 hardening**: nominee proof-of-death upload (public token) + admin verification page
      (`/config/estate-vault/grants`, presigned proof view + manual Release); multi-instance-safe
      scheduler (`SchedulerLease` atomic claim); legal-review tracking entry in config (manual
      follow-up, no workflow). Lawyer review itself still pending (gated). Build+lint green.
- [ ] **Runtime-verify M5**: add nominee → assign to asset → check-in → (admin) release → open `/n/:token`
      → confirm scoped, revealed register; revoke; non-released token 403s.
- [x] **Admin config UI** for the asset-type catalog + toggles (`/config/estate-vault`).
      Whole-config editor (module/currency/cadence/thresholds/toggles + inline asset-type
      catalog) over the existing `/admin/estate-vault/config`; route + estate-gated nav item.
      Build + lint green; NOT runtime-tested.
- [x] **Extract: text-first + password PDFs** — estate extract parses the PDF text layer (works
      with text-only providers; fixes the `extract-holdings` 500) and accepts a password for
      protected CAS statements (typed `PdfPasswordRequiredError` → 400 → UI retry). Build+lint green.
- [x] **Wealth Vault nav submenu** — sidebar group (Overview/Assets/Add/Import/Bulk import/
      Nominees/Release/Report) replacing the single dashboard link.
- [x] **Multi-file bulk import** — `POST /estate/import-files`: N files (with per-file passwords) →
      one asset each + the file attached, auto-extracted; per-file status/retry UI.
- [x] **Nominee = Vault person** — every nominee backed by a Vault PERSON entity (source of truth
      for DOB/Aadhaar/PAN/phone/address + docs); KYC de-duplicated off the Nominee; relationship
      lookup; New-person / Link-existing form. Build+lint green.
- [x] **Estate Report PDF** — `GET /estate/report.pdf` renders the masked owner report to PDF via
      headless Chrome (self-contained `setContent`→`pdf()`, no Document/artboard/S3); Download button.
- [x] **CAS dedupe fix** — `findDuplicate` now keys on label too (one MF folio spans many schemes).
- [x] **CAS extraction overhaul** (user: 36L vs 50L under-count) — (1) holdings `maxTokens` 8000→32000
      + no-truncate prompt + extract the statement's printed grand total → `{holdings,summary,reconciliation}`
      with an amber "totals don't match" banner in import; (2) **units** end-to-end (`Asset.unitsHeld` +
      migration, DTO `units`, per-type `tracksUnits` flag, new/detail/import UI); (3) **per-type extraction
      guidance** (`EXTRACTION_GUIDANCE`, MF→units×NAV not cost, etc.); (4) **keep source statement +
      encrypted password** mapped to every imported asset (`AssetDocument.passwordEnc` + migration,
      `POST /estate/import-holdings`, re-extract reuses stored password). Build+lint green; NOT runtime-tested
      (needs vision AI + real CAS). ⚠️ existing estate config rows need re-save for MF/stocks `tracksUnits` UI.
- [x] **Assets list bulk actions** — row selection + bulk soft-delete toolbar; search already present.
- [ ] **Forms**: revisit react-hook-form + field-level inline errors per CODING_STANDARDS (M2 used
      direct `useState` to match existing vault pages).

## Payments / GTM (gates expansion per `08`)

- [ ] Payments live for one tier (actually charge ₹49–₹199); the "draft free, pay to export" paywall.
- [ ] SEO / own one search term; instrument the funnel.
- [ ] **First 10 paying users** (the only metric that matters before broad expansion — `08` §6).

## Estate Intelligence stream (2026-06-18) — charts, asset detail, doc analysis, search

Self-contained resume notes. Tables touched are polymorphic (`AnalysisRun`,
`SourceChunk` use `subjectType` string + `subjectId`; `SearchIndex` uses `kind`+`refId`),
so estate plugs in as `subjectType='asset_document'` with NO schema churn.

- [x] **Estate dashboard charts** — `features/estate/components/charts.tsx` (donut/trend/bars,
      themed SVG, mask-aware). Overview = net-worth trend (range filter) + allocation donut
      (category filter) + top holdings + fin-vs-physical. Report = allocation + nominee-coverage donuts.
- [x] **Per-asset-type detail fields** — registry `@org/dto` `estate/asset-fields.ts` (shared by app+API);
      `Asset.details Json?` (migration `20260618190000_estate_asset_details`, APPLIED); DTO create/update
      `details`; `asset.service` create/update/bulkCreate/present persist+return; New form + detail page
      (view + inline edit). Relabels maturity per type (insurance→"Valid till").
- [x] **Import → details** — `assetDetailGuidance`+`sanitizeDetails` (dto registry); both AI extract
      schemas gained a `details` object + guidance; `mapSuggestion` sanitises; import + autofill seed details.
- [x] **Per-type extraction prompt** — `extractFromUpload(file,password?,assetType?)` → focused prompt for
      the chosen type (`suggest()` focusType/guidanceKeys).
- [x] **Per-document analysis + Q&A** — `EstateDocumentAnalysisService` (analyze/latest/ask), reuses
      `@org/doc-intelligence` + `@org/legal-reference` + AnalysisRun/SourceChunk under `'asset_document'`.
      `AssetDocumentService.normalizedTextForDoc()`/`assertDocAccess()`. Endpoints
      `POST/GET .../documents/:docId/analyze|analysis`, `POST .../ask`. Client + AssetDocuments UI panel.
      ⚠️ needs working AI provider keys at runtime to actually analyze/embed.

### RESUME HERE — remaining slices (in progress)

- [x] **Slice A — Portfolio "wealth analysis"** — DONE. `PortfolioAnalysisService` (estate-vault):
      deterministic metrics (concentration, categorySplit, nomineeCoveragePct, maturingSoon) from
      `AssetService.netWorth` + `EstateReportService.ownerReport`; AI (`ai.extract`) narrates summary/
      risks/suggestions from those numbers only. `POST /estate/portfolio/analyze?profileId=`. Client
      `analyzePortfolio()` + `PortfolioAnalysis` type. UI: "Wealth analysis" card on EstateHomePage.
      api build + app/api-client green (only 2 pre-existing errors). Needs AI keys at runtime.
- [x] **Slice B — Vault-scoped search (REPLACED global-search approach)** — DONE.
      Per user: estate assets must NOT pollute the global drafting search — search lives at the VAULT level instead.
      • Reverted the global integration entirely: removed `kind='asset'` from `SearchIndexJob`/`SearchParams`/
        `SearchQueryDto`/`enabledKinds`/`SYSTEM_DEFAULT`/dto `searchConfigSchema`, deleted `enqueueAsset` +
        `SearchTextService.forAsset()` + all `enqueueAsset` calls (AssetService, EstateDocumentAnalysisService),
        and reverted client `SearchKind`/`hrefForHit`/GroupIntelligencePanel. (`AssetDocument.searchText` column +
        its population on analyze were KEPT — reused by vault search.)
      • New `EstateSearchService.search(profile, q, limit)` — profile-scoped, matches across asset fields
        (label/institution/JSON details), each attached doc's `searchText`+filename, and `AnalysisRun` summaries;
        best-match-per-asset (asset>document>analysis) with a context snippet + `matchedIn`. `GET /estate/search`
        (`vaultSearchQuerySchema` in @org/dto, `VaultSearchQueryDto`); profileId auto-applied by the interceptor.
      • UI: `EstateSearchPage` at `/estate/search` (debounced box, URL-synced `q`, type badge + matched-in badge +
        highlighted snippet, links to `/estate/assets/:id`); `estate.searchVault()` + `useVaultSearch()`; reachable
        from a "Search" secondary action on EstateHomePage.
      • Verify: api build + lint 0 errors; app/api-client/dto typecheck green (only the 2 pre-existing WIP errors).
        ⚠️ keyword-only (ILIKE/contains) — no AI/embeddings needed at runtime. Not runtime-verified end-to-end.

ALL estate-intelligence slices for this stream are now landed. Remaining ideas (not requested yet):
type/status filter on the vault search page; portfolio-analysis caching; "expiring soon" nudges from details.
