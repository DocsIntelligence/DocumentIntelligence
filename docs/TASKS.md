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
> Last updated: **2026-06-19**.

---

## ▶ Agreed execution order (2026-06-19) — burn down one-by-one, track progress

User direction: work the backlog **one feature at a time**, ticking boxes + appending `BUILD_LOG`
as each lands. Agreed sequence (re-orderable):

1. **Tier 1 — Correctness moat** *(active)*. NOTE the citation-fill *engine* is already built &
   wired: `CitationFillerService.fill()` runs inside BOTH `generateDocument` and `reviseDocument`
   (`legal-ai.service.ts:157,212`); `apply-fix` endpoint + `RisksPanel`/`CitationHealth` UI exist.
   Real remaining gaps: **(1a)** accept/reject **diff UI** for `/legal-ai/revise` (today it
   replaces the whole HTML wholesale); **(1b)** expand section-level **coverage** in
   `@org/legal-reference`; **(1c)** "updated for 1 Jul 2024" currentness badge + CrPC→BNSS diff tool.
2. Tier 0 — systematic verification walk → `VERIFICATION_LOG.md`.
3. Tier 2 — first structured court-doc bundle (§138 cheque-bounce).
4. Tier 3 → 4 → 5 → 6 → 7 → 8, then Payments/GTM (see tiers below).

---

## Tier 0 — Truth & verification (do these first; cheap, unblock everything)

- [x] **Refresh `04-progress-tracker.md`** to match the codebase — DONE. Was stuck at 2026-06-07 (claimed
      "no other doc type built", "no Claude provider" — both false). Rewrote it into a thin, accurate
      capability snapshot that points to THIS file + `BUILD_LOG.md` as the authoritative ledger (kills the
      3rd parallel tracker). Verified against code: Claude provider exists (`claude.provider.ts`,
      `claude-opus-4-8`), 18 bundles, citation validation/fill + Schedule-1 gate wired.
- [x] **Refresh stale parts of `08-strategic-roadmap.md`** — DONE. Added a dated "STATUS CORRECTION
      (2026-06-19)" banner + fixed §2: citation validation IS built (not "the single biggest unbuilt
      feature"), Schedule-1 gate done, 18 bundles not 4, three court bundles now structured (not freeform
      presets). Preserved the strategic argument (verify-before-breadth) — which the 3 new unverified
      bundles only reinforce.
- [ ] **`VERIFICATION_LOG.md`**: browser-walk rent-agreement (create→fill→risks→PDF→share→public) and the
      doc-intelligence flow (upload→classify→extract→review→approve→editable). Record every bug. *(Partly
      user-verified ad-hoc; needs a systematic pass.)* **← the one Tier-0 item still open; needs the app +
      Postgres/Redis + AI keys running. ALSO now: browser-walk the 3 new court bundles after a DB reseed.**
- [x] Resolve the **strategy conflict** — DONE (`06-platform-strategy` §5.1, 2026-06-19). The `07` engine is
      a *document-processing* pipeline, NOT the *human workflow/assignment* engine §5 cut → KEEP (freeze
      human-assignment queues until multi-reviewer firms are the paying ICP). "Marketplace of lawyers" stays
      permanently cut; the *template* marketplace (`02/E`,`docs/12`) is DEFERRED behind the first-10-paying-
      users gate, not built. Nothing deleted; expansion frozen behind the usage gate.

## Tier 1 — Trust & correctness moat (highest product value)

- [x] Server-side citation validation wired into legal-ai generate/revise (`citationWarnings`). *(done earlier)*
- [x] Schedule-1 eSign hard-gate by doc type (`signers.service` throws on excluded). *(done earlier)*
- [x] **Citation-fill step**: ENGINE DONE — `CitationFillerService` fills `{{applicable_law}}` with the
      most-applicable citation + rewrites repealed-code refs (IPC/CrPC/Evidence → successor span); wired into
      generate + revise; `apply-fix` one-click endpoint + RisksPanel UI exist. **(1b) DONE**: added ~37
      citations to `@org/legal-reference` — 11 stable-act refs (TPA §105/§106, Contract Act §73/§74,
      Arbitration §7, Succession Act §63, PoA Act, Gratuity §4, Stamp §17, DPDP 2023) mapped to real bundle
      keys via `appliesTo`, + 26 web-verified IPC→BNS / CrPC→BNSS / Evidence→BSA `supersedes` remaps (2+
      sources each) so the validator now suggests successors for 304A/498A/304B/124A/499-500/506/379/392/406/
      323/376/354/363 and CrPC 125/144/156(3)/161/164/41/437/439/436/320 and IEA 65B/45/32/25-26. All
      confidence-flagged + `verifyNote`; BNS §152 explicitly flagged as a new offence, NOT a sedition rename.
