# Plan: Plug-and-play template library (manifest plugins, file + DB)

> Status: PLAN — not implemented. Source of truth for making doc types pluggable
> with **no deploy**. Supports **both** load paths (git-tracked file + runtime DB).

## Context

Adding a new legal doc type today means **editing and redeploying code in three places**:
`libs/document-schema/src/index.ts` (side-effect import), a hand-written Zod schema +
`form-metadata.ts` + `risks.ts` per type, and `libs/document-templates/src/_registry.tsx`
(a React component import). These three libs are parallel mirrors of the same field shape
(`@org/document-schema`, `@org/document-templates`, `@org/doc-intelligence` field-maps), so
every doc type is triple-maintained. There is **no way to add a doc type without a deploy**.

Goal: make doc types **plug-and-play** — a single declarative **manifest** (the "small bundle")
that is the one source of truth, loadable **both ways**: from a versioned `.json` file (build/boot,
git-tracked) and from the DB at runtime (admin authors → publish → live, **no deploy**). Less code
(one manifest replaces schema+metadata+risks+field-map), easy to manage (admin UI), and safe:
manifests are **data interpreted by a fixed trusted runtime**, never executed JS — no RCE.

Why this is cheap to build (verified in code):
- `libs/document-schema/src/_registry.ts` already registers bundles into a runtime `Map` via
  `registerDocumentType()` — dynamic registration needs no new registry, just new *sources*.
- `FieldMetadata` and `ShowIfClause` (`libs/document-schema/src/types.ts`) are **already
  declarative**. Only `schema: z.ZodType` and `risks: (data)=>Warning[]` are live code to generate.
- `TemplateRenderer` (`libs/document-templates/src/TemplateRenderer.tsx`) already resolves by
  string `componentKey` and renders unknown keys gracefully — perfect seam for a declarative path.

## The manifest format (single source of truth)

A pure-data object, valid as a `.bundle.json` file **or** a DB `manifest` JSON column:

```jsonc
{
  "key": "nda",
  "version": "2026-06-17",                 // effective-date; drives risk ruleVersion
  "title": "Non-Disclosure Agreement",
  "jurisdiction": "IN", "language": "en",
  "extends": null,                          // optional: inherit+override a base manifest (composition)
  "fields": {                               // → compiles to Zod schema + FormMetadata + extraction field-map
    "disclosingParty.name": { "type":"string","required":true,"min":1,
                              "label":"Disclosing party","widget":"text" },
    "termMonths":           { "type":"number","required":true,"min":1,
                              "label":"Term (months)","widget":"number" }
  },
  "sectionOrder": ["parties","terms","witnesses"],
  "risks": [                                // declarative, reuses the ShowIfClause predicate grammar
    { "id":"nda-short-term","when":{"field":"termMonths","lte":0},
      "severity":"warning","message":"Term should be at least 1 month" }
  ],
  "prompts": { /* PromptDefinition map — already plain data, passed through */ },
  "render": {
    "mode": "declarative",                  // "declarative" = no-deploy prose docs
    "pageSize": "a4",
    "sections": [
      { "id":"title","block":"heading","text":"NON-DISCLOSURE AGREEMENT" },
      { "id":"parties","block":"paragraph",
        "html":"This Agreement is made between {{disclosingParty.name}} ..." }
    ]
    // OR: "mode":"component","componentKey":"invoice.standard"  ← escape hatch for compute-heavy docs
  }
}
```

`compileManifest(manifest)` produces the **existing** `DocumentTypeBundle` shape — so every current
consumer (builder, legal-ai, catalog, artboard) keeps working unchanged.

## Approach (both load paths, behind one interface)

Per `docs/ARCHITECTURE_PRINCIPLES.md` (interface → registry → factory → config-driven + observable
fallback): one `TemplateSource` interface, two implementations, both active and merged by version.

### Phase 1 — `@org/template-kit` (new pure lib, server-safe, no React)
The "small bundle". Add to `tsconfig.base.json` paths and `libs/template-kit/`.
- `manifest.schema.ts` — Zod meta-schema + TS types for the manifest above (the contract that
  validates every plugin before it loads).
- `compile.ts` — `compileManifest(m): DocumentTypeBundle`:
  - `fields` → build `z.object({...})` (the live Zod schema) **and** `FormMetadata` from the same spec.
  - `risks[]` → a `RisksFunction` by evaluating each `when` clause. **Reuse the existing
    `ShowIfClause` evaluator** — locate it (search `showIf` consumers in the builder app / `@org/store`)
    and lift it into `template-kit` as a shared predicate evaluator so showIf and risks share one engine.
  - `prompts`, `sectionOrder`, `knownTemplates` → pass through.
