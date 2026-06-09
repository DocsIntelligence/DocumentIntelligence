# Configurable Pipeline Engine — design (per-org, process-as-data)

**Status:** design proposal · no code yet · **Updated:** 2026-06-09
**Builds on:** `docs/05-document-intelligence-roadmap.md` (this is its deferred
**Phase 4** — the *process-as-data workflow engine* from §1, the *customization
surface* from §5, and the *STP/eval* north-star from §6, now promoted because the
multi-document / batch / multi-reviewer ICP is real).

> **One-line goal.** Let an **organisation** define its own document pipelines —
> *classify → parse → extract → validate → review/approve → export* — as
> **configurable data**, run **batches** of documents through them, and have each
> stage **auto-advance** when a **configurable confidence score** is cleared or
> **park for a human** when it isn't. Different orgs get different pipelines,
> schemas, fields, and thresholds, with **no code changes**.

---

## 0. What exists today vs. what this adds (honest baseline)

The Document Intelligence MVP (docs/05, built 2026-06) already does the *hard
single-document parts*; this doc adds the *orchestration + configuration + scale*
around them. Nothing below is a rewrite — the existing pieces become **stage
implementations**.

| Capability | Today | This design |
| --- | --- | --- |
| Classify → tiered extract (native/vision/agentic) | ✅ `PipelineService` + engines | reused as the `classify`/`extract` stage impls |
| Confidence → review routing | ✅ `decideReview` + `RoutingPolicy` (**hardcoded `DEFAULT_ROUTING`**) | per-stage, per-org **configurable** thresholds (data) |
| Which fields to extract | ⚠️ `ExtractionSchema` **in code** (`registerExtractionSchema`) | org-scoped, DB-stored, **no-code authored**, versioned |
| Convert → editable Document | ✅ convert bridge (public create path) | the `export` stage's default target |
| Single document per upload | ✅ | **Batch** of N documents → N runs |
| Multi-stage pipeline you define | ❌ fixed linear method; `IntelligenceStage` enum is cosmetic | **data-driven stage graph**, executor dispatches by `stage.type` |
| Human approve/verify at scale | ⚠️ single-doc review UI | **review queue** + bulk approve |
| Per-org customization | ❌ everything global/in-code | everything keyed by `Organisation`, versioned |
| Async + crash-resilience | ✅ BullMQ + reconciler | reused per **stage execution** |

**Tenancy decision (locked):** all configuration is owned by an **Organisation**
(existing `Organisation`/`OrgMember` models); members share it. A user without an
org falls back to a single implicit "personal" scope. System defaults seed each
new org's editable copy (§7).

---

## 1. Conceptual model

```
Organisation
  ├─ ExtractionSchema(s)        (versioned; fields + per-field threshold/required/reviewMandatory)
  ├─ FieldMap(s)               (extraction key → DocumentTypeBundle path, for export→structured)
  └─ Pipeline(s)               (versioned; an ordered list of typed Stages)
        Stage[order=1] INGEST     config:{}
        Stage[order=2] CLASSIFY    config:{ candidateSchemas:[…], autoAdvance:{minConfidence:0.8, onFail:'review'} }
        Stage[order=3] EXTRACT     config:{ engineMode:'auto', schemaFrom:'classify' }
        Stage[order=4] VALIDATE    config:{ autoAdvance:{minOverall:0.9, minField:0.85, requireAllRequired:true, onFail:'review'} }
        Stage[order=5] REVIEW      config:{ gate:true }                       ← human approve/correct
        Stage[order=6] EXPORT      config:{ targets:['structured_document'] } ← convert bridge / CSV / JSON / webhook

Batch (N documents, one Pipeline, one org)
  └─► PipelineRun  (one per SourceDocument)
        currentStage, status
        └─ StageExecution[]   (one row per stage entered: input/output/score/timing/attempts/heartbeat)
```

- A **Pipeline** is an ordered set of **Stages** (linear for v1, with a
  doctype **branch** allowed at classify — full DAG deferred).
- A **Stage** has a `type` (what it does) and a `config` (jsonb) — including its
  **auto-advance condition**. This is *the* configurability: thresholds,
  engine choice, target schema, what to do on a low score.
