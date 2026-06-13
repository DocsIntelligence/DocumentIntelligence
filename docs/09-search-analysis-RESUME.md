# 09 — Powerful Search + Analyse/Ask on Any Document — RESUME

**Status:** ✅ CODE-COMPLETE (all of #1–#10), verified by app typecheck + api build + lint (0 errors) and
DB-level SQL validation. **NOT browser-verified**; the semantic leg + analyse/ask need an embedding/LLM
provider running, and a one-time `POST /admin/search/reindex` (backfill) populates the index for existing
rows. See `docs/BUILD_LOG.md` (2026-06-13) for the full record.
**Last updated:** 2026-06-13.

## ✅ What shipped (all tasks)
- **#10 infra:** PG16 confirmed — `pg_trgm` installed, `vector` 0.5.0 available (HNSW). ⚠️ prod Postgres
  must also have the pgvector binary.
- **#1** `SearchIndex` (generated `tsv` + `vector(1536)` + GIN/trgm/HNSW) + `SearchConfig`; migration
  `add_search_index`. **#2** `SearchTextService` extractors (freeform/structured/source). **#3**
  `SearchIndexService` (upsert + content-hash + BullMQ/inline) + write-path hooks + `backfillAll`. **#4**
  `GET /search` hybrid (ts_rank + ts_headline + trgm, scoped, paginated). **#5** pgvector semantic blend
  via `ai.embed`. **#6** polymorphic `AnalysisRun`/`SourceChunk` + cache → analyse/ask on any Document
  (`/intelligence/documents/:id/{analyze,analysis,ask}`). **#7** global search page + builder "AI insights".
  **#8** `SearchConfig` org/system settings + admin UI + reindex. **#9** server-side pagination for
  batch-detail runs + review queue.

### Migrations are drift-safe now (no manual editing)
Prisma can't represent the `tsv` FTS column or the GIN/HNSW indexes, so it used to emit spurious
`DROP INDEX` / `DROP DEFAULT` on `SearchIndex` every `migrate dev` (the `DROP DEFAULT` even crashed
generation on the old generated column). Fixed two ways: (1) migration `search_tsv_trigger` converts `tsv`
from a generated column to a **trigger-maintained** one (`searchindex_tsv_trigger`) — invisible to Prisma,
so no invalid drift; (2) `pnpm prisma:migrate:dev` → `tools/scripts/prisma-migrate-dev.mjs` auto-strips the
remaining (valid) `DROP INDEX` drift and discards pure-drift migrations. **Just run
`pnpm prisma:migrate:dev` as normal.** (`prisma:migrate:dev:raw` is the unguarded escape hatch.)

---

_Original plan below (for reference)._

**How to resume:** read this file top-to-bottom, then `TaskList` → start at the lowest-ID
unblocked task (Task #1, after the infra check Task #10). Each phase below maps to a task ID.

This doc is self-contained: the goal, the decisions already made, what already exists to reuse,
the gaps, the architecture, and the build order. You can pick this up cold.

---

## 0. Context — what was already shipped this session (verified, NOT browser-tested)

All verified with `@org/app` typecheck ✓, `@org/api` build ✓, lint 0 errors (pre-existing warnings only).
See `docs/BUILD_LOG.md` (2026-06-13 entries) for detail.

- **Server-side pagination/sort/search** for **Documents** and **Batches** (the unbounded, per-user
  tables). `DataTable` (`libs/shared/ui/src/components/data-table.tsx`) gained an opt-in `server` mode +
  a **page-size dropdown** (`pageSizeOptions`, default 50). Config tables (lookups/schemas/pipelines)
  stay client-side by design.
- **Batch status persisted** (`apps/api/.../intelligence/batch-status.ts` + `recomputeBatchStatus` in the
  executor) so batches can be filtered/sorted server-side; KPI tiles use a `groupBy` across all runs.
  ⚠️ Pre-existing batches keep `status='running'` until a run transitions — optional backfill.
- **Doc-Intelligence config layout**: in-page tab strip removed; 3 standalone sidebar pages.
- **View original file**: `GET /intelligence/sources/:id/original-url` (presigned) +
  `<ViewOriginalButton>` in the review screen and the document builder (freeform converts stash
  `data.sourceDocumentId`).
- **Batch review stepper** (`ReviewQueuePage.tsx`): batch scope walks ALL the batch's openable docs
  (needs_review + completed + approved) with Prev/Next + Approve-&-next; `?doc=<sourceId>` deep-link from
  the batch detail "Open".

Outstanding from earlier: a **DB re-seed** is needed for the document types/lookups added earlier in the
session (receipt, quotation, purchase_order, credit_note, payslip, will, + `payment_mode`/`credit_note_type`).

---

## 1. The feature to build

**Goal (user's words, paraphrased):** server-side sort/search/pagination everywhere it matters, and a
**powerful full-text search across ALL documents** — analysed/uploaded docs *and* freeform + template
drafts — reusing **persisted analysis** so it's reused not recomputed; plus **analyse/ask on ANY
document, on demand**, persisted and reused; if analysis exists, use it to search and show.

### Decisions already made (do not re-litigate)
- **Hybrid search from v1**: keyword (Postgres `tsvector` + `pg_trgm`) **AND** semantic (`pgvector`
  embeddings), blended ranking. Not keyword-only.
- **Server-side pagination only for growth-prone tables**: batch-detail **runs** + the **review queue**
  (capped at 100 today). Leave small admin config (lookups/schemas/pipelines) and per-document embedded
  lists (signers/comments/versions) client-side — small and bounded.
- Cost mitigations to bake in (user flagged hybrid cost): (a) only (re-)embed when the extracted text
  actually changes (content hash); (b) debounce embedding on autosave (don't embed every keystroke-save).

### OPEN QUESTIONS (resolve before/at the relevant phase)
1. **User's last message cut off at "…also"** — confirm there isn't another requirement before deep work.
2. **Infra (Task #10, blocks Phase 1):** confirm the target Postgres can load `vector` (pgvector) and
   `pg_trgm` extensions. Managed providers usually allow both; verify before writing the migration.

---

## 2. What already exists (REUSE — do not rebuild)

Verified by reading the code. Key file paths + facts:

### Database / infra
- **PostgreSQL** (`tools/prisma/schema.prisma` datasource). `Document.data` / `DocumentVersion.data` are
  `JSONB`. **No** `pg_trgm` / `pgvector` / `tsvector` enabled yet (no migration declares them).
- **BullMQ + Redis** queue exists for intelligence (`apps/api/src/app/intelligence/intelligence.module.ts`,
  `INTEL_QUEUE`), with an **inline fire-and-forget fallback** when `REDIS_URL` is unset. Reuse for async
  indexing + embedding + backfill.

### Uploaded-doc (SourceDocument) world — already rich
- `SourceDocument.normalizedText` (`Json?`): per-page parsed text (`NormalizedDocument { pages:[{page,text}] }`).
  Parsed lazily by `AnalysisService` and cached. Parsers in `apps/api/.../intelligence/parsers/`.
- `AnalysisRun` model (schema ~line 936): `summary, parties, keyDates, obligations, riskFlags,
  citationFindings` (all `Json?`). **Persisted but re-run + new row every call (no dedup)** — add caching.
  Service: `apps/api/src/app/intelligence/analysis.service.ts`. Routes: `POST/GET
  /intelligence/sources/:id/analyze|analysis`.
- **Ask / RAG**: `POST /intelligence/sources/:id/ask`. `SourceChunk` model (schema ~line 961):
  `{page, ordinal, text, embedding Float[]}`. Chunking + cosine = `@org/doc-intelligence` `rag.ts`
  (`chunkPages`, `topKChunks`), embeddings via `ai.embed()`. **In-process cosine, NO pgvector** today.
- Frontend: `DocumentInsights.tsx` (analysis card + ask card), surfaced on `AnalyzePage.tsx`. Hooks:
  `useAnalysis`, `useRunAnalysis`, `useAsk` in `apps/app/.../intelligence/queries.ts`.

### Drafting-doc (Document) world — searchable text MISSING
- `Document` model (schema ~line 448): `data Json`, `status`, `documentTypeId`, `templateId`, owner fields,
  timestamps. `DocumentVersion` is an immutable `data` snapshot.
- `data` shapes:
  - **freeform**: `{ html, values: Record<string,string>, fields: FieldDef[], fontFamily?, sourceDocumentId? }`
    (`libs/document-templates/src/freeform/index.tsx`). Body is HTML with `{{placeholders}}`.
  - **structured**: nested bundle values keyed by section.field (e.g. `parties.landlord.name`), schema in
    `libs/document-schema/src/<type>/schema.ts`; field labels in each `form-metadata.ts`.
- **There is NO server-side text extractor** (`data` → readable text). The template React component is the
  only thing that renders `data`, and it's client-side. THIS IS THE BIGGEST NET-NEW PIECE (Phase 2).
- Current search: `documents.service.list` only does `title { contains, mode:'insensitive' }` (added this
  session). No content search, no index.

---

## 3. Architecture

**Unified `SearchIndex` table** — one row per searchable entity, both worlds:
```
SearchIndex {
  id            String  @id @default(cuid())
  kind          String              // 'document' | 'source'
  refId         String              // Document.id or SourceDocument.id
  ownerUserId   String?
  ownerOrgId    String?
  title         String
  bodyText      String              // extracted searchable text
  // tsv: generated tsvector(title + bodyText)  — GIN index
  embedding     Unsupported("vector(N)")?      // pgvector — ivfflat/hnsw index
  contentHash   String              // to skip re-embedding unchanged text
  type          String?             // documentTypeKey / schemaKey
  status        String?
  updatedAt     DateTime
  @@unique([kind, refId])
}
```
- **Keyword**: `to_tsvector` (generated col or trigger) + GIN; `ts_rank` ordering; `ts_headline` snippets;
  `pg_trgm` for fuzzy title.
- **Semantic**: embed `bodyText` (or chunks) via existing `ai.embed`; `pgvector` cosine.
- **Hybrid rank**: normalise + weight `ts_rank` and cosine into one score (e.g. `0.5*kw + 0.5*sem`),
  tune later.
- Scope every query by `ownerUserId = me OR ownerOrgId IN (my orgs)`.

**Why a unified table** (not tsvector columns per table): one query + one ranking across drafts and
uploads; clean pagination; decouples the index from the source rows' write paths.

---

## 4. Phases → Task IDs (build order follows task `blockedBy`)

| Task | Phase | Depends on |
|---|---|---|
| **#10** | Infra check: confirm pgvector + pg_trgm available on target Postgres | — (blocks #1) |
| **#1** | `SearchIndex` model + enable pg_trgm + pgvector + migration + indexes | #10 |
| **#2** | Text extractors: freeform (strip HTML + fill values), structured (walk bundle data w/ form-metadata labels), source (normalizedText + AnalysisRun + Extraction) | #1 |
| **#3** | Index maintenance: upsert on Document create/patch + Source extraction/analysis; async via BullMQ + inline fallback; **backfill** existing rows | #1, #2 |
| **#4** | Search API `GET /search` (hybrid ts_rank+cosine, ts_headline snippets, paginated, filtered, scoped); upgrade `documents.list` q to use the index | #3 |
| **#9** | Semantic/embeddings (v1): embed both worlds reusing `ai.embed`/`chunkPages`; blend into #4 | #1 |
| **#5** | Global search UI (search page / command palette, grouped + highlighted, server-paginated) + documents full-text box | #4 |
| **#6** | Analyse/Ask on ANY document: make `AnalysisRun` + `SourceChunk` **polymorphic** (`subjectType: source\|document`, `subjectId`); derive text via #2; **cache** analysis (content-hash dedup) | #2 |
| **#7** | Surface Analyse/Ask in document builder/detail (reuse `DocumentInsights`); show analysis highlights in search results | #6 |
| **#8** | Server-side pagination for batch-detail RUNS + review queue (growth-prone only) | — (independent) |

Recommended first slice to ship value fast: **#10 → #1 → #2 → #3 → #4 (keyword first) → #5**, then layer
**#9 semantic** into #4, then **#6/#7 analyse-on-any-doc**. **#8** can be done independently anytime.

---

## 5. Risks / notes
- Embedding cost + reindex on backfill (hybrid). Mitigate with content-hash + debounced re-embed.
- Polymorphic `AnalysisRun`/`SourceChunk` is a migration touching existing FK (`sourceDocumentId` →
  nullable + add `subjectType`/`subjectId`, or a parallel column). Plan the data migration for existing rows.
- Structured-doc text extraction is heuristic (walk values + labels); the template component is the
  ground-truth renderer but is React/client-side — don't try to SSR it for text.
- Keep all of it behind the repo's verify gate: typecheck + eslint (+ build), and append `BUILD_LOG.md`
  after each unit.
