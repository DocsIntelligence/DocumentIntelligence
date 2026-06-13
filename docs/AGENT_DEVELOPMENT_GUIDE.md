# Agent Development Guide

Practical, reusable handoff for any AI agent (or human) doing development in this repo. This is the
**companion** to the canonical docs — read those first, then keep this open for the verify gate, the
recipes, and the landmines that aren't obvious from the code.

> India-first legal-document drafting + document-intelligence platform. Nx monorepo: NestJS `api`,
> React `app`, Next.js `web`, `artboard` renderer; schema-driven document types.

## Read these first (sources of truth)
- **`CLAUDE.md`** — project instructions (override defaults). The non-negotiables live here.
- **`CONTRIBUTING.md`** — repo map, setup, golden rules.
- **`docs/CODING_STANDARDS.md`** — TS/React/NestJS conventions, module boundaries, i18n, forms, recipes.
- **`docs/ARCHITECTURE_PRINCIPLES.md`** — pluggable/interface-first services (every external seam:
  interface → registry → factory → config-driven selection).
- **`docs/BUILD_LOG.md`** — dated journal of what changed and why. **Append after every unit of work.**
- **Resume docs**: `docs/05a-doc-intelligence-RESUME.md`, `docs/09-search-analysis-RESUME.md`
  (the in-flight search/analyse plan + its task list). `docs/04-progress-tracker.md`.

---

## The verify gate (run before claiming done; report honestly what ran)

Always go through **nx**, prefixed with the package manager (`pnpm nx …`). Never the underlying CLI.

```bash
# Typecheck the app (this transitively typechecks @org/document-schema and
# @org/document-templates via the template registry — those two libs do NOT have
# their own `typecheck` target).
pnpm nx typecheck @org/app

# Build the API (validates server-side Zod / schema imports end-to-end).
pnpm nx build @org/api

# Lint the projects you touched (0 errors required; pre-existing warnings are OK).
pnpm nx run-many -t lint -p @org/api @org/app @org/ui @org/api-client @org/document-schema @org/document-templates @org/legal-reference
```

- Standard minimum for most changes: **app typecheck + api build + lint**. Add a full build when you
  touched build output paths.
- The repo rule (CLAUDE.md): verify with typecheck + eslint (+ build) and **report what you did / didn't
  run**. Don't claim browser-verified unless you actually ran the app.

## Run / dev / DB

```bash
pnpm dev                 # serve api, app, web, artboard together
pnpm dev:api             # api only   (hot-reloads on save AFTER one restart to load config)
pnpm dev:app             # app only

pnpm prisma:generate     # regenerate client after schema.prisma changes
pnpm prisma:migrate:dev  # create + apply a dev migration  (needs DB)
pnpm prisma:migrate      # deploy migrations (prod)
pnpm prisma:studio
pnpm prisma:seed         # tsx tools/prisma/seed.ts   (document types, templates, lookups)
pnpm seed:lookups        # tsx tools/scripts/seed-lookups.ts
```
- Prisma schema: **`tools/prisma/schema.prisma`**. Seed data: **`tools/prisma/seed-data/`**.
- ⚠️ **After adding/altering document types or lookups you MUST re-seed** (`pnpm prisma:seed`) — the
  catalog and dropdowns read the DB. Code/presets are picked up by API hot-reload; seeded rows are not.

---

## Repo map (where things live)
- `apps/api` — NestJS. Modules: `documents`, `intelligence` (upload→classify→extract→review→export +
  batches + RAG/analysis), `intelligence-admin` (schemas/pipelines config), `search` (global module —
  unified hybrid full-text + semantic search across drafts + uploads; `SearchIndexService`/`SearchService`/
  `SearchConfigService`/`SearchTextService`), `lookup`, `legal-ai`, `auth`, `storage`, `payment`, `mail`,
  `shares`, `signers`, `comments`, `admin`.
- `apps/app` — React drafting + intelligence UI. Features under `apps/app/src/app/features/*`.
- `libs/document-schema` — per-doc-type **bundles** (Zod schema + form metadata + risks + prompts +
  template keys). Registry: `src/index.ts` (side-effecting imports) + `src/_registry.ts`.
- `libs/document-templates` — React **templates** (page-faithful renderers). Registry:
  `src/_registry.tsx` (`componentKey` → component). Shared internals in `src/_internals/`.
- `libs/shared/ui` — `@org/ui` design system (`DataTable`, `Select`, `Input`, …).
- `libs/shared/api-client` — typed HTTP service layer the app calls.
- `libs/shared/dto` — `@org/dto` shared Zod schemas (client RHF + server `createZodDto`).
- `libs/shared/legal-reference` — `@org/legal-reference`: citations, `schedule1.ts` (eSign exclusions),
  `document-presets.ts` (freeform AI presets).

---