- A **Batch** fans a set of documents into **PipelineRun**s. Each run walks the
  stages; a stage either **auto-advances** (its condition passes) or **parks**
  the run (human review). Every entry is a **StageExecution** row (audit + the
  reconciler's heartbeat target).

---

## 2. Stage types (the building blocks)

Each maps to existing code where possible. `config` shapes are illustrative.

| Stage `type` | Does | Backed by (existing) | Key `config` |
| --- | --- | --- | --- |
| `ingest` | load bytes, normalize | `loadBytes`, `ParsingService` | `{}` |
| `classify` | detect `DocumentType` key | `ClassifierEngine` | `{ candidateSchemaKeys?, autoAdvance }` |
| `extract` | fields + confidence + provenance | `ParsingService` + `Vlm/AgenticExtractionEngine` | `{ engineMode:'auto\|native\|vlm\|agentic', schemaKey? }` |
| `validate` | apply schema rules + threshold gate | `decideReview` w/ the **stage's** `RoutingPolicy` | `{ autoAdvance:{minOverall,minField,requireAllRequired,onFail} }` |
| `review` | human approve / correct | review queue (new) | `{ gate:true, assignTo? }` |
| `export` | emit the result | convert bridge / new exporters | `{ targets:['structured_document'\|'freeform_document'\|'csv'\|'json'\|'webhook'], webhookUrl? }` |
| `transform` *(later)* | map/enrich/redact | — | `{ ops:[…] }` |
| `webhook` *(later, standalone)* | notify external | — | `{ url, events }` |

**Auto-advance condition** (the "score to auto-move to the next step"), evaluated
after a stage produces output:

```jsonc
"autoAdvance": {
  "minOverallConfidence": 0.9,     // run's overall ≥ this
  "minFieldConfidence": 0.85,      // every present field ≥ this
  "requireAllRequired": true,      // no required field missing
  "onFail": "review"               // "review" | "reject" | "route:<stageId>"
}
```

If the condition passes → the engine advances to the next stage automatically
(straight-through). If it fails → `onFail` decides: park in the **review queue**,
**reject** the run, or **route** to another stage. Per-field overrides live on the
schema (`reviewMandatory`, per-field threshold) and always win.

---

## 3. Data model (Prisma sketch — Postgres-native, jsonb/join tables, NOT JSON-as-string)

Illustrative, not final. All config tables carry `ownerOrgId` + `version`.

```prisma
model Pipeline {
  id          String   @id @default(cuid())
  ownerOrgId  String?              // null = system default (template)
  key         String               // stable per org, e.g. "invoices-inbound"
  name        String
  version     Int      @default(1) // immutable versions; new edit = new version
  active      Boolean  @default(true)
  stages      PipelineStage[]
  runs        PipelineRun[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([ownerOrgId, key, version])
}

model PipelineStage {
  id         String   @id @default(cuid())
  pipelineId String
  order      Int
  type       PipelineStageType
  name       String
  config     Json                  // autoAdvance, engineMode, schemaKey, targets…
  pipeline   Pipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  @@unique([pipelineId, order])
}

enum PipelineStageType { ingest classify extract validate review export transform webhook }

model Batch {
  id          String   @id @default(cuid())
  ownerOrgId  String?
  ownerUserId String?
  pipelineId  String
  source      BatchSource @default(multi_file)  // multi_file now; zip/s3/api later
  status      BatchStatus @default(ingesting)
  total       Int      @default(0)
  completed   Int      @default(0)
  needsReview Int      @default(0)
  failed      Int      @default(0)
  runs        PipelineRun[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum BatchSource { multi_file zip s3_prefix api }
enum BatchStatus { ingesting running needs_review completed failed }

model PipelineRun {
  id               String   @id @default(cuid())
  pipelineId       String
  batchId          String?
  sourceDocumentId String              // reuse the existing SourceDocument
  currentStageId   String?
  status           RunStatus @default(queued)
  executions       StageExecution[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([batchId, status])
}

enum RunStatus { queued running needs_review approved completed failed rejected }

model StageExecution {
  id           String   @id @default(cuid())
  pipelineRunId String
  stageId      String
  status       String              // queued|running|passed|parked|failed
  score        Float?              // the stage's computed score (for auto-advance audit)
  output       Json?               // extraction/classification result for this stage
  error        String?
  attempts     Int      @default(0)
  heartbeatAt  DateTime?           // reconciler watches this (reuse the §Phase0 pattern)
  startedAt    DateTime?
  finishedAt   DateTime?
  @@index([status, heartbeatAt])
}

model ReviewTask {
  id            String   @id @default(cuid())
  pipelineRunId String   @unique
  ownerOrgId    String?
  status        String   @default("pending")   // pending|approved|rejected
  assignedToId  String?                          // assignment/round-robin = later
  decidedById   String?
  decidedAt     DateTime?
  createdAt     DateTime @default(now())
  @@index([ownerOrgId, status])
}

// ExtractionSchema + fields move from in-code registry → org-scoped DB rows.
model ExtractionSchema {
  id              String   @id @default(cuid())
  ownerOrgId      String?
  key             String
  name            String
  version         Int      @default(1)
  documentTypeKey String?              // shared vocab w/ the generator (docs/05 §11.2)
  fields          SchemaField[]
  @@unique([ownerOrgId, key, version])
}

model SchemaField {
  id               String  @id @default(cuid())
  schemaId         String
  key              String
  label            String
  type             String              // string|number|currency|date|boolean|enum|table
  required         Boolean @default(false)
  reviewMandatory  Boolean @default(false)
  fieldThreshold   Float?              // per-field auto-advance override
  config           Json?               // enumValues, columns, format, example…
  order            Int     @default(0)
}
```

`Extraction` (existing) stays the per-run extraction result; `IntelligenceJob`
(existing single-doc) is **subsumed**: the current single-upload path becomes "a
1-document `Batch` on the org's default pipeline." (Migration note in §8.)

---

## 4. The stage executor (how today's code becomes data-driven)

`PipelineService.run()` stops being a hardcoded linear method and becomes a
**dispatcher**:

```
runStage(execution):
  stage = getStage(execution.stageId)
  result = switch (stage.type) {
    ingest   → loadBytes + ParsingService.parse
    classify → ClassifierEngine.classify(candidateSchemaKeys)
    extract  → resolve schema (org DB) → tiered engine (stage.config.engineMode)
    validate → decideReview(schema, result, stage.config.autoAdvance)   // ← per-stage policy, not DEFAULT_ROUTING
    review   → create ReviewTask, PARK (no auto-advance)
    export   → for each target: convert bridge | CSV row | JSON | webhook POST
  }
  score = scoreFor(stage, result)
  if (stage.gate) park()
  else if (autoAdvanceCondition(stage, score, result)) advanceToNextStage()
  else applyOnFail(stage.config.autoAdvance.onFail)
```

- Each `advanceToNextStage` enqueues the next `StageExecution` on BullMQ (or runs
  inline without Redis — same dual-path as today).
- The **reconciler** already written watches `StageExecution.heartbeatAt` instead
  of `IntelligenceJob.heartbeatAt` — stuck stages fail/retry identically.
- `decideReview` is called with the **stage's** `RoutingPolicy` (from
  `stage.config.autoAdvance`) — the single change that makes thresholds
  configurable instead of `DEFAULT_ROUTING`.