- [x] **(1a) AI accept/reject diff UI** for `/legal-ai/revise` — DONE. Was whole-document accept/reject over a
      plain-text word diff; now **per-change**: `revision-diff.ts` gained `diffHtmlBlocks` (block-level LCS over
      HTML paragraphs/headings/list-items) + `reconstructHtml` (rebuild from per-hunk decisions). TemplateEditor's
      review modal lists each change hunk with a Checkbox (accepted by default) + intra-hunk word diff +
      Accept-all/Reject-all; Apply reconstructs only the kept hunks. typecheck app green; lint 0 errors. NOT
      runtime-verified (needs AI keys to produce a real revision). Used by DraftEditorPage + EditorDemo (shared editor).
- [x] **PII log-stripping** — `apps/api/src/app/common/redact.ts` (`redactPii` masks email/phone/Aadhaar/PAN)
      + pino `formatters.log` scrubs req url/query/msg + expanded `redact` paths (password/otp/token/set-cookie).
      Verified: `?q=email` → `[email]`. (No AI prompt logging exists, so nothing to wrap there.)
- [x] **(1c) "Updated for BNS/BNSS/BSA (1 Jul 2024)" currentness badge + CrPC→BNSS diff lookup tool** — DONE.
      Lib: `reformRemaps()` + `ReformRemap`/`RepealedCode` types in `@org/legal-reference` (derives old→new
      from the `supersedes` pointers — 26 mappings). UI: `ReformLookup.tsx` (client-side, no API) — currentness
      banner (3 act-level reforms + effective date) + single search box (matches code/section/topic, e.g. "302"
      or "CrPC 125") + grouped old→new table with confidence chips + links to `/law/:id`; routed at
      `/config/legal-reference/reform` with a header link from the catalog. `ReformBadge` ("✓ Current to 1 Jul
      2024") dropped into the `CitationHealth` panel. typecheck ✓, lint 0 errors. NOT runtime-verified.
- [x] **Legal-reference admin flow fixes** (add-to-masters + sync-from-link, reported broken): (1) sync now
      honours the admin-pasted `externalUrl` (indiacode host) instead of only guessing a handle from the act
      name — unblocks acts not in the curated map; (2) fixed a **data-loss bug** where syncing a code-seed
      citation overwrote act/title/section/topics with "Unknown act"/"Untitled" defaults (`createOrUpdate` is
      now skip-undefined, sync spreads the full merged citation); (3) sync now persists `fullText`; (4) the
      editor can re-open INACTIVE citations (`getAdmin` bypasses the active-only cache); (5) the editor's
      Active/Public toggles are now live (hydrated from the row + sent on save) instead of dead decoration.
      Verified: api build ✓, app typecheck ✓, lint 0 errors. NOT runtime-verified (needs a live indiacode sync).
- [x] **Bulk statute-PDF import** (user-requested; massively expands section coverage) — DONE. Upload a full
      bare-act PDF (e.g. the 112-page BNS) → auto-create a `LegalCitation` per section. `CitationImportService`:
      `ParsingService` → deterministic **monotonic section walk** (find `N.` then `N+1.` at line starts;
      skips the front-matter/“arrangement of sections” index via the enacting-formula/“Chapter I” marker) →
      verbatim per-section text + best-effort heading (marginal note up to the em-dash). **Moat-safe**: statute
      text is extracted verbatim, NEVER AI-authored; `summary` is a neutral stub + `confidence` + `verifyNote`
      flag each row as review-pending; imported rows default `isPublic:false`. **Big-file handling**: two-step
      parse→preview→commit — the parse caches the full result server-side (in-memory, 20-min TTL) under an
      `importId` and returns only a lightweight preview (section/title/charCount/snippet), so a 350-section act
      never round-trips its full text through the browser/JSON-body; commit is by `importId`, batched (25/commit),
      with include-subset + overwrite-existing toggles. Endpoints `POST admin/citations/import/{parse,commit}`
      (parse = multipart `FileInterceptor`). UI: "Import from PDF" button in `LegalReferenceManager` →
      `CitationPdfImportDialog` (metadata form prefilled for BNS + upload → preview table w/ per-section
      checkboxes + warnings → "Import N sections"). Verified: api build ✓, app typecheck ✓, app/api lint 0
      errors. NOT runtime-verified (heuristic parser — needs a real BNS PDF; preview-first by design so a human
      catches mis-segmentation before commit). Follow-ups: OCR for scanned PDFs; AI-assist for heading/summary;
      per-section chapter/part tagging.
- [x] **Bulk import — JSON-array mode** (user-requested; complements the PDF path) — DONE. The import dialog
      gained a "PDF | JSON array" toggle. JSON mode accepts an uploaded `.json` file OR pasted text (a citation
      array, or `{sections:[…]}`); `beginJsonImport` validates each loosely-typed record → staged section
      carrying **per-record summary/fullText/draftingTips/topics/appliesTo/confidence/supersedes/externalUrl/
      effectiveFrom** which WIN over the batch defaults at commit. So the user can AI-generate fully-formed
      records externally (real 2–3-para summaries + every field) and just upload — sidesteps the stubbed-summary
      gap of the raw PDF path. Multipart upload (not JSON body) so big arrays dodge Express's ~100 kb limit.
      `commit` extended to honour per-section fields. Endpoint `POST admin/citations/import/json`. Verified:
      api build ✓, app typecheck ✓, app/api lint 0 errors. NOT runtime-verified.
- [x] **Legal-reference catalog bulk actions** (user-requested) — DONE. Row selection + an in-box bulk-action
      bar on the citations `DataTable` (Enable / Disable / Make public / Make private / Delete, delete confirmed).
      Backend `LegalReferenceService.bulkAction(ids, action)` (deleteMany / updateMany + cache invalidate;
      in-code seeds untouched) + `POST admin/citations/bulk` (`BulkCitationActionDto`, ≤1000 ids). Especially
      useful right after a bulk import (e.g. select the freshly-imported BNS sections → Make public). Verified:
      api build ✓, app typecheck ✓, app/api lint 0 errors. NOT runtime-verified.

## Tier 2 — Court documents (the B2B revenue bet) — promote presets → structured bundles

- [x] **Writ petition** preset + `COURT_SCAFFOLDS` entry (Art. 226/32) — **already shipped** (preset
      `writ-petition` + scaffold both exist; the docs were stale). 66 freeform presets exist total.
- [x] **§138 cheque-bounce notice** → structured `DocumentTypeBundle` + template + risks. DONE — new
      `cheque_bounce_notice` bundle (`libs/document-schema/src/cheque-bounce-notice/`): Zod schema
      (payee/drawer+§141 officers/cheque particulars/liability/demand + a loose Draft variant), form-metadata
      (date/select/currency/list/phone widgets + `showIf` advocate/company branches), 12 **deterministic**
      §138/§141/§142 risk rules (30-day demand window proviso (b) → error; <15-day payment window proviso (c)
      → error; stale-cheque >3mo → warning; company-without-officers → §141 warning; demand<cheque → warning;
      §142 complaint-window → info), versioned prompts (AI tightens narrative only, never authors sections).
      Formal A4 template (`cheque-bounce-notice/formal`, `EditableField` throughout). Wired in both registries +
      `document-types` seed (`cheque-bounce-formal` template, componentKey `cheque-bounce.formal`); legal-reference
      `ni.138/141/142` already `appliesTo: ['legal_notice','cheque_bounce_notice']` so the validator/filler cover
      it. `@org/app` typecheck ✓, lint 0 errors. **State libs N/A** — NI Act is a central act, uniform across
      India (per-state risk libs apply to consumer-complaint/anticipatory-bail below). NOT runtime-verified.
- [x] **Consumer complaint (CPA 2019)** → structured bundle (District/State/National variants). DONE —
      new `consumer_complaint` bundle (`libs/document-schema/src/consumer-complaint/`): Zod schema
      (complainant, `oppositeParties[]` group, transaction w/ **considerationPaid**, grievance + type,
      causeOfActionDate, reliefSought[], compensationClaimed, commercial-purpose flag, `forum` tier +
      `recommendedForum()`/`CPA_DISTRICT_MAX`/`CPA_STATE_MAX` helpers + Draft variant); form-metadata
      (select/currency/group/list widgets); **deterministic** risk rules — pecuniary-jurisdiction mismatch
      keyed on *consideration paid* (₹50L/₹2cr per the 2021 Rules) → error, §69 2-yr limitation → error,
      §2(7) commercial-purpose → warning, §34(2) territorial (OP address) → warning, §39 reliefs → warning,
      boundary nudge → info; versioned prompts (AI narrates facts/reliefs only, never sections). Standard A4
      template (`consumer-complaint/standard`) — petition format with **forum-branched filing section**
      (§35 District / §47 State / §58 National), jurisdiction + verification clauses, EditableField. Wired in
      both registries + `document-types` seed (category `court`, sortOrder 32). Added **7 web-verified CPA
      citations** to `@org/legal-reference` (§2(7)/§34/§35/§47/§58/§69/§39, all confidence `high`,
      `appliesTo:['consumer_complaint']`) + upgraded the `cpa.2019` umbrella to `high` w/ the 30-Dec-2021
      notification note. Verified: app typecheck ✓, API build ✓, lint 0 errors (legal-reference lint ✓).
      Thresholds web-verified (PIB + indiacode). State libs N/A (CPA is central). NOT runtime-verified.
- [x] **Anticipatory bail** → structured bundle (BNSS §482). DONE — new `anticipatory_bail` bundle
      (`libs/document-schema/src/anticipatory-bail/`): Zod schema (applicant +guardian/age, FIR optional,
      offences[], `offenceIsNonBailable`, `apprehensionGrounds`, `groundsForBail[]`, clean-antecedents/
      cooperate/no-custody flags, `proposedConditions[]` §482(2), advocate, `court` Sessions/HighCourt +
      Draft variant); form-metadata (select/list/number widgets); **deterministic** risks — missing
      applicant/apprehension → error, no-FIR-and-no-apprehension → warning, bailable-offence → info,
      missing offences/grounds → warning, **CrPC/§438 reference detector → warning** (cite BNSS §482 not
      repealed CrPC §438); versioned prompts (AI refines apprehension/grounds only). Standard A4 template
      (`anticipatory-bail/standard`) — forum-branched cause-title (Court of Session / High Court), State
      respondent, §482 heading, numbered grounds, PRAYER w/ §482(2) conditions, signature + VERIFICATION.
      Wired in both registries + seed (category `court`, sortOrder 33). Upgraded `bnss.482` citation to
      confidence `high` (web-verified successor to CrPC §438, eff. 1 Jul 2024) + noted the §482 renumbering
      trap (old CrPC §482 = inherent powers → now BNSS §528) + `commonlyPairedWith` §480/§483. Verified: app
      typecheck ✓, API build ✓, lint 0 errors. NOT runtime-verified.
- [~] Per-state risk libraries for the above. **DEFERRED with rationale (do NOT fabricate).** All three new
      bundles are *central* acts — §138 NI Act, CPA 2019 (the 2021 pecuniary rules are central), and §482 BNSS —
      so there is no high-confidence per-state *statutory* variation to encode (unlike rent-agreement, where
      `risks.ts` legitimately branches on `data.state` for MH/KA registration + MTA deposit caps). The one area
      with real historical per-state variation is **anticipatory bail** (old CrPC §438 state amendments — e.g. UP
      abolished/restored it; Maharashtra restrictions), but whether those amendments survive the BNSS repeal is
      legally UNCERTAIN — asserting them as current law would undermine the correctness moat. Encode only after
      per-state verification + lawyer review (same verify-gate discipline as docs/13). Infra already exists
      (state-branched rules in any bundle's `risks.ts`) — this is a data/verification task, not an engineering one.

## Tier 3 — Export & output (advocate-grade)

- [x] **True OOXML DOCX** through the exports pipeline — DONE. Added `'docx'` to the `@org/dto` export-format
      enum; the Puppeteer renderer gained a `docx` branch that scrapes the SAME rendered `.doc-page` HTML it
      would print to PDF (covers structured bundles, not just freeform `data.html`; excludes the Paginator's
      offscreen mirror + `aria-hidden` page-number chrome) and converts it via `@turbodocx/html-to-docx`
      (bundles cleanly into the webpack API build) → real `.docx` (`wordprocessingml` MIME, 2cm margins, Times
      New Roman 12pt). Uploaded/served through the existing export → S3 → presigned-download flow (`OUTPUT_META`
      map for ext+MIME). UI: "Word (.docx)" button in `BuilderShell`'s secondary-action row (`startExport('docx')`).
      Supersedes the legacy client-side `.doc` for the builder (the standalone editor keeps `export-word.ts`).
      Fidelity caveat: artboard heading styling lives in a `<style>` cascade, so centered/underlined headings
      don't transfer — structure/text/lists/tables do (accepted v1 trade-off for an editable file). Verified:
      api build ✓, app typecheck ✓, app/api/api-client/dto lint 0 errors. NOT runtime-verified (needs the
      artboard + Chrome render worker running). Follow-ups: per-pageSize DOCX (legal/foolscap) + inline heading styles.
- [x] **PNG / preview-image export** — DONE. New `@org/dto` `export.schema.ts` (`EXPORT_FORMATS=['pdf','png']`,
      `exportFormatSchema`, `ExportFormat`) is the single source of truth; `exports.dto.ts`, the renderer payload
      (`PdfRendererService`), `ExportsService.enqueueExport({format,pageSize})`, the controller, and the api-client
      `CreateExportPayload` all derive their format from it. The renderer screenshots the same artboard page
      (`page.screenshot({type:'png',fullPage:true})`) when `format==='png'`, uploads with the right ext +
      `image/png` content-type; `format` persisted on `DocumentExport` + returned by `getExport`. UI: `useExportPdf`
      `start(format)` + a "PNG image" button in `BuilderShell`'s secondary action row (calls `startExport('png')`).
      Verified: app typecheck ✓, api build ✓, lint 0 errors. NOT runtime-verified.
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
- [x] **Reusable signatures in the Vault** (user-requested) — DONE. New `VaultSignature` model (per entity,
      multiple; migration `20260619000000_vault_signature`) storing the signing payload (draw/upload PNG data
      URL, or typed text+font) AES-256-GCM **encrypted at rest**, mask-by-default, **audited reveal** — same
      security posture as vault fields. `@org/dto` `recordVaultSignatureSchema` (mirrors signers.dto) + service
      (add/revealSignature(audited)/setDefault/remove/allSignatures + masked metadata in `get()`) + controller
      endpoints. Frontend: extracted the `SignatureCapture` widget out of `SignaturesDialog` into a shared file;
      "Signatures" section on `VaultEntityPage` (add/list-masked/reveal-preview/make-default/delete). **Reuse
      payoff**: `GET /vault/signatures` flat picker + a "Use a saved signature" dropdown in the document
      `SignaturesDialog` → reveals + signs without redrawing. Verified: api build ✓, app typecheck ✓,
      app/api/api-client/dto lint 0 errors. NOT runtime-verified.
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

### Wealth-planner upgrade (2026-06-19) — richer configurable fields + advanced analytics

- [x] **Richer + configurable per-type fields** — enriched `@org/dto` `estate/asset-fields.ts` (labels +
      placeholders + many new fields; **real estate** now has ownership/co-owners/full address/area+unit/
      purchase date+price/value basis/loan/occupancy/rent/tenant/survey+registration). Made **configurable**:
      `estateAssetTypeSchema` gained optional `assetClass`/`liquidity`/`dateLabel`/`fields`; config service
      resolves config-override → code registry; client form threads resolved `fields` from `useAssetTypes()`
      (registry fallback). Code is always the fallback.
- [x] **Advanced wealth-planner analytics** — `portfolio-analysis.service.ts` rewritten: by class/liquidity/
      category, diversification (HHI) score, top-3 concentration, liquid %, maturity ladder, insurance cover,
      allocation gaps vs a configured target. Deterministic risks+suggestions (full value w/o AI) + AI summary/
      plannerNotes. New configurable `EstateVaultConfig.analysis` block (windows/thresholds/idealAllocation).
- [x] **Per-asset-type analysis** — `analyzeType()` + `POST /estate/portfolio/analyze/type/:type` (sub-allocation,
      top holdings, within-type HHI, MF return-on-cost, nominee gaps, AI summary); client `analyzeAssetType()`;
      EstateHome card enriched (stats, class-mix bars, liquidity/maturity, planner notes, per-type drill-down).
      Verified: app typecheck ✓, api build ✓, lint 0 errors. NOT runtime-verified. ⚠️ existing estate config
      rows need re-save (or rely on resolver code-fallback) to surface the new analysis block + per-type metadata.
- [ ] Later: admin UI to edit the `analysis` block + per-type `fields`/`assetClass` (config supports it; the
      `/config/estate-vault` whole-config editor can expose them); thread resolved `fields` into the asset
      **detail/edit** page too (new page done); per-individual-asset AI standing; "expiring soon" detail nudges.
