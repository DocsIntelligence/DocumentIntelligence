# Document Intelligence — RESUME point (next session)

**Status:** docs/05 **Phases 0–3 CODE-COMPLETE** · docs/07 **P4.1+P4.2+P4.3+P4.4 CODE-COMPLETE** + config-as-data honored end-to-end + batch routing/funnel/skip · **Updated:** 2026-06-11

> **Latest (2026-06-11):** (A) **Resolver wired everywhere** — `SchemaResolverService` now
> backs review (`getExtraction`), `convert` (DB field-maps honored), and legacy `/analyze`
> (`PipelineService.run`); per-field `fieldThreshold` honored in `decideReview`. No more
> code-registry bypass; the 24 DB types render real fields in review + convert. (B) **Batch
> routing** (migration `batch_filter_archive`): `filter` stage (keep `allowedTypes`, else
> `archive`/reject/review), `PipelineRunStatus.archived`, `PipelineRun.documentTypeKey`/
> `archivedReason`; executor `terminal` outcome + `archiveRun`/`bulkArchive`; batch **funnel**
> + **type histogram** API; pipeline-editor filter stage + **BatchDetailPage** funnel/histogram/
> per-type-skip/status-chips/per-run-skip. All-user access re-confirmed (JWT-only). tsc/build/
> lint + live-DB smoke green. **NOT browser-verified; filter/extract not run on a live classified
> doc.** **Next:** run the funnel on a real batch (needs API key + files); per-type → different
> extraction schema in one run (currently filter keeps/drops only); per-org clone-on-write.

> **Latest (2026-06-10) — docs/07 P4.2 (config-as-data + admin authoring portal):** new
> DB models `ExtractionSchemaDef`/`SchemaField`/`FieldMapDef`/`FieldMapEntry` (migration
> `pipeline_config_as_data`, org-scoped + versioned); `SchemaResolverService` (DB-over-code
> precedence: org → system-template → code registry → generic) wired into the executor +
> `PipelineService.classifyDoc`, **decoupling classifier candidacy from `documentTypeKey`** +
> per-pipeline `candidateKeys` allowlist; seed seeds `ownerOrgId=null` templates from the code
> registry; admin CRUD API `apps/api/src/app/intelligence-admin/` (`@Roles('admin')`, edit
> **mints a new immutable version**); admin UI `apps/app/src/app/features/admin/intelligence/`
> (SchemaManager + PipelineManager, route `/admin/intelligence`). tsc/build/lint green + live-DB
> runtime smoke (version precedence + candidate decoupling). **NOT browser-verified; admin HTTP/auth
> path not exercised.** **Next:** per-org clone-on-write (controller uses platform `ownerOrgId=null`
> today); wire `fieldThreshold` into `decideReview`; runtime per-run type override at review; then the
> remaining docs/07 (per-stage BullMQ queueing/reconciler, StageTransition branching, export targets).