## Non-negotiables (from CLAUDE.md — these cause real bugs if ignored)
1. **One `DocumentTypeBundle` per doc type is the source of truth.** Don't fork structure elsewhere.
2. **The AI never authors statute citations.** Use `@org/legal-reference` + the `{{applicable_law}}`
   placeholder. Deterministic risk rules are NOT LLM output.
3. **Every form** uses react-hook-form + a shared `@org/dto` Zod schema (the *same* one the server
   validates via `createZodDto`), with field-level inline errors and `applyServerFieldErrors` for 400s.
   **Never hand-rolled `useState` validation.** (CODING_STANDARDS §4.)
4. **Always `@org/ui` components** (Select/Input/…), **never native `<select>`**.
5. **i18n**: wrap new `apps/app` UI strings in `t('key', 'English default')` as you write them; watch for
   `t` shadowing.
6. **Server must not import React templates.** Validation (api) imports `@org/document-schema` only; the
   React renderers live in `@org/document-templates`. Keep that boundary (the registry maps keys, not
   components, on the server side).
7. **Interface-first for any external seam** (AI/OCR/extraction/storage/payment/mail): interface →
   registry → factory → config-driven selection with observable fallbacks. (ARCHITECTURE_PRINCIPLES.)
8. **Append `docs/BUILD_LOG.md`** after a unit of work.

---

## Recipes

