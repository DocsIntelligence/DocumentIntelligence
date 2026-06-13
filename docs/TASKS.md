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

## Payments / GTM (gates expansion per `08`)

- [ ] Payments live for one tier (actually charge ₹49–₹199); the "draft free, pay to export" paywall.
- [ ] SEO / own one search term; instrument the funnel.
- [ ] **First 10 paying users** (the only metric that matters before broad expansion — `08` §6).