**Nothing about the engines changes.** `ClassifierEngine`, `ParsingService`,
`VlmExtractionEngine`, `AgenticExtractionEngine`, the convert bridge, the
`EngineRegistry` — all are called by the executor exactly as they are today.

---

## 5. Batch ingestion (multi-file now; others designed, deferred)

All sources converge on **one seam**: *produce N `SourceDocument`s → create a
`Batch` → create N `PipelineRun`s → enqueue each run's first `StageExecution`.*
Only the front of that seam differs per source, so adding a source later is
localized.

| Source | Status | How |
| --- | --- | --- |
| **Multi-file upload** | **BUILD FIRST** (user decision 2026-06-09) | one multipart request with many files → N SourceDocuments. Browser multi-select. |
| Zip upload | deferred | upload `.zip` → unpack server-side → N. |
| S3 / bucket prefix | deferred | list objects under a prefix → ingest. For large/automated volumes. |
| API push | deferred | `POST` array of `{url\|base64, filename}` → ingest. For integrations. |

**Concurrency for ~1000 docs:** BullMQ already caps concurrency, retries, and the
reconciler sweeps stalls — the same machinery the MVP uses, now per
StageExecution. A `Batch` aggregates `total/completed/needsReview/failed` counters
for a progress view.

**Cost guardrail (important for batches):** a 1000-doc batch on the **agentic
premium** tier is 1000 paid units. The `premium_extraction` quota (docs/05) is
checked per run; a batch should additionally surface an **estimated spend +
confirm** before launch, and stop when the quota is exhausted (partial batch with
a clear report — no silent truncation).

---

## 6. Review / approve at scale

- Runs parked at a `review` stage create a **ReviewTask** and surface in a
  **review queue** (filter by batch, doctype, confidence band, flagged fields).
- The existing single-doc `ReviewExtraction` UI is the **per-run** editor,
  reached from the queue.