> **docs/05 §7 phase status:** P0 ✅ (engine spike; **OCR-accuracy # un-run** — needs
> real Hindi scans + API key), P1 ✅ (extraction + review UI + **agentic critic pass**;
> **eval harness un-run on a gold set** — no fixtures), P2 ✅ (analysis, cited-law
> health via @org/legal-reference, **RAG ask-this-document** with page citations),
> P3 ✅ (convert bridge). The only outstanding docs/05 items are the two **data/runtime
> exit metrics** (OCR accuracy, gold-set precision/recall/STP) — the harness + engines
> are built and *runnable*; producing the numbers needs real documents + an API key.
>
> **Latest (tasks #18–21):** critic re-verification (lib `critic.ts` + `VlmExtractionEngine.critique`,
> on by default); Phase 2 backend (`AnalysisService` analyze+ask, models `AnalysisRun`+`SourceChunk`,
> migration `di_phase2_analysis_rag`); Phase 2 frontend (`DocumentInsights` on AnalyzePage).
> All tsc/build/lint green; **NOT browser-verified.**
>
> **Pipeline engine (docs/07): P4.1 + P4.3 + P4.4 DONE (additive).** Batches
> (multi-file ingest → N runs, `Batch` model, `BatchService`), review queue +
> `approveRun` (resume parked run → export via convert bridge), and full UI
> (BatchesPage / BatchDetailPage / ReviewQueuePage + nav). Product flow end-to-end:
> upload one or a batch → classify → extract → validate(auto-advance/park) → review
> queue → approve → editable Document. tsc/build green; NOT runtime-verified.
> **Next docs/07:** P4.2 (org-scoped DB pipelines/schemas + authoring UI), zip/S3/API
> batch sources, per-stage BullMQ queueing + StageExecution reconciler, bulk-approve.
>
> **P4.1 detail:** engine core (additive) — models
> Pipeline/PipelineStage/PipelineRun/StageExecution (migration `pipeline_engine_core`),
> `PipelineExecutorService` (data-driven stage dispatch reusing PipelineService engines +
> convert bridge), seeded default pipeline, endpoints `POST /intelligence/sources/:id/run-pipeline`
> + `GET /intelligence/pipeline-runs/:id`. Legacy IntelligenceJob flow untouched. tsc/build green;
> NOT runtime-verified. **Next docs/07:** P4.2 org-scoped DB pipelines/schemas + authoring UI;
> P4.3 batch/multi-file fan-out; P4.4 review queue + bulk approve + resume-after-approve;
> P4.5 CSV/JSON/webhook export; plus per-stage queueing + StageExecution reconciler.
>
> **Other next options:** (a) **browser smoke-test** the whole flow (now possible — OPENAI_API_KEY
> is set; pipeline is text-first so text-layer PDFs work); (b) seed a gold fixture set + run the
> eval harness for real precision/recall/STP; (c) OCR/engine benchmark.