### Add a structured document type
1. `libs/document-schema/src/<type>/` — `schema.ts`, `form-metadata.ts`, `prompts.ts`, `risks.ts`,
   `index.ts` (build the `DocumentTypeBundle`, call `registerDocumentType`, re-export).
   - **Draft schema MUST be a shallow `Schema.partial()`** (see gotcha #1).
2. Register: add the side-effecting import + exports in `libs/document-schema/src/index.ts`.
3. `libs/document-templates/src/<type>/<variant>/index.tsx` — the React template. Register its
   `componentKey` in `libs/document-templates/src/_registry.tsx`.
4. Seed row in `tools/prisma/seed-data/document-types.ts` (with `templates[]` whose `componentKey`
   matches the registry).
5. If not e-signable (will / PoA / promissory note / conveyance) → add the key to `ESIGN_EXCLUDED_KEYS`
   in `libs/shared/legal-reference/src/lib/schedule1.ts`.
6. Optional: freeform AI preset in `document-presets.ts` + a `COURT_SCAFFOLDS[...]` entry in
   `apps/api/src/app/legal-ai/court-scaffolds.ts`. New dropdowns → lookup group (below).
7. **Re-seed** (`pnpm prisma:seed`). Verify: app typecheck + api build + lint.

### Add a lookup (dropdown option-set)
- Add a group in `tools/prisma/seed-data/lookups.ts` (use the `toValues` helper).
  - ⚠️ **Currency stays UPPERCASE ISO** (gotcha #2). Lookup seeding is **add-only** — clear the group
    first if re-seeding changed values, or you get duplicates.
- Reference from form metadata: `{ widget: 'lookup', lookupKey: '<key>' }`. **Re-seed.**

### Add a server-side paginated table (the pattern established this session)
- **DTO** (`*.dto.ts`): `page`, `pageSize` (max 100/200), `q`, `sort` (enum of columns), `dir`, + filters.
- **Service**: build `where`; `orderBy` from sort/dir; `this.db.$transaction([findMany({take,skip,…}),
  count({where})])` → return `{ items, total }`. (For derived facets/KPIs, aggregate with `groupBy`.)
- **api-client**: query type + return `{ items, total }`.
- **Query hook**: `useQuery({ queryKey: keys.page(params), queryFn, placeholderData: keepPreviousData })`.
- **Component**: drive `@org/ui` `DataTable` in **server mode**:
  ```tsx
  <DataTable data={rows} columns={cols} rowKey={r=>r.id}
    search={r=>r.title} pageSizeOptions={[10,25,50,100,200]}
    server={{ page, pageCount, total, onPageChange:setPage, sort, onSortChange:setSort,
      query, onQueryChange:setQuery, pageSize, onPageSizeChange:setPageSize,
      loading: isFetching && isPlaceholderData }} />
  ```
  Reset `page` to 0 when filters/sort/search/pageSize change. Reference: `DocumentsList.tsx`,
  `BatchesPage.tsx`. Small/bounded lists stay client-side (just `<DataTable data=… />`, no `server`).

### In-flight: powerful search + analyse/ask on any doc
See **`docs/09-search-analysis-RESUME.md`** (self-contained plan, decisions, task IDs #1–#10).

---

## Gotchas / landmines (hard-won — don't rediscover these)
1. **Draft schema must be SHALLOW `Schema.partial()`** — a deep partial breaks the
   `DocumentTypeBundle<Partial<T>>` generic.
2. **Currency lookup values must stay UPPERCASE ISO** (`INR`/`USD`…) — `Intl.NumberFormat` and the Zod
   currency enums depend on it. Lookup seeding is **add-only** (clear before re-seed to avoid dupes).
3. **`import/first` eslint rule**: put module-level `const`s AFTER all imports, or lint errors.
4. **Re-seed after adding doc types / lookups** — the DB drives the catalog + dropdowns. Code is hot-
   reloaded; rows are not.
5. **Admin section is currently open to any authenticated user** (the `@Roles('admin')` gate was removed;
   in-code comments say how to re-lock). Lookup endpoints were aligned to this. Don't assume admin-only.
6. **`batch.status` is DERIVED** from its runs and is now persisted via `deriveBatchStatus` /
   `recomputeBatchStatus` (`apps/api/.../intelligence/batch-status.ts`). Keep that helper the single
   source; call `recomputeBatchStatus(batchId)` at **every** run-status transition (run complete/park/
   fail, approve, archive, reprocess). Pre-existing batches stay `running` until a run next transitions.
7. **Invoice family shares internals** — reuse `_internals/invoice-compute.ts` (`computeInvoice`,
   `makeMoney`) + `_internals/invoice-parts.tsx` (`ItemsTable`/`TotalsBlock`/`TaxSummary`/`PartyBlock`/
   `partyLines`) + `_shared/commercial-fields.ts`. Don't recompute totals per template.
8. **Template → freeform "detach"** renders the registered template with current data via
   `renderToStaticMarkup` (no edit provider → values bake in), then takes the Paginator's hidden-mirror
   `innerHTML`. Client-side only (API can't import React templates). Reference: `BuilderShell.tsx`.
9. **Document↔source link**: freeform converts stash `data.sourceDocumentId`; structured converts don't
   (their `data` is schema-validated). A real `Document.sourceDocumentId` column is the clean follow-up.
10. **Intelligence text/RAG**: `SourceDocument.normalizedText` is the parsed-text cache; single-doc RAG
    (`ask`) still uses `SourceChunk.embedding` with in-process cosine; `AnalysisRun` is now **polymorphic**
    (`subjectType` source|document + `subjectId`) and **content-hash cached** (analyse/ask works on drafting
    Documents too, via `SearchTextService` + `DocumentsService` access checks).
11. **DB is PostgreSQL**, `data` columns are `JSONB`. **`pg_trgm` + `pgvector` are enabled** (search,
    docs/09) — `SearchIndex` has a **trigger-maintained** `tsv` (GIN) + `vector(1536)` (HNSW cosine).
    **Prisma drift is handled automatically — do NOT edit migrations by hand.** `pnpm prisma:migrate:dev`
    runs `tools/scripts/prisma-migrate-dev.mjs` (create-only → auto-strip the spurious `SearchIndex`
    `DROP INDEX` lines → `migrate deploy` → `generate`). Two reasons it works: (a) `tsv` is maintained by a
    **trigger** (`searchindex_tsv_trigger`), not a generated column, so Prisma never emits the *invalid*
    `ALTER COLUMN tsv DROP DEFAULT` that used to crash generation (P3006/P3018); (b) the remaining drift is
    only valid `DROP INDEX` on the tsv-GIN / HNSW indexes, which the wrapper strips. Bypass with
    `prisma:migrate:dev:raw` only if you know why. Cross-cutting index maintained by `SearchIndexService`
    (global module) — write paths call `enqueueDocument`/`enqueueSource` (BullMQ + inline fallback).
    ⚠️ **Runtime schema-path:** `pg_trgm` lives in `public`, but Prisma's connection `search_path` is the app
    schema (`starter`) only — so in raw SQL you MUST qualify trgm functions (`public.similarity(...)`) or you
    get `function similarity does not exist` (42883). `vector` was installed into `starter` (on path), so
    `::vector` / `<=>` need no qualifier; `to_tsvector`/`ts_rank`/`ts_headline` are in `pg_catalog`.
12. **The two doc worlds are separate**: `SourceDocument` (uploaded, intelligence) vs `Document`
    (drafting). No FK between them by default.

---

## Current state (2026-06-13)
- Shipped & verified (typecheck/build/lint, **not** browser-verified): server-side pagination for
  Documents + Batches (+ persisted batch status, page-size dropdown), config-page layout cleanup,
  view-original-file, batch review stepper (Prev/Next across all batch docs). See BUILD_LOG.
- Structured doc types: rent_agreement, rti, legal_notice, affidavit, nda, promissory_note,
  employment_offer, power_of_attorney, invoice, receipt, quotation, purchase_order, credit_note,
  payslip, will (+ freeform). **Needs a DB re-seed** to surface the recent ones.
- **Search (docs/09) — CODE-COMPLETE** (verified typecheck/build/lint + DB SQL, NOT browser-verified):
  unified hybrid keyword+semantic search (`GET /search`), analyse/ask on ANY document (polymorphic +
  cached), configurable org/system `SearchConfig` + admin UI, server-side pagination for batch runs +
  review queue. Run `POST /admin/search/reindex` once to backfill existing rows; semantic needs an
  embedding provider. See the Prisma migration-drift gotcha (#11) before the next migration.