- **Bulk approve**: select all runs above a confidence band → approve → each
  advances past `review` to `export`. Correcting an individual run uses the same
  save-review + audit-trail path already built.
- **Assignment / round-robin / least-loaded** (POC's queue strategies) = **later**
  — only once an org has many reviewers. `ReviewTask.assignedToId` is the hook.

---

## 7. Multi-tenant config + seeding

- **System defaults**: the in-code `ExtractionSchema`/`FieldMap` registry (rent /
  rti / legal-notice / generic) and a **default pipeline** (classify→extract→
  validate→review→export) ship as `ownerOrgId = null` templates.
- **New org** → clone the system defaults into editable, org-scoped rows. An admin
  then edits fields, thresholds, and stages — **no-code** (docs/05 §5.1).
- **Versioning**: editing a pipeline/schema mints a **new version**; in-flight
  runs keep their pinned version (reproducibility + the §6 regression-gate story).
- Authoring UIs (admin): a **schema editor** (fields/types/required/threshold) and
  a **pipeline editor** (reorder stages, set each stage's config + auto-advance).

---

## 8. How this lands without breaking the MVP

- `IntelligenceJob` → **subsumed** by `PipelineRun` + `StageExecution`. Migration:
  keep `IntelligenceJob` during transition; the single-upload endpoint creates a
  1-doc batch on the default pipeline; remove `IntelligenceJob` once parity is
  proven. (Or: rename/extend it into `PipelineRun`.)
- `Extraction` (existing) is unchanged — still the extraction result per run.
- The **convert bridge** becomes the `export` stage's `structured_document`/
  `freeform_document` target — same public-create-path code, no editor edits
  (separation contract docs/05 §10 holds).
- `decideReview`/`RoutingPolicy` unchanged in shape; just fed per-stage config.
- The **eval/STP harness** (docs/05 §6) measures each pipeline version's
  straight-through rate — the metric that tells an org whether to loosen/tighten a
  stage's threshold.

---

## 9. Phasing (build order)

- **P4.1 — Engine core.** Pipeline/PipelineStage/PipelineRun/StageExecution models
  + migration; the data-driven executor reusing every existing engine; one seeded
  default pipeline; per-stage auto-advance thresholds. *Exit:* a single document
  runs through the default pipeline via the executor (parity with today), with
  thresholds read from stage config.
- **P4.2 — Org-scoped config + authoring.** ExtractionSchema/SchemaField/FieldMap
  in DB per org; clone-from-defaults on org create; schema-editor + pipeline-editor
  admin UIs. *Exit:* an admin changes a field/threshold with no code; new runs pick
  it up.
- **P4.3 — Batches (multi-file first).** Batch model + multi-file ingest → N runs;
  batch progress view; cost estimate + quota guard. *Exit:* 50+ files run as one
  batch; counters + progress correct.
- **P4.4 — Review queue + bulk approve.** ReviewTask + queue UI + bulk approve.
  *Exit:* a batch's flagged runs are reviewed/approved in bulk; approved runs
  export.
- **P4.5 — Export targets.** CSV/JSON batch export + webhook, alongside the
  convert bridge. *Exit:* a finished batch exports to a downloadable CSV/JSON and/
  or posts to a webhook.
- **P4.6+ — Later.** Zip/S3/API ingest; reviewer assignment/round-robin; DAG
  branching; transform/redact stages.

---

## 10. Open decisions (resolve before P4.1 build)

1. **`IntelligenceJob`: extend-in-place vs. new `PipelineRun`?** (Recommend new
   `PipelineRun` + subsume; cleaner audit per stage.)
2. **Linear + classify-branch vs. full DAG now?** (Recommend linear-with-branch;
   DAG is a big jump for little early value.)
3. **Pipeline versioning granularity** — version the whole pipeline vs. per-stage.
   (Recommend whole-pipeline immutable versions; simplest reproducibility.)
4. **Batch cost control** — hard quota stop vs. pre-launch estimate+confirm vs.
   both. (Recommend both.)
5. **Reprocessing** — can a run/stage be re-run after a config change without
   re-uploading? (Recommend yes, from the stored `SourceDocument`.)

---

## 11. Separation contract (unchanged)

This stays inside the `intelligence` domain + `@org/doc-intelligence`. New Postgres
models are additive. The only write into the drafting side remains the **export
stage's convert target**, which uses the **public document-create API** — never an
edit to `Document`/`DocumentVersion`/editor (docs/05 §10, §11.5). `AiService` is
still only extended additively.