- `loader.ts` — `TemplateSource { list(): Promise<RawManifest[]> }`, and
  `loadBundles(sources[])` that validates → compiles → `registerDocumentType()`. Invalid manifest is
  logged and **skipped** (observable fallback), never crashes boot. DB version > file version wins.

### Phase 2 — Two sources (both ways)
- `FileTemplateSource` — globs `*.bundle.json` from a conventional dir (e.g. `bundles/`). Boot-time,
  git-tracked, zero-config: drop a file, it registers (still needs a deploy, but no code edits).
- `DbTemplateSource` — reads a new Prisma `TemplateBundle { key, version, manifest Json, status }`
  table (`tools/prisma/schema.prisma`). Runtime, hot-loadable. **This is the no-deploy path.**
- API wiring: `apps/api` calls `loadBundles([FileTemplateSource, DbTemplateSource])` at startup and
  re-runs the DB source on publish (cache + invalidate). `documents.service.listTypes()` (`/catalog`)
  already enumerates the registry, so DB bundles surface automatically.

### Phase 3 — Declarative renderer (`@org/document-templates`)
- Add **one** generic `DeclarativeTemplate` component that interprets `render.sections`, reusing
  existing `_internals/` (`Page`, `Paginator`, `paginate-html.ts`, `EditableField`, `format.ts`,
  `use-fonts-ready.ts`). `{{path}}` token interpolation over `data` using the existing format helpers.
- In `TemplateRenderer.tsx`: when `componentKey` resolves to a manifest with `render.mode:"declarative"`,
  render via `DeclarativeTemplate` (passing the manifest's sections). Compute-heavy docs
  (invoice/payslip/credit-note/quotation/purchase-order — all share `invoice-compute.ts`) keep
  `mode:"component"` + their existing component. **Hybrid: ~80% no-deploy, the rest honest.**
- Artboard `RenderRoute`/`LivePreview` fetch the manifest by key when the component is declarative.

### Phase 4 — Migrate one doc type to prove parity
Convert **NDA** (simple prose) to a manifest; delete its `schema.ts`/`form-metadata.ts`/`risks.ts`
duplication; confirm identical form, validation, risks, and rendered output. Leave the invoice family
as `mode:"component"`. This is the acceptance test for the format.

### Phase 5 — Admin authoring UI ("easy to manage", no-deploy in practice)
- `/config/template-bundles` page — follow the UI-consistency rules: `DataTable` + server paging +
  `Select` filters + ≤3 inline icons + `⋯` overflow + linkable name cell + `/config/template-bundles/new`
  and `/config/template-bundles/:id/edit`.
- Editor: manifest JSON/form editor + **Validate** (calls `compileManifest` dry-run on the server) +
  **live preview** via the existing artboard `LivePreview` iframe + **Publish** (writes `TemplateBundle`,
  re-registers). All `@org/ui` components, all new strings wrapped in `t('key','English')`.

## Critical files

- New: `libs/template-kit/src/{manifest.schema.ts,compile.ts,loader.ts,index.ts}`; `tsconfig.base.json`.
- Reuse/generalize: `libs/document-schema/src/types.ts` (`DocumentTypeBundle`, `FieldMetadata`,
  `ShowIfClause`), `libs/document-schema/src/_registry.ts` (`registerDocumentType`).
- `libs/document-templates/src/TemplateRenderer.tsx` + new `DeclarativeTemplate`, reusing `_internals/`.
- `apps/api/src/app/documents/documents.service.ts` (`listTypes`), `.controller.ts` (`/catalog` + new
  `/config/template-bundles` CRUD/publish).
- `tools/prisma/schema.prisma` (new `TemplateBundle` model + migration).
- New admin page under the React app's `/config/*` routes.

## Verification

- `pnpm nx typecheck template-kit document-schema document-templates api` and `pnpm nx lint` clean.
- Unit: `compileManifest` round-trip — assert generated Zod accepts/rejects the same inputs as the
  current `NdaDraftSchema`, and risks fire identically (golden test vs. existing `ndaRisks`).
- File path: add an NDA `.bundle.json`, boot API, hit `/catalog` → NDA present; build NDA in the
  builder → form, inline errors, and rendered PDF match pre-migration output.
- DB path: via `/config/template-bundles` create a throwaway doc type, Validate, Publish → it appears
  in the catalog and renders in artboard **without restarting/redeploying** the API.
- Negative: publish an invalid manifest → rejected with field errors, boot still succeeds with the
  bad file skipped and logged.

## Out of scope / explicit non-goals

- No execution of arbitrary uploaded JS/React. Manifests are data only.
- Compute-heavy templates (GST tables) are **not** forced into a DSL — they stay code components.
- `@org/doc-intelligence` field-map unification is noted as a follow-on (the manifest can emit it),
  not done in this pass.