> **Latest (tasks #15–#16, COMPLETE):** the convert bridge closes the loop.
> `POST /intelligence/extractions/:id/convert` → structured prefill (field-map →
> public `DocumentsService.create` → `/documents/:id/edit`) or freeform fallback
> (`/documents/:id/draft`). Frontend "Create editable document" button in the
> review UI (saves corrections then converts). "Analyze" nav link added in
> MainLayout. All typecheck/build/lint green; **NOT browser-verified.**
>
> **Pipeline now end-to-end (code-complete):** upload → classify → tiered extract
> (native parsers / vision / premium agentic) → review/correct → convert → editable
> Document. What remains is verification + quality + Phase 2.
>
> **Next options:** (a) **browser smoke-test** the full flow (recommended first —
> needs app+API+OPENAI_API_KEY; check the structured builder renders mapped data,
> i.e. field-map path accuracy); (b) **build the configurable pipeline engine** —
> designed in `docs/07-pipeline-engine.md` (per-org pipelines, batch via multi-file
> first, per-stage auto-advance thresholds, review queue, export stages); start at
> its **P4.1 engine core**; (c) agentic critic re-verification pass; (d) Phase 2 =
> citations + RAG (embed() ready); (e) bbox provenance for click-to-highlight.
>
> **`docs/07-pipeline-engine.md` (design, no code yet):** the process-as-data
> workflow engine — turns the fixed single-doc flow into org-configurable pipelines
> over batches. Decisions locked: per-organisation tenancy; multi-file upload built
> first (zip/S3/API deferred). Reuses every existing engine as a stage impl; nothing
> there is a rewrite. Build order P4.1→P4.6 in §9.

> **Latest (tasks #11–#14, COMPLETE — see BUILD_LOG):** shipped the Phase 1 frontend.
> `intelligence.service.ts` in api-client (wired into main.tsx + services-context);
> `apps/app/src/app/features/intelligence/` with `IntelligenceUpload` (file + engine-tier
> select), `AnalyzePage` (polls job → stage), `ReviewExtraction` (HITL: confidence
> badges, flagged fields, editable values, save w/ audit trail); routes `/analyze` +
> `/analyze/:sourceId`; full `intelligence` i18n namespace in en. Authored the RTI +
> legal-notice ExtractionSchemas + field-maps (now all 3 live packs + generic). All
> typecheck/build/lint green; **NOT browser-verified** (needs app+API running + OPENAI_API_KEY).
>
> **Next options:** (a) add an "Analyze" nav link + dashboard entry point; (b) click-to-highlight
> bbox provenance (needs engine to emit bbox, currently page-level); (c) no-code ExtractionSchema
> authoring UI; (d) agentic critic re-verification pass (extraction quality); (e) Phase 2
> (citations via @org/legal-reference + RAG — embed() is ready on OpenAI); (f) Phase 3 convert
> bridge (the field-maps already feed it). Recommend a browser smoke-test of the flow first.

> Tasks #6–#10 are COMPLETE (see the dated BUILD_LOG entries). Tiered extraction
> shipped: free native DOCX/PDF/text parsing (mammoth + unpdf + pdf-parse with
> fallback) → OpenAI structured extract; premium **configurable agentic** engine
> (env-driven, vendor-agnostic) gated by `Feature.premium_extraction`; OpenAI is
> the default provider (`AI_DEFAULT_PROVIDER`). All typecheck/build/lint green;
> NOT runtime-verified end-to-end (needs a sample file + `OPENAI_API_KEY`; agentic
> needs `EXTRACTION_AGENTIC_*`). **Next real work = Phase 1 frontend** (review UI,
> no-code schema authoring) + RTI/legal-notice ExtractionSchemas + the agentic
> critic re-verification pass. Phase 2 = citations + RAG (embed() is implemented
> on OpenAI). Phase 3 = convert bridge.

This is the hand-off for `docs/05-document-intelligence-roadmap.md`. Read this +
the latest `docs/BUILD_LOG.md` entry, then continue from the task list below.

---

## ✅ Phase 0 — DONE (on disk, uncommitted on branch `templates`, verified)

Verified: API `tsc` 0 · `nx build @org/api` OK · eslint 0 on new files ·
`nx lint @org/doc-intelligence` 0 · Prisma migration **applied** to local dev DB
(`20260609064721_add_document_intelligence`) + client regenerated.

- **`AiProvider` extended additively** (`apps/api/src/app/ai/providers/ai-provider.interface.ts`):
  optional `supportsVision()`/`supportsEmbedding()`/`extract<T>()`/`embed()` + multimodal/structured
  types. Implemented vision + forced tool-use extraction in `claude.provider.ts`.
  `AiService` gained `extract`/`extractWith`/`embed`/`getVisionProviders` + `AI_MODEL_WHITELIST`.
- **Prisma models** `SourceDocument` / `IntelligenceJob` / `Extraction` (+ enums), all jsonb.
- **New pure lib `@org/doc-intelligence`** (`libs/doc-intelligence/`): `ExtractionSchema`
  (mirror of `DocumentTypeBundle`), engine contracts + `EngineRegistry`, json-schema +
  prompt builders, confidence + `decideReview` (STP), eval harness, convert field-map (§11.4),
  packs `rent_agreement` + `generic_document`.
- **New NestJS `intelligence` module** (`apps/api/src/app/intelligence/`): BullMQ + inline
  fallback, `PipelineService` (classify→extract→persist), `ReconcilerService` (dep-free
  interval sweep), controller (`/intelligence/upload|presign|sources|jobs/:id|sources/:id/extraction|extractions/:id/review`).
  Wired into `app.module.ts`.

---

## 🔒 Locked decisions (don't re-litigate)

1. **Premium gate = new `Feature.premium_extraction` quota** (free=0, paid=N/unlimited).
   NOT a paid-plan-price check, NOT always-on. ⚠️ The seeded **free** plan currently sets
   every feature to `-1` (unlimited) — must explicitly set `premium_extraction = 0` for free.
2. **Agentic provider = vendor-agnostic configurable HTTP adapter** (env-driven: base URL,
   API key, model, response-mapping). NOT a specific vendor. Flow: agentic parse →
   high-fidelity text → schema extract (delegate to the VLM engine).
3. **OpenAI is the DEFAULT AI provider now** (`AI_DEFAULT_PROVIDER` default `openai`; reorder
   `AiService` priority; implement `extract()` + `supportsVision()` on `OpenAiProvider` via
   LangChain, leave `generate`/`stream` intact). OpenAI chat vision = **images only, not PDFs**
   → PDFs go through the parse-to-text path.
4. **Text extraction via MULTIPLE document-parsing libraries** with fallback (mammoth for DOCX;
   robust PDF-text libs e.g. `unpdf`/`pdf-parse`; maybe `officeparser`). `EngineRegistry<IParser>`
   with capability-negotiated fallback. Pipeline parses to text FIRST → OpenAI structured
   extract; vision/agentic only when there's no text layer (scanned).

---

## 📋 Next-phase tasks (mirror of Claude task list #6–#10)

- [ ] **#6 — OpenAI default + extract()/vision.** `AI_DEFAULT_PROVIDER` (default `openai`),
      reorder `AiService` priority (OpenAI first, Claude/Gemini fallback). Implement
      `extract<T>()` (LangChain `withStructuredOutput` / function-calling) + `supportsVision()`
      (base64 `image_url`) on `OpenAiProvider`. Do **not** touch `generate`/`stream`.
- [ ] **#7 — Multiple parsing libraries.** Add deps (mammoth + PDF libs). `IParser` impls in
      `apps/api/src/app/intelligence/parsers/` in an `EngineRegistry<IParser>` with FALLBACK
      (lib A empty/short → lib B). Integrate into `PipelineService`: parse-to-text FIRST →
      OpenAI extract; no/low text → vision (Claude) or agentic. **Check `apps/api/webpack.config.js`
      externals before assuming the libs bundle.**
- [ ] **#8 — Vendor-agnostic agentic engine (premium).**
      `intelligence/engines/agentic-extraction.engine.ts` implements `IExtractionEngine`,
      env-driven (`EXTRACTION_AGENTIC_BASE_URL`/`_API_KEY`/`_MODEL`/`_RESPONSE_PATH`/`_PROVIDER`).
      `isConfigured()` gates capability; register AHEAD of the VLM engine. No live HTTP call
      verifiable without a key — implement + typecheck/build only.
- [ ] **#9 — Premium gating + engine-mode selection + seed.** Add `premium_extraction` to
      `Feature` enum + `ExtractionEngineMode {auto,native,vlm,agentic}` + `engineMode` column
      on `IntelligenceJob` (one combined migration). Add `premium_extraction` `PlanFeature` to
      seeded plans (`tools/prisma/seed.ts`): free=0, starter≈20, pro-monthly=-1, pro-yearly=-1,
      agency=-1. Selection in `PipelineService`: tier = resolve(requested mode,
      entitled=`checkQuota(premium_extraction)`, agenticConfigured). `agentic` requested w/o
      entitlement → 403 at upload; `auto` → agentic if entitled+configured else VLM.
      `trackUsage(premium_extraction)` when agentic used. Add `engine?` to upload/register DTOs.
      **Re-seed required.**
- [ ] **#10 — Config + migration + re-seed + verify + BUILD_LOG.** Add to `config/schema.ts`
      (Zod): `AI_DEFAULT_PROVIDER` + `EXTRACTION_AGENTIC_*` group + `OPTIONAL_GROUPS` entry.
      `prisma migrate dev` + generate + `db seed`. Verify (API tsc, `nx build @org/api`, eslint,
      lib lint). Update `.env.example`. Append dated entry to `docs/BUILD_LOG.md`.

---

## Resume gotchas

- Deps not yet installed (mammoth + PDF libs) — `pnpm add` them, then re-check the API build.
- Verify commands: `pnpm exec tsc --noEmit -p apps/api/tsconfig.app.json`, `pnpm nx build @org/api`,
  `pnpm exec eslint <changed paths>`, `pnpm nx lint @org/doc-intelligence`.
- Prisma is on a local dev DB at `localhost:5432` schema `starter` (reachable last session).
- When the Phase-1 **frontend review UI** is built, wrap new strings in `t('key','English default')`.
