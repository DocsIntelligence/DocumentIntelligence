# Build Log — resumable implementation tracker

> **Purpose:** so anyone (you or a fresh Claude session) can pick up exactly where we left off.

### 2026-06-14 — Every admin CRUD is a real route, not in-page state

User: "use specific page for edit etc. with proper separate crud api … fix this for all the
modules. recheck".

The remaining admin managers held create/edit/clone in `useState`; refresh discarded the work,
URLs didn't change, and the form's own Cancel/Save fought with the page chrome. All four modules
are now route-based with separate URLs per CRUD action:

- **Document types (`SchemaManager`)** — `useState` removed; toolbar + Map / Edit / Clone icons
  navigate. New routes wired in `app.tsx` → `IntelligenceConfigPage`:
  - `/admin/intelligence/types/new` → `NewDocTypePage`
  - `/admin/intelligence/types/:schemaKey/edit` → `EditDocTypePage`
  - `/admin/intelligence/types/:schemaKey/clone` → `CloneDocTypePage`
  - (existing) `/admin/intelligence/types/:schemaKey/mapping` → `FieldMappingPage`
  Each page wraps `SchemaEditor` / `FieldMapEditor` in the same `ConfigShell` (so the page title +
  subtitle live in the chrome). `SchemaEditor`'s duplicate h3 + Cancel/Save dropped; replaced
  with a single "Back to types" + "Save" toolbar.
- **Pipelines (`PipelineManager`)** — same pattern:
  - `/admin/intelligence/pipelines/new` / `:pipelineKey/edit` / `:pipelineKey/clone`
  - Editor exported, `pipelineDetailToForm()` extracted so the clone page can pre-fill from the
    loaded summary with `_copy` suffixes.
- **Lookups (`LookupManager`)** — `creating` + `selectedId` state replaced by routes:
  - `/admin/intelligence/lookups/new` → `NewLookupGroupPage` (`CreateGroup` inside `ConfigShell`)
  - `/admin/intelligence/lookups/:groupId` → `EditLookupGroupPage` (loads via `useAdminGroup` then
    renders `GroupEditor`)
- **Vault config (`VaultConfigManager`)** — both modal dialogs converted to inline forms:
  - `VaultFieldForm` + `VaultDocKindForm` exported (no more `Dialog` wrappers); the in-page
    `editField` / `editDocKind` state is gone. Toolbar buttons use the standard "Back / Save"
    bordered toolbar.
  - Routes: `/admin/intelligence/vault/{fields/new, fields/:fieldId/edit, doc-kinds/new,
    doc-kinds/:kindId/edit}`. New-field page reads the active entity-kind from `?kind=…` so the
    "Add field" button in a person/company/other section pre-selects correctly.

All editors use the **existing separate CRUD endpoints** (`createSchema/updateSchema/deleteSchema`,
`createPipeline/updatePipeline/deletePipeline`, `createGroup/updateGroup/deleteGroup`,
`upsertVaultField/deleteVaultField`, etc.) — refresh works, deep-linking works, back/forward works.

**app typecheck ✓ · app build ✓ · app lint 0 errors (only pre-existing warnings).**

### 2026-06-13 — Field-mapping is a proper route, not in-page state

User: "Field mapping — Legal Notice / amendment_or_addendum_to_master_agreement … 2 buttons … url
is not changing and refresh sends to table".

- New route **`/admin/intelligence/types/:schemaKey/mapping`** rendering a new `FieldMappingPage`
  (wraps `FieldMapEditor` in the same `ConfigShell` as the rest of the admin pages, so the URL
  shows the schema key and refresh stays on the mapping screen).
- `SchemaManager` no longer holds `mappingKey` state — the Map icon button now `navigate(...)`s
  to the URL above.
- `FieldMapEditor` cleaned up:
  - Title inconsistency fixed: now shows `schema.name` if present, else `humanise(schemaKey)`
    (`amendment_or_addendum…` → `Amendment Or Addendum…`), with the raw key shown as `font-mono`
    next to it so it's never ambiguous.
  - The form's own `<h3>` + duplicate Cancel/Save buttons are gone; the page header now owns the
    title/subtitle, and the form's action row is a single "Back to types" + "Save mapping"
    bordered toolbar (matches BatchDetail/Builder header pattern).
  - Drafting-doctype + field-count badges added to the context strip.
  - Loading is skeleton rows; empty (no fields yet) gets a dashed empty card instead of dropping
    silently.
- **app typecheck ✓ · app lint 0 errors.**

### 2026-06-13 — Pinned columns always anchored to the right edge

User: "why action column is in between, they will b in last always".

Root cause: the persisted `dt:<tableId>.order` from a previous schema (e.g. pre-rename) didn't
include columns that were added later. The old logic was: walk persisted order → append unseen
columns at the end. With actions persisted before the newly-added columns, actions ended up in the
middle.

- `@org/ui::DataTable`: new `effectiveOrder` memo always re-flushes pinned columns to the right at
  render time, regardless of what's in localStorage. Persisted state now stores **only non-pinned
  ids**; `reorderColumns` and `onColumnOrderChange` both strip pinned ids before writing.
- Net effect: an action column with `pinned: true` is permanently last; users can drag/persist the
  rest however they like and we'll still anchor `actions` to the right edge on next mount.
- **app typecheck ✓ · ui lint 0 errors.**

### 2026-06-13 — DocTypes admin (`/admin/intelligence/types`) UI polish

User: "ui is not looking good".

- 4-tile KPI strip across the top of the manager — Total / Active / Disabled / Read-only — matches
  the BatchesPage pattern; instantly gives the admin a system-state snapshot.
- "Type" cell is now the standard icon + two-line cell (DocIcon + name + `font-mono` key beneath),
  same shape as Documents / Batches / Review queue.
- Replaced the implicit "read-only / disabled inline badges" with two real columns:
  - **Drafting type** column: doc-type-key as a `Badge`, or a `read-only` info-badge when null.
  - **Status** column: explicit `Active` (success) / `Disabled` (secondary) badge instead of an
    inline flag — sortable.
- Removed the redundant intro paragraph (`ConfigShell` already shows the page subtitle); the in-card
  section now carries a small "All document types" sub-heading + a tighter hint, with the **+ New
  type** as a full-sized button (was `size="sm"`).
- Loading state replaced with skeleton rows (matched to the BatchesPage list skeleton); empty state
  now offers a `+ New type` CTA inside the table card instead of dead text.
- Every column has a `defaultWidth` so the table-fixed layout doesn't reflow on first paint.
- **app typecheck ✓ · app lint 0 errors.**

### 2026-06-13 — VaultConfigManager row actions match the shared icon pattern

User: "`/admin/intelligence/vault` use same icons".

- `VaultConfigManager.tsx` (`Vault fields` + `Document kinds` tables): the previous
  `<Button>Edit</Button> <Button>Delete</Button>` pair replaced with the standard `IconButton` row
  (EditIcon + TrashIcon, shared from `../intelligence/icons`), `pinned: true` action column.
- Delete now goes through `useConfirm()` (was a fire-and-forget mutate) — copy explains that field
  removal keeps existing entity data and doc-kind removal keeps existing documents.
- **app typecheck ✓ · app lint 0 errors.**

### 2026-06-13 — Consistent pagination + row-action pattern

User asks: "use page size in all tables, verify and make all similar… pagination same with custom
page goto... icons in actions if there are too many then put non primary in dropdown" → followed by
"put duplicate directly, and enable/disable instead of dropdown" → "show 4 options in icon then all
other to dropdown, view/copy/delete/disable" → "put confirmation to all like delete disable".

- **Pagination uniform across every table**: DataTable defaults `pageSizeOptions=[10,25,50,100,200]`
  and `pageSize=25` so every consumer renders the same footer — rows-per-page dropdown +
  Prev / "[page] of N" page-jump input / Next — with no per-call wiring.
- **Row actions standardised** to a 4-icon row (View/Copy/Delete/Disable) with overflow `⋯` for the
  rest:
  - `DocumentsList`: Open (view) + Duplicate (copy) + Delete icons; Rename / Share / Version history
    moved into the ⋯ dropdown. (Documents have no disable.)
  - `VaultPage`: Open + Duplicate + Disable/Enable + Delete (4 inline icons, no overflow).
  - `LookupManager`: Manage values (edit) + Duplicate + Delete (group-level disable doesn't exist).
  - `PipelineManager`: Edit + Clone + Disable/Enable + Delete (4 icons).
  - `SchemaManager`: Edit + Clone + Field-mapping (when applicable) + Disable/Enable + Delete.
  - `BatchDetailPage`: Open + Approve icons; Process-as-type and Skip in ⋯ overflow (those are run-
    specific extras, not part of the standard 4).
  - Action columns are now `pinned: true` so the user can't drag them away from the right edge.
- **Confirmations on destructive + state-changing actions**: every Disable/Enable now goes through
  `useConfirm()` (Pipeline / Schema / Vault). Delete confirmations were already in place.
- **app typecheck ✓ · app lint 0 errors · ui lint 0 errors (only pre-existing warnings).**

### 2026-06-13 — DataTable rebuilt on @tanstack/react-table

User: "column should not be overlapped, use a proper data table, if needed use some library."

- Installed **`@tanstack/react-table@8.21.3`** (headless, ~14KB, same family as react-query already
  in the repo).
- Rebuilt `@org/ui::DataTable` internals on `useReactTable` while keeping the **public API
  identical** (`DataTableColumn`, `DataTableServer`, `DataTableProps`, `rowKey`, `search`, `toolbar`,
  `renderExpanded`, `tableId`, `resizableColumns`, `reorderableColumns` all unchanged).
- Why the rebuild: my custom column-sizing model had the classic "content overflows neighbour column"
  failure when cell content was wider than the column. react-table's column sizing model + a strict
  `table-layout: fixed` + `overflow: hidden` per `<td>` give clean, library-grade clipping (with
  internal `truncate` on text still working).
- Tile-fixed math: every header/cell uses `header.getSize()` / `column.getSize()` for width, the
  `<table>` width is `table.getTotalSize()` clamped to ≥100%, and the outer scroll wrapper takes
  over horizontally when columns exceed the viewport.
- Resize: `columnResizeMode: 'onChange'`, handles call `header.getResizeHandler()` (mouse + touch).
  Double-click clears that one column's width. Persisted to `localStorage['dt:<tableId>'].widths`.
- Reorder: HTML5 drag/drop on header cells (pinned columns are immovable). Persisted to
  `.order`. Padding logic keeps newly-added columns visible if older saves predate them.
- Backwards-compatible width: legacy `column.width: 'w-32'` now auto-parses (`tailwindWidthToPx`)
  into a pixel `size`, so existing tables keep their intended narrow columns out of the box.
- **app typecheck ✓ · app build ✓ · app lint 0 errors · ui lint 0 errors (only pre-existing).**

### 2026-06-13 — DataTable upgrade: resize/reorder/scroll + wider layout

User: "use full width available for table. and keep them scrollable and upgrade the table, so user
can rearrange etc the table like column width etc..."

- **MainLayout widened** (`apps/app/.../main-layout/MainLayout.tsx`): `max-w-6xl` (~1152 px) →
  `max-w-screen-2xl` (~1536 px). All dashboard pages get more horizontal room without breaking the
  reading-width guard for forms (which still cap themselves locally).
- **`@org/ui::DataTable` rebuilt** as a power table while staying API-compatible:
  - **Horizontal scroll**: inner `<div className="overflow-x-auto">` wraps the table — narrow
    viewports / many columns scroll instead of squishing.
  - **Column resize**: drag a handle on each header's right edge (visible on hover); `minWidth`
    defaults to 60 px (overridable per-column via `column.minWidth`). Double-click the handle to
    reset that column to default. Live-updates a `<colgroup><col style={width}>` model so widths
    stay perfectly aligned in `table-auto`; switches to `table-fixed` once any user width is set
    so resizes stick crisply.
  - **Column reorder**: headers are HTML5-draggable; drop on another header to swap order (pinned
    columns refuse to move/be displaced via new `column.pinned`). Drop targets ring-highlight.
  - **Persistence**: new `tableId?: string` prop saves `{order, widths}` to
    `localStorage['dt:<tableId>']` so each user's layout survives reloads/sessions per-table.
    No `tableId` → resize/reorder still work, just in-memory.
  - **"Reset columns" button** appears in the toolbar row once a layout is customized (clears
    both order and widths for that table).
  - Backwards-compatible: existing Tailwind `column.width` still applied as a fallback when no
    user pixel width exists; `defaultWidth` (px) is the new pixel-first knob.
- **Wired `tableId` on all major user-facing tables**: documents.list, intelligence.batches,
  intelligence.batchDetail.runs, intelligence.reviewQueue.{global,batch}, vault.list,
  admin.lookups.groups, admin.intelligence.{pipelines,schemas}, admin.vault.{fields,docKinds}.
- **app typecheck ✓ · app lint 0 errors · ui lint 0 errors (only pre-existing warns).**

### 2026-06-13 — Review queue full-width + batch column; BatchDetail runs → DataTable

User: "review table is not similar and showing all details" + "fix review queue, add batch details and
filter etc... keep them proper" + "review all tables for review and documents".

- **Review queue full-width** (`ReviewQueuePage`): dropped `mx-auto max-w-3xl` — matches `BatchesPage` /
  Documents list. Filename is a clickable row-opener (button → focused review) with the type as a
  subline, BatchesPage-style icon+two-line cell.
- **New columns:** Batch (global scope, links to `/batches/:id`), Updated (sortable, default desc).
  Status was previously batch-only — now shown in both modes for consistency. Confidence still center
  badge. Action column is an outline "Review →" button instead of an icon.
- **Filters proper:** type-chip toolbar (already there) + **status-chip filter** in batch mode (separated
  by a `|` divider when both visible). Both filter client-side over the loaded queue page.
- **API enriched** (`pipeline-executor.service.ts::reviewQueue` + `batch.service.ts::listRuns`):
  `ReviewQueueItem` now returns `batchName` + `updatedAt`; `BatchRun` returns `updatedAt`. So both
  global and batch scopes get a real timestamp column.
- **BatchDetail runs → `DataTable`** (`BatchDetailPage`): the Card/divider list became a server-driven
  DataTable with the same look — search box, sortable columns (File / Type / Status / Updated /
  Actions), status-chip toolbar (replaces the standalone chip row), page-size selector. Per-row actions
  (Open / Approve / Process as… / Skip) preserved in a right-aligned cell. Custom Prev/Next pager
  removed — DataTable now owns paging.
- **app typecheck ✓ · app lint 0 errors · api lint 0 errors.**

### 2026-06-13 — Review queue → DataTable + filter; icon row-actions rule

- **Review queue list → `DataTable`** (`ReviewQueuePage` list mode): columns File / Type / Status (batch
  scope) / Confidence / Review, with search + a **type-filter chip toolbar** + page-size. The focused
  review **stepper is unchanged** — the Review action opens it at the right index (found by run id, so
  it survives sort/filter). Empty state via the table's `empty`.
- **Icon row-actions (new standing rule, memory `feedback_ui_consistency` §6):** basic actions are **icon
  buttons**, overflow goes in a ⋯ dropdown *alongside* them. Applied: Review queue (icon Review button);
  Vault list (Open + Delete as ghost icon buttons + ⋯ dropdown for Duplicate / Enable-Disable). LookupManager
  already follows this.
- **app typecheck/build ✓ · lint 0 errors.**

### 2026-06-13 — Lean lists + per-item CRUD + jump-to-page (all tables)

User directives: jump to any page in all tables; "use crud, instead of list for getting all data" — lists
return lightweight summaries, fetch each item's detail on select. Saved as memory `feedback_ui_consistency` §5.
**api build ✓ · app typecheck/build ✓ · lint 0 errors.**
- **DataTable jump-to-page:** the pager's "1 / N" is now a number input (`PageJump`) — type a page + Enter to
  jump. Works in client + server mode, so **every table** gets it.
- **Lookups → lean server-side CRUD:** `getAllPaginated` returns **summaries** (`valueCount`, no nested
  values) + `GET /lookups/admin/:id` (`getOneAdmin`) fetches a group's values **only when selected**.
  `LookupManager` is server-paginated (search + page-size), the value editor + duplicate fetch the group's
  values on demand. No more loading all groups×values up front.
- **Vault → entity-first:** `list` no longer decrypts/returns fields (was per-row AES) — it returns lean
  summaries; the masked fields load on select via `get(id)`, unmasked via `reveal(id)`. Dropped the list
  "Details" column. So selecting an entity is what surfaces its fields.
- Remaining (ledgered): apply the same lean-CRUD to schemas/pipelines admin (currently load nested fields/
  stages in the list); they're small + now have jump-to-page.

### 2026-06-13 — Vault list: server-side pagination (scales to many entities)

Vault was already grid (DataTable) + dedicated edit pages, but the list fetched + **decrypted every entity**
client-side. Made it server-paginated so only the current page is fetched/decrypted. **api build ✓ ·
app typecheck/build ✓ · lint 0 errors.**
- `VaultService.list(userId, query)` → `$transaction(findMany take/skip + count)` with label search, sort
  (label/kind/updated/documents — `documents` via `orderBy: { documents: { _count } }`), returns
  `{ items, total }`; decrypts only the page. `ListVaultEntitiesQueryDto` + `@Query`.
- api-client `list(query)` → `{items,total}` + `ListVaultEntitiesQuery`; `useVaultEntities(params)` with
  `keepPreviousData`.
- `VaultPage` → `DataTable` **server mode** (page/pageSize/sort/query state + callbacks, page-size selector,
  loading dim) — same pattern as Documents/Batches.
- `VaultAutofillDialog` → paginated fetch (pageSize 50) + a **search box** so picking scales too.

### 2026-06-13 — App-wide UI/UX audit + consistency pass (wave 1)

Audited every feature page (fan-out) against the standing UI rule; app was already largely consistent
(Dashboard/DocumentsList/BatchesPage exemplary). Fixed the concrete gaps. **app typecheck/build ✓ · lint 0.**
- **Native elements → @org/ui:** structured-form boolean field + search-admin "searchable kinds" now use
  `@org/ui` `Checkbox` (were raw `<input type=checkbox>`).
- **Loading states:** Settings + AdminDashboard now show a `Spinner` (were text-only).
- **Destructive confirm:** single-run "Skip" in BatchDetail now confirms (matched the bulk skip).
- **@org/ui buttons:** SearchPage pager → `Button`; TemplatesPage category filters → `Chip` (were raw
  `<button>`s with inline active styles).
- **Container/header normalization:** MainLayout already centers at `max-w-6xl` + pads, so pages were
  double-wrapping. Removed redundant `p-4 sm:p-6` from Search/Vault/VaultEntity; standardized page `<h1>`
  to `text-2xl font-semibold tracking-tight` + `text-foreground/60` subtitle (Search/Vault/NewDocumentPicker).
- Remaining (ledgered, lower impact): DraftWithAI explicit cancel; normalize Batch/Review detail widths;
  unify a shared pagination control.

### 2026-06-13 — UI consistency: Vault → DataTable, sidebar regrouped (standing rule)

User directive: consistent table→edit pattern + dashboard-grade UI everywhere; rearrange the sidebar.
Saved as memory `feedback_ui_consistency` (applies to all future UI). **app typecheck/build ✓ · lint 0.**
- **Vault list → `DataTable`** (table → row link → detail/edit), replacing the card grid: columns
  Type/Name/Details/Docs/Updated + a row ⋯ actions menu (Open/Duplicate/Enable-Disable/Delete), search +
  sort + pagination — now consistent with `DocumentsList`/`SchemaManager`/`PipelineManager`/`LookupManager`
  (which already use DataTable; vault was the outlier).
- **Sidebar regrouped** (`MainLayout`): top-level Dashboard · Search · Vault; **Create** group; **Document
  Intelligence** group = operational (Analyze moved in + Batches/New batch/Review queue); new
  **Configuration** group = Document types/Pipelines/Lookups/Search settings/Vault fields (split admin/config
  out of the operational group, per "batches vs lookup/config").

### 2026-06-13 — Vault UX: duplicate, enable/disable, actions menu, lookup-linked fields

Per request ("better field UX + proper duplicate + disable/enable + fields linked to lookups").
**api build ✓ · app typecheck/build ✓ · lint 0 errors.**
- **Duplicate** entity — `POST /vault/entities/:id/duplicate` (clones encrypted fields, label "Copy of …",
  documents not copied, owner scope preserved) + `useDuplicateVaultEntity`.
- **Enable/disable** — `VaultEntity.isActive` (migration `vault_entity_active`); `update` accepts `isActive`;
  disabled entities are **hidden from the autofill picker** and muted in the list with a "Disabled" badge.
- **UX:** list cards got a ⋯ **actions menu** (Open · Duplicate · Enable/Disable · Delete) and muted styling;
  the detail page got an Actions menu (Duplicate / Enable-Disable) + disabled badge.
- **Lookup-linked fields** — new field `type: 'lookup'` + `lookupKey` (migration `vault_field_lookup`):
  a field like *country*/*state* pulls its options from the existing **Lookups** system
  (`useLookupOptions()[lookupKey]`), reusing the DB-driven, admin-managed option-sets. Wired through the
  config catalog, admin form (type=lookup → lookupKey input), and `FieldInput` renderer.

### 2026-06-13 — Shared @org/ui DatePicker (calendar) — used by vault + builder

There was no calendar in `@org/ui` (only Popover); the app used native `<input type="date">`. Built a
**dependency-free** `Calendar` + `DatePicker` (`libs/shared/ui/src/components/date-picker.tsx`) on the
existing Popover, styled like `SelectTrigger`, values as timezone-safe `YYYY-MM-DD` (no `toISOString`),
with prev/next month nav + Today/Clear. Adopted it for vault date fields (`VaultEntityPage` `FieldInput`)
**and** the document builder (`BuilderForm` `widget==='date'`, replacing the native input). app typecheck/
build ✓ · lint 0 errors. (Chose a hand-rolled calendar over adding `react-day-picker` — no new dep,
offline-safe, fully design-system styled.)

### 2026-06-13 — Vault: typed/grouped fields, scan-autofill, and DB-configurable catalog + admin

Made the vault "more detailed + configurable" per request. **api build ✓ · app typecheck/build ✓ · lint 0 errors.**
- **Typed + grouped fields:** field defs gained `type` (text/textarea/date/number/tel/email/select), `group`
  (Identity/Address/Bank/Contact), `options` (Indian states, gender, entity types). `VaultEntityPage` renders
  the right input per type (date pickers, dropdowns) grouped under subheadings.
- **Scan-autofill (the "Aadhaar section uploads and fills" ask):** `VAULT_DOC_KINDS` map each document kind →
  the canonical fields it can fill. `POST /vault/entities/:id/documents/:docId/scan` reads the stored file and
  **vision-extracts** those fields via `AiService.extract` + `sourcePart` (per-kind JSON schema + prompt;
  audited), returning suggestions. A **"Scan & autofill"** button per scannable document merges suggestions
  into empty fields (reveal→merge→update). Gated on a vision-capable provider.
- **DB-configurable catalog + admin (the "move constants to DB + admin config" ask):** new
  `VaultFieldConfig` + `VaultDocKindConfig` (org-scoped; `ownerOrgId=null` = system default, seeded from the
  code constants on first use; code = ultimate fallback). `VaultConfigService` resolves org→system→code and
  exposes admin CRUD. `VaultService` now reads the catalog from config (not hardcoded). Admin API
  `/admin/vault/{fields,doc-kinds}` (`VaultAdminController`) + `VaultConfigManager` UI as a ConfigShell tab
  (`/admin/intelligence/vault`, sidebar nav). Migration `vault_config` via the drift-safe wrapper.
  **Caveat kept:** canonical `key`s are stable identifiers (autofill depends on them); admins edit
  labels/types/sensitivity/order/options + add fields freely.

### 2026-06-13 — Vault → builder autofill ("Insert from vault")

Closed the vault's headline value. **app typecheck/build ✓ · lint 0 errors.**
- `BuilderForm`: each section header gets an **"Insert from vault"** button → `VaultAutofillDialog` (lists
  entities, fetches the audited `/autofill` canonical fields on pick) → `mapToSection` maps canonical keys to
  the section's form-field leaf names via a synonym table (`name←full_name/legal_name`, `address←address_line1`,
  `aadhaar←aadhaar_number`, `pan`, `gstin`, `cin`, `pincode`, `phone`, …) → batch `setMany` applies them in one
  `onChange`. So one saved entity fills landlord, tenant, deponent, etc.
- Files: `features/vault/autofill-map.ts` (`mapToSection`) + `VaultAutofillDialog.tsx`; wired into the
  structured builder. (Freeform-editor autofill + per-doc-type exact maps + OCR-prefill are ledgered follow-ups.)

### 2026-06-13 — Document Vault (docs/10): secure entity + document store with autofill (Tier 9)

Full-stack, encrypted-at-rest vault for entities (person/company/other) + their documents, to autofill
document forms. **api build ✓ · app typecheck/build ✓ · lint 0 errors · crypto roundtrip + migration verified.**
- **Security (the emphasis):** `VaultCryptoService` AES-256-GCM (key `VAULT_ENCRYPTION_KEY`, 32-byte base64;
  prod-required, dev-derived-with-warning). The whole canonical-fields JSON is encrypted at rest
  (`VaultEntity.dataEncrypted = iv:tag:ciphertext`) — no plaintext PII column. Sensitive keys
  (aadhaar/pan/passport/phone/bank…) **masked by default** (`••••1234`); full values only via an **audited**
  `GET …/reveal`. `VaultAccessLog` records create/update/reveal/download/delete. Docs in S3, private,
  short-lived presigned URLs only. Owner/org-scoped. Reused `redactPii` keeps values out of logs.
- **Models** (`document_vault` migration via the drift-safe wrapper): `VaultEntity` + `VaultDocument` +
  `VaultAccessLog`. Canonical field registry per kind in `vault.fields.ts` (drives the form + masking + autofill).
- **API** (`/vault`, JwtAuthGuard): entities CRUD + `reveal` + `autofill` + document upload/presigned-url/delete.
- **Frontend:** api-client `vault.service` (wired through ServicesProvider) + hooks + `VaultPage`
  (list/create) + `VaultEntityPage` (masked detail → reveal-&-edit dynamic fields form, document
  upload/view/remove, delete) + `/vault` + sidebar nav + i18n.
- **Plan:** `docs/10-document-vault-RESUME.md`. **Next:** builder "Insert from vault" autofill (endpoint
  ready); later OCR autofill (uploaded Aadhaar/PAN → intelligence extractor → prefill).

### 2026-06-13 — Durable task ledger (docs/TASKS.md) + gap burn-down wave 1

User wants a checked-in backlog that survives logout / a different account, and all roadmap gaps closed.
- **`docs/TASKS.md`** created — the canonical, git-tracked ledger of every remaining gap (Tiers 0–8 +
  payments/GTM), with a resume protocol and checkboxes. Future sessions read it first. Memory
  `feedback_durable_task_ledger` records the standing practice.
- **Gap-analysis correction:** the planning docs (`04`, `08`) badly understate the build — e.g. the
  "writ petition ⬜" gap is already shipped (preset `writ-petition` + `COURT_SCAFFOLDS` entry; 66 freeform
  presets exist). Marked done in TASKS.md. Refreshing `04`/`08` is itself a Tier-0 task.
- **Wave 1 — PII log-stripping (Tier 1):** `apps/api/src/app/common/redact.ts` (`redactPii` masks
  email / Indian phone / Aadhaar / PAN; `scrubLogObject` for pino). Wired into `logger.module` via
  `formatters.log` (scrubs req url/query/msg/err) + expanded `redact` paths (password/newPassword/otp/token/
  set-cookie). Verified: `GET /api/search?q=rohit@perceptiv.co` logs as `?q=[email]`. api build ✓ · lint 0.

### 2026-06-13 — Powerful search v2: scoring engine, facets, sort, pagination, ⌘K palette

Upgraded search from "works" to product-grade. **app typecheck ✓ · app build ✓ · api build ✓ · lint 0
errors · scoring SQL validated on live data.**
- **Scoring overhaul** (`search.service.ts`): replaced the arbitrary `ts_rank*10` squash with
  **`ts_rank_cd(tsv, query, 32)`** (normalized to [0,1)), folded a title-trgm score in for typo tolerance,
  blended keyword/semantic by configured weights into a normalized relevance, then a **recency-decay**
  factor (`1/(1+age_days/30)`) mixed via a new **configurable `recencyWeight`** (SearchConfig column,
  migration `search_recency_weight` — applied via the new drift-safe wrapper, which correctly kept the
  ADD COLUMN and stripped the SearchIndex index drift). Final score ∈ [0,1]. Verified on real data: scores
  0.91/0.82…, sensible ranking.
- **Facets**: one `GROUP BY kind` query returns per-kind match counts (drafts vs uploads) and doubles as
  the total (replacing the separate count query). Chips show live counts.
- **Sort modes**: relevance | recent | title (DTO + service ORDER BY).
- **Title highlighting**: `ts_headline(..., HighlightAll=true)` on the title; client renders `«hl»` markers
  as `<mark>` (shared `highlight.tsx`, used by page + palette).
- **Timing**: `meta.tookMs` surfaced ("… · 12ms").
- **⌘K command palette** (`SearchCommandPalette.tsx`): global hotkey + sidebar "Search ⌘K" button,
  debounced, keyboard-driven (↑/↓/Enter/Esc), grouped, mounted once in MainLayout.
- **Pagination**: page-size selector (10/20/50/100) + first/prev/next/last + "Showing X–Y of Z", URL-synced
  (`?q&kind&type&status&sort&ps`).
- **Runtime fix:** `pg_trgm` is in `public` but the Prisma connection's search_path is `starter` only →
  qualified `public.similarity(...)` in the search SQL (was a 500 at runtime, `42883`).

### 2026-06-13 — Drift-safe Prisma migrations for SearchIndex (no manual editing)

User hit the documented drift the hard way: `pnpm prisma:migrate:dev` generated `ALTER COLUMN "tsv" DROP
DEFAULT` → **P3018/P3006** (invalid on a generated column; crashes the shadow DB before any migration file
is written, so post-hoc pruning is impossible). Recovered the failed/empty migration (rolled back, no data
lost) and fixed the root cause two ways so migrations are now hands-off:
- **`tsv` generated column → trigger-maintained** (migration `20260613071000_search_tsv_trigger`):
  `ALTER COLUMN "tsv" DROP EXPRESSION` (keeps data) + `searchindex_tsv_update()` + `searchindex_tsv_trigger`
  (BEFORE INSERT/UPDATE OF title,bodyText). Triggers are invisible to Prisma → the **invalid** `DROP
  DEFAULT/EXPRESSION` drift is gone entirely. Verified: tsv `is_generated=NEVER`, trigger maintains the
  vector, FTS still matches.
- **Auto-prune wrapper** (`tools/scripts/prisma-migrate-dev.mjs`, wired as `prisma:migrate:dev`; old command
  kept as `prisma:migrate:dev:raw`): `migrate dev --create-only` → strip the remaining *valid* spurious
  `DROP INDEX "SearchIndex_(tsv_idx|title_trgm_idx|embedding_hnsw_idx)"` lines → if only drift remains,
  discard the migration; else `migrate deploy` → `generate`. **Tested end-to-end:** a no-op run stripped the
  drift, removed the empty migration, and left all 3 special indexes intact; `migrate status` clean.
- Net: `pnpm prisma:migrate:dev` behaves normally, keeps HNSW/GIN performance, never needs hand-editing.
  Docs updated (AGENT guide gotcha #11, docs/09).

### 2026-06-13 — Server-side pagination for batch-detail runs + review queue (docs/09 #9)

The last growth-prone tables. **api build ✓ · app typecheck ✓ · app build ✓ · lint 0 errors.** NOT
browser-verified.

- **batch.get → aggregates only:** funnel + type histogram now come from `pipelineRun.groupBy` (status +
  documentTypeKey) — it no longer loads every run (a batch holds ~1000). `BatchDetail` dropped its `runs[]`.
- **New `GET /intelligence/batches/:id/runs`** (`batch.listRuns`): `$transaction(findMany+count)`, filters
  `status` / `documentTypeKey` / `openable` (needs_review+completed+approved, for the review stepper),
  `{items,total}`. `BatchDetailPage` runs list is now server-paginated (page state + Prev/Next, `keepPreviousData`).
- **Skip-by-type server-side:** new `POST /intelligence/batches/:id/archive-type` →
  `executor.bulkArchiveByType` resolves the archivable run ids server-side, so the client never holds 1000
  ids. `BatchDetailPage` "Skip type" + per-status filter chips drive the server query.
- **Review queue paginated:** `reviewQueue` (was a silent `take:100`) → `$transaction(findMany+count)` with
  `page`/`pageSize`, returns `{items,total}`. `ReviewQueuePage` stepper now pulls openable runs via
  `useBatchRuns({openable:true,pageSize:500})` (batch scope) / `useReviewQueue(…,500)` (global) instead of
  the full `batch.runs` payload. (Stepper walks one 500-row page — documented bound; old global cap was 100.)
- api-client: `getBatchRuns`/`archiveType`/`getReviewQueue` (now `{items,total}`) + `ListRunsQuery`/result
  types; hooks `useBatchRuns`/`useArchiveType` + paginated `useReviewQueue`.

### 2026-06-13 — Search UI + configurable admin + analyse/ask on ANY document (docs/09 #6,#7,#8 UI)

Frontend + the polymorphic analyse/ask backend. **app typecheck ✓ · api build ✓ · app build ✓ · lint 0
errors** (16 pre-existing warnings, untouched files). NOT browser-verified; semantic + analyse/ask need an
embedding/LLM provider running.

- **api-client + wiring:** new `createSearchService` (`/search`, `/admin/search/config`, `/admin/search/
  reindex`) + intelligence `analyzeDocument`/`getDocumentAnalysis`/`askDocument`. Wired through `main.tsx`
  → `ServicesProvider` → `useSearchService()`. Aligned `getAnalysis`/`getDocumentAnalysis` on one
  `AnalysisResult` shape.
- **#7 Global search UI** (`features/search/SearchPage.tsx`, route `/search`, top-level sidebar item):
  debounced box, kind chips (All/Drafts/Uploads), semantic-on badge, client pager, result cards with
  **safe highlight rendering** — the server emits `«hl»…«/hl»` sentinels (NOT `<mark>`) and the client
  renders highlights as real React `<mark>` nodes, never `dangerouslySetInnerHTML` over user content.
- **#8 Admin config UI** (`features/admin/search/SearchSettingsManager.tsx` + `SearchConfigPage` in the
  ConfigShell, route `/admin/intelligence/search`, sidebar item): RHF + `zodResolver(searchConfigSchema)`
  (shared `@org/dto`) editing weights/threshold/snippet/model/maxResults, semantic toggle (`Switch`),
  searchable-kinds checkboxes, + a **Rebuild index** button (`POST /admin/search/reindex`).
- **#6 Analyse/Ask on ANY document** — `AnalysisRun` + `SourceChunk` made **polymorphic** (`subjectType`
  source|document, `subjectId`; `sourceDocumentId` nullable + relation optional; migration
  `analysis_polymorphic_subject` backfills `subjectId = sourceDocumentId`). `AnalysisService` refactored to
  a subject core (`analyzeSubject`/`askSubject`/`getLatestForSubject`): documents derive text via
  `SearchTextService.forDocument`, access-checked through `DocumentsService.getById`; **content-hash dedupe
  cache** reuses an existing run when the analyzed text is unchanged. Endpoints `POST/GET /intelligence/
  documents/:id/{analyze,analysis,ask}`. Frontend: `useAnalysis/useRunAnalysis/useAsk` gained a `scope`
  arg; `DocumentInsights` reused with `scope="document"` in a collapsible "AI insights" section of the
  builder side panel.
- ⚠️ **Prisma drift gotcha:** the polymorphic migration's generator output tried to DROP the SearchIndex
  GIN/trgm/HNSW indexes + the generated-column default (Prisma can't represent them). Those statements were
  removed by hand and the migration applied via `migrate deploy`. **Every future migration must be pruned
  the same way** (or `migrate dev` will propose dropping the vector indexes). Documented in AGENT guide.
- **Remaining (docs/09):** #9 server-side pagination for batch-detail runs + review queue (independent).

### 2026-06-13 — Unified search backend: pgvector + pg_trgm, SearchIndex, hybrid query, configurable (docs/09 #1–#5,#8 backend)

Built the server side of the powerful cross-document search (docs/09). **API build ✓, SQL DB-validated**
(keyword + fuzzy proven on a live row; semantic vector ops resolve). NOT browser-verified; needs the API
running + an embedding-capable provider for the semantic leg.

- **Infra check (docs/09 #10) PASSED:** local PostgreSQL 16, `pg_trgm` 1.6 already installed, `vector`
  (pgvector) 0.5.0 available (ships HNSW). ⚠️ prod Postgres must also have the pgvector binary.
- **#1 Schema + migration** (`20260612214709_add_search_index`): `SearchIndex` (kind/refId/owner scope/
  title/bodyText/**generated `tsv` tsvector**/**`embedding vector(1536)`**/contentHash/type/status/
  refUpdatedAt, `@@unique([kind,refId])`) + `SearchConfig` (org-scoped, process-as-data). Hand-authored SQL:
  `CREATE EXTENSION pg_trgm/vector`, `SET search_path TO starter, public` (Prisma scopes to the app schema,
  so `public` opclasses like `gin_trgm_ops` were invisible — root cause of the first failed apply), generated
  tsvector (title 'A' + body 'B'), **GIN(tsv)**, **GIN(title gin_trgm_ops)**, **HNSW(embedding cosine)**.
  Applied with **NO data reset** (cleared the stale failed `_prisma_migrations` row by hand to avoid Prisma's
  reset prompt). `tsv` + `embedding` declared `Unsupported(...)` so Prisma leaves them alone.
- **#2 Text extractors** (`search/search-text.service.ts`): `forDocument` (freeform = fill `{{tokens}}` from
  `data.values` + strip HTML + fold field labels; structured = walk nested `data` resolving labels via
  `getBundle(typeKey).formMetadata` from `@org/document-schema` — server-safe, no React templates), `forSource`
  (normalizedText pages + latest AnalysisRun summary/parties/obligations + latest Extraction.fields).
- **#3 Index maintenance** (`search-index.service.ts`): typed `upsert` for scalars (generated tsv recomputes
  automatically) + raw `UPDATE … embedding = $1::vector` for the vector; **contentHash (sha256)** skips
  re-embedding unchanged text. Async via BullMQ (`SEARCH_QUEUE`) with **inline `setImmediate` fallback** when
  no `REDIS_URL`. `backfillAll()` reindexes every Document + SourceDocument. **Hooks** wired into
  `DocumentsService` create/patch/duplicate/restore/remove and the intelligence write paths (source create in
  intelligence+batch services, analysis create, all 3 extraction creates).
- **#4 Search API** (`search.service.ts`, `GET /search`): hybrid `$queryRawUnsafe` — `websearch_to_tsquery`
  + `ts_rank`, `ts_headline` snippets (`<mark>`), pg_trgm `similarity` fuzzy title, scoped to `ownerUserId=me
  OR ownerOrgId IN my orgs`, kind/type/status filters, offset pagination + count, browse mode when `q` empty.
- **#5 Semantic** blended into #4: embeds the query via `AiService.embed` (added non-throwing `canEmbed()`),
  cosine `1-(embedding<=>q)` weighted with ts_rank + fuzzy per config; semantic floor 0.2; degrades to
  keyword-only when no provider.
- **#8 backend** — `SearchConfig` is a configurable product surface: `SearchConfigService` (org row → system
  row → hardcoded defaults), shared `@org/dto` `searchConfigSchema`, admin endpoints `GET/PATCH /admin/search/
  config` + `POST /admin/search/reindex`. Module is **global** (`SearchModule.forRootAsync()`) so write paths
  inject `SearchIndexService` without import cycles.
- **Remaining (docs/09):** #7 global search UI + #8 admin config UI, #6 analyse/ask on ANY document
  (polymorphic AnalysisRun/SourceChunk + cache), #9 server pagination for batch-detail runs + review queue.

### 2026-06-12 — Platform-wide form validation: shared Zod (@org/dto) + react-hook-form, client+server field-level

Standardised every hand-rolled `useState` form onto the platform's existing-but-underused stack (the
auth forms already exemplified it): **shared Zod schema in `@org/dto` → `react-hook-form` + `zodResolver`
on the client + `nestjs-zod` `createZodDto` on the server**, so a client-valid form is server-valid by
construction (kills the schema-save-400 class of bug). Field-level inline errors throughout, not page-level.
Verified: **`@org/api` tsc 0 · lint 0 err · build ✓** · **`@org/app` typecheck 0 · lint 0 err (10 pre-existing
warnings, baseline) · build ✓**. NOT browser-verified.

- **New shared schemas (`libs/shared/dto/src/lib/`):** `intelligence/` (`extraction-schema`, `field-map`,
  `pipeline`) and `documents/` (`comment`, `share`, `signer`, `legal-ai`). Each exports the pure Zod schema +
  `z.infer` types with explicit field-level messages. Barrel updated. **Server re-wired to consume them:**
  `intelligence-admin.dto.ts` (relocated verbatim → byte-identical validation), `comments.dto.ts`
  (`createCommentSchema`), `legal-ai.dto.ts` (`generateDocumentSchema`) now `createZodDto(<shared>)`.
  Shares/signers servers left as-is (prisma `nativeEnum` / `.email()`-empty nuance); their client form
  schemas live in `@org/dto` and map to the existing wire payloads on submit.
- **Server-error mapping** (`apps/app/.../lib/server-errors.ts`): `applyServerFieldErrors(err, setError)` reads
  the `nestjs-zod` 400 `errors[]`/`issues[]` (with `path`) and `setError`s the matching RHF field — so a
  server rejection surfaces inline at the field, not just a toast. Wired into the admin save flows.
- **Cluster A — admin intelligence (the 400 source):** `SchemaManager` + `PipelineManager` rebuilt on
  `useForm`/`useFieldArray` (`SchemaEditor`/`FieldRow`, `PipelineEditor`/`StageCard`; per-stage config edited
  as a unit via `setValue` to preserve the rich conditional UI verbatim); `FieldMapEditor` on RHF
  (`mapping.${fieldKey}` paths). `zodResolver(...) as Resolver<Dto>` cast where Zod input≠output (`.default()` +
  recursive `z.lazy`) — runtime validation unaffected.
- **Cluster B — intelligence product:** `ReviewExtraction` now builds a **type-aware** Zod schema from the
  extraction's own fields (required / valid-JSON / numeric) → closes a real data-corruption bug (malformed
  JSON/number edits used to save silently as raw strings); inline per-field errors; mount keyed by
  `extraction.id` (AnalyzePage) so reprocess re-seeds; **fixed pre-existing `variant="default"` tsc error**
  (→ `primary`). `NewBatchPage` + `IntelligenceUpload` gained shared **file validation** (type + 25 MB cap,
  `lib/file-validation.ts`) with inline rejection messages (the `accept` attr can't enforce either) + batch-name
  length cap.
- **Cluster C — document dialogs:** `CommentsDialog` (body required/max 4000), `ShareDialog` (password 4–64
  validated client-side; mode/expiry via `Controller`), `SignaturesDialog` add-signer (**real email-format
  validation** — `type="email"` never enforced it), `DraftWithAIPage` (brief required/max 6000; preset fills via
  `setValue`) — all RHF + shared schema, inline field errors.
- **Dead dep noted:** `class-validator`/`class-transformer` are unused in `apps/api/src` (the global pipe is
  `ZodValidationPipe`) — left in place; safe to remove later.
- **i18n:** new validation strings use the `t('key','English default')` fallback pattern (per house rule);
  `en/translation.json` was **not** exhaustively updated with the new keys — defaults render correctly, but a
  translation pass is a follow-up.

### 2026-06-12 — Batch naming + multi-file add, UI-component sweep, doc-creation restructure, dashboard

- **Batch name + multi-shot file add** (`NewBatchPage.tsx`). Added an optional "Batch name" input — the plumbing already existed end-to-end (`createBatch(files,{name})`→`?name=`; backend defaults `Batch of N`), only the field was missing. Files now **accumulate** across multiple picks (dedupe by `name:size:lastModified`) with a removable selected-files list. **Bug fixed (regression):** the first version read `Array.from(picked)` lazily inside the `setFiles` updater *after* resetting `input.value=''` — but `FileList` is live and tied to the input, so the reset emptied it before the updater ran → zero files added. Fix: snapshot to a real array *before* the reset.
- **UI-component sweep** (standing rule: never raw native form elements — keep look-and-feel consistent). Replaced every native `<select>` with the `@org/ui` Radix `Select`: NewBatchPage (pipeline), PipelineManager (×6 — stage type, onUnmatched, engineMode, force-type, onFail, add-stage), SchemaManager (field type), ShareDialog (access, expiry), builder/BuilderForm (enum widget). Notes: Radix forbids empty-string item values, so the "use classified" option uses a `CLASSIFIED` sentinel mapped back to `undefined`, and BuilderForm's clear-to-empty is handled via `SelectValue` placeholder; the pipeline "+ Add stage…" action-select became a `DropdownMenu`. Also swapped the `DataTable` search box from a native `<input>` to `@org/ui` `Input`.
- **Document-creation restructure** (structured templates were buried at the bottom of `/documents/new`). New `TemplatesPage` (`/documents/templates`) surfaces the structured catalog + template picker as a **top-level** page; new `DraftWithAIPage` (`/documents/draft-ai`) is the AI-draft flow as a full page (presets pre-fill the brief, inline instead of a modal); `NewDocumentPicker` (`/documents/new`) slimmed to a 3-choice hub. Sidebar gained a collapsible **"Create"** group (New document / Draft with AI / Templates / My documents) — Documents moved off the root into it. Routes + i18n added.
- **Dashboard fix.** Quick-action cards: 4 now (Draft-with-AI target fixed to `/documents/draft-ai`, added a **Templates** card); added a **"Document Intelligence"** section (Analyze / Batches / Review queue link cards); **Recent** now sorted by `updatedAt` desc (was relying on endpoint order).
- `@org/app` build + lint green (0 errors; 10 pre-existing warnings). **NOT browser-verified.** Schema-save 400 from the prior entry still needs the **API restart** (DTO fix is in the tree, server is stale).

### 2026-06-11 — Doc-intelligence dashboard restructure: collapsible nav, split pages, DataTable lists

User asks this pass: (a) schema save 400, (b) clone, (c) proper admin tables, (d) "separate pages in a collapsible menu… make it a proper dashboard." Scope for (d) confirmed with the user before building. Tracked as tasks #1–#7.

- **(a) Schema-save 400 — diagnosed, no code change.** `PUT /admin/intelligence/schemas/:key` rejected `null` for `fieldThreshold/description/format`. The DTO was already fixed in the working tree (`.optional()`→`.nullish()` in `intelligence-admin.dto.ts`, uncommitted); the **running API was stale**. Fix = restart the API. NOT a seed issue.
- **(b) Clone — already existed, backend revert.** Both managers already have a client-side clone (`startClone`: pre-fills `key_copy`/`(copy)`, carries all fields/stages, opens create mode — better UX than a one-click backend clone since it forces a deliberate new key + doc-type rebind). I briefly added a redundant backend `cloneSchema/clonePipeline` endpoint+hooks, then **reverted all of it** rather than ship dead code. Blocked only by (a)'s restart like any save.
- **(c) Admin tables — already satisfied** by the #20–#23 `DataTable` work (search/sort/always-on pagination/expandable/toolbar). No change.
- **(d) Dashboard restructure (frontend, app build + lint 0-errors):**
  - **Collapsible sidebar** (`layouts/main-layout/MainLayout.tsx`): new `NavGroup` (localStorage-persisted open state + auto-expand whenever the active route is a child) wraps a "Document Intelligence" section = Batches / New batch / Review queue / Document types / Pipelines; Dashboard/Documents/Analyze stay flat above. `NavItem` gained an `end` prop; added Upload/Flow/Chevron icons.
  - **Batches split**: `/batches` is now list-only; new `/batches/new` route → `NewBatchPage` (the upload form, extracted). `BatchesPage` rebuilt as KPI tiles + a `DataTable` (search, sort, pagination, status-chip toolbar, expandable row → segmented progress bar + per-status counts) with a "New batch" CTA.
  - **Doc config split**: `IntelligenceConfigPage.tsx` now exports `DocTypesPage` + `PipelinesPage` sharing a `ConfigShell` (header + pill sub-nav between the two) — replaced the in-page `Tabs`. Routes `/admin/intelligence/{types,pipelines}` + `/admin/intelligence`→redirect to types.
  - **DocumentsList → DataTable**: card grid replaced by a `DataTable` (columns Title/Type/Status/Updated + a `⋯` actions cell preserving Open/Rename/Duplicate/Share/Version history/Delete and the Share/History/Rename dialogs); status + type filter chips moved into the toolbar; free-text search/sort/pagination handled by the table.
  - i18n: new `nav.*` keys (docIntel/newBatch/docTypes/pipelines) added to `en/translation.json` (valid JSON).
- `@org/app` build + `@org/api` build green; `nx lint @org/app` 0 errors (10 pre-existing warnings). **NOT browser-verified — needs an eyeball + the API restart for (a).**

### 2026-06-11 — Admin schema/pipeline lists rebuilt on a shared DataTable (#20–#23)

The admin Schemas and Pipelines tabs were ad-hoc row lists (manual `.map`, no search/sort/paging, inline icon-button rows from the earlier pass). Both now render through one reusable component.
- New `@org/ui` `DataTable<T>` (`libs/shared/ui/src/components/data-table.tsx`, exported from `components/index.ts`): dependency-free, generic, client-side over the rows it's given (admin lists are small). Features: typed `DataTableColumn<T>[]` (`key`/`header`/`cell`/optional `sortValue`/`align`/`width`/`className`), an optional search box (`search(row)=>string`), sortable headers (click to toggle asc/desc, chevron indicator, `initialSort`), always-on pagination (`pageSize` default 10, Prev/Next + "x–y of n"), optional expandable rows (`renderExpanded(row)` adds a chevron column), and a `toolbar` slot for filter chips. House style (`rounded-xl border`, `bg-secondary/40` header, `divide-border/60`). Local `PagerButton`/`Chevron` helpers; no icon lib.
- `SchemaManager` + `PipelineManager` now build a `columns` array and render `<DataTable>` with `initialSort={{key:'name',dir:'asc'}}`, a `toolbar` (the existing "show disabled" toggle / filters), and `renderExpanded` → `ExpandedSchema`/`ExpandedPipeline` (detail loaded lazily per expanded row). Replaces the hand-rolled row markup + the inline icon-button group from the prior revision; row actions (Edit/Mapping/Enable-Disable/Delete) move into the table cells.
- `@org/app` build green; `nx lint @org/app` 0 errors (10 pre-existing warnings, none in the managers or DataTable); `nx lint @org/ui` 0 errors (5 pre-existing). **NOT browser-verified — needs an eyeball on the admin tabs.**

### 2026-06-09 — Full product slice: batches + review queue + approve→finish + UI (docs/07 P4.3–P4.4)

Wired the pipeline engine into a usable product: batch ingest, a review queue, approve-to-finalize, and the UI for all of it. Additive (legacy IntelligenceJob flow untouched). Verified: API `tsc` 0 · app `nx typecheck` 0 · eslint 0 on changed files · **`@org/api` + `@org/app` both build** · migration `pipeline_batches` applied + client regenerated · en JSON valid. **Not runtime-verified.**

- **Batch ingest (P4.3).** New `Batch` model (+ `BatchStatus`/`BatchSource` enums) + `PipelineRun.batchId` (migration `pipeline_batches`). `BatchService.createMultiFileBatch`: upload N files → N `SourceDocument`s → N `PipelineRun`s on one pipeline → `executor.startRun` each (fan-out seam; multi-file now, zip/S3/API later behind the same seam). List/detail with **live status counts derived from runs**. `startRun` gained `{batchId, pipelineId}` opts; `ensureDefaultPipeline` made public so a batch resolves the pipeline once.
- **Review queue + approve→finish (P4.4).** `PipelineExecutorService.reviewQueue(userId)` lists runs `needs_review` with filename + latest-extraction id/confidence. `approveRun(userId, runId)` **resumes** a parked run: marks it approved, then runs the post-park stages (export) using the human-corrected `Extraction` — reusing the convert bridge to produce the editable Document. Endpoints: `POST /intelligence/batches` (FilesInterceptor, 1000 cap), `GET /intelligence/batches[/:id]`, `GET /intelligence/review-queue`, `POST /intelligence/pipeline-runs/:id/approve`, plus the earlier `run-pipeline`/`pipeline-runs/:id`.
- **Frontend.** api-client: `createBatch`/`listBatches`/`getBatch`/`runPipeline`/`getPipelineRun`/`getReviewQueue`/`approveRun` + types. Hooks: `useCreateBatch`/`useBatches`(poll)/`useBatch`(poll while running)/`useReviewQueue`/`useApproveRun`. Pages: `BatchesPage` (multi-file create + batch list w/ progress), `BatchDetailPage` (runs table + status + open-review links), `ReviewQueuePage` (flagged runs → Review link + Approve&finish). Routes `/batches`, `/batches/:id`, `/review-queue`; nav items (Batches/Review queue + icons). `AnalyzePage` fixed to open directly by `sourceId` (no job param) so batch/queue links land on the review UI. Full `intelligence.batches`/`intelligence.queue` + `nav.*` i18n.
- **Product flow now end-to-end (code-complete):** upload one **or a batch** → classify → tiered extract → validate (auto-advance ≥ configured score, else park) → **review queue** → correct + **approve → export → editable Document**. Analysis + RAG available per document.
- **NOT yet:** org-scoped DB-authored pipelines/schemas + authoring UI (P4.2); zip/S3/API batch sources; per-stage BullMQ queueing + StageExecution reconciler; bulk-approve (currently per-run); subsuming IntelligenceJob. And **nothing is runtime-verified** — needs the app+API running + OPENAI_API_KEY.

### 2026-06-09 — Pipeline engine P4.1 (docs/07): data-driven executor, additive

First slice of the configurable pipeline engine (docs/07 §9 P4.1). **Additive** — the legacy single-doc `IntelligenceJob` flow is untouched; this adds a parallel, data-driven path. Verified: API `tsc` 0 · eslint 0 · `@org/api` builds · migration `pipeline_engine_core` applied + client regenerated. **Not runtime-verified.**

- **Models + migration:** `Pipeline`, `PipelineStage`, `PipelineRun`, `StageExecution` + enums `PipelineStageType{ingest,classify,extract,validate,review,export}`, `PipelineRunStatus`. `ownerOrgId` is an indexed scalar (no FK churn); `PipelineRun → SourceDocument` relation (`pipelineRuns` back-relation). Stage `config` is jsonb (autoAdvance/engineMode/schemaKey/targets). `StageExecution` carries score/output/heartbeat (reconciler-shaped).
- **`PipelineExecutorService`** walks a run's stages in order, dispatching by `stage.type` to the SAME engines via thin new **public wrappers on `PipelineService`** (`buildSourceInput`/`parseSource`/`classifyDoc`/`extractOne`) — one source of truth, no duplication. Stages: `ingest` (parse, text-first), `classify` (over text), `extract` (tiered → writes an `Extraction` row so the existing review/convert UIs reuse it), `validate` (`decideReview` with the stage's `autoAdvance` thresholds → parks the run as `needs_review` on low score, else advances), `export` (reuses the convert bridge → editable Document). Each stage records a `StageExecution`; the run parks at the first failing gate. Runs inline (fire-and-forget) for P4.1.
- **Default pipeline** seeded on demand (`ensureDefaultPipeline`, idempotent like `ensureFreeformType`): ingest→classify→extract→validate(min overall 0.9 / field 0.85, onFail=review)→export. System-owned (`ownerOrgId=null`) template.
- **Endpoints (additive):** `POST /intelligence/sources/:id/run-pipeline?pipeline=` (start a run), `GET /intelligence/pipeline-runs/:id` (poll per-stage status).
- **NOT yet (next docs/07 phases):** org-scoped DB-authored pipelines/schemas (P4.2), batch/multi-file fan-out (P4.3), review-queue + bulk approve + resume-after-approve (P4.4), CSV/JSON/webhook export targets (P4.5), per-stage queueing + a StageExecution reconciler, and migrating the default upload onto the engine (subsume IntelligenceJob, docs/07 §8). Frontend for pipelines/batches not started.

### 2026-06-09 — Fix: pipeline is now text-first (parse before AI) — fixes "OpenAI cannot read PDFs"

- **Bug (user-reported):** uploading a PDF failed with *"OpenAI chat cannot read PDFs directly."* Root cause: `PipelineService.run()` called the **classifier on the raw PDF bytes via OpenAI vision BEFORE parsing** — so even a text-layer PDF threw at the classify step (OpenAI's chat API can't ingest PDFs, only images), and the OpenAI-only `.env` had no Claude fallback.
- **Fix:** `run()` now **parses to text first** (ParsingService — prefer the extraction libraries over AI), persists `normalizedText`, then **classifies over the parsed text** (`{document}`) and passes the parsed doc into `extractTiered` (no re-parse) so `auto`/`native` extract over text. AI vision over raw bytes is used **only when there is no text layer** (genuinely scanned). Removed the duplicate parse that was inside `extractTiered`.
- **Clear error for the real edge case:** new `assertVisionCanRead()` — a scanned **PDF** with no PDF-capable vision provider (i.e. OpenAI-only, no `ANTHROPIC_API_KEY`, no agentic) now fails with an actionable message ("add ANTHROPIC_API_KEY / configure agentic / upload pages as images") instead of the raw provider error. Images (PNG/JPEG) still go straight to OpenAI vision.
- Net: text-layer PDFs/DOCX/text now extract via the cheap library→OpenAI-text path with no vision call at all; vision is the fallback, not the default. Verified: API `tsc` 0, eslint 0, `@org/api` builds. (Runtime confirmation still needs a real upload + key.)

### 2026-06-09 — Document Intelligence Phase 1 critic + Phase 2 (analysis, citations, RAG) — docs/05 Phases 0–3 now code-complete

Completed the buildable remainder of docs/05 §7. Verified: lib `tsc` 0 · API `tsc` 0 · app `nx typecheck` 0 · eslint 0 on changed files · `nx lint @org/doc-intelligence` 0 · **`@org/api` + `@org/app` both build** · 2 migrations applied + client regenerated · en JSON valid. **Not runtime-verified** (needs app+API+OPENAI_API_KEY; analysis/RAG/critic all make live AI calls).

- **Phase 1 — agentic critic re-verification pass (docs/05 §3).** Lib `critic.ts`: `lowConfidenceFields` (below-threshold or required-missing), `subSchema`, `mergeCritic` (per-field higher-confidence wins, recomputes overall) + `buildCriticPrompt`. `VlmExtractionEngine` refactored to a shared `runOnce` + a `critique()` method that re-extracts ONLY the unsure fields and merges. Pipeline `extractWithCritic` wraps native+vlm extraction (on by default; `EXTRACTION_CRITIC_ENABLED=false` to disable; threshold = `DEFAULT_ROUTING.fieldThreshold` 0.85). Agentic tier skips the critic (already high-fidelity).
- **Phase 2 — Analysis + cited-law health.** New `AnalysisRun` model (+migration `di_phase2_analysis_rag`). Lib `analysis.ts`: `buildAnalysisSchema`/`buildAnalysisPrompt` → structured `{summary, parties[], keyDates[], obligations[], riskFlags[]}` (model forbidden from asserting citations). `AnalysisService.analyze` runs it over normalized text (or vision bytes for scanned), then **deterministically** verifies cited law via `@org/legal-reference.validateCitations` (flags repealed IPC/CrPC/Evidence Act + suggested successor). Endpoints `POST /intelligence/sources/:id/analyze`, `GET …/analysis`.
- **Phase 2 — RAG "ask this document" with page citations.** New `SourceChunk` model (page, ordinal, text, `Float[]` embedding). Lib `rag.ts`: `chunkPages` (per-page ~1200-char chunks), `cosineSimilarity`, `topKChunks`, `buildAskPrompt` (grounded, cites `(p. N)`). `AnalysisService.ask` chunks+embeds once via `AiService.embed` (OpenAI `text-embedding-3-small`, persisted), then per question embeds → in-process cosine top-k (single-doc, no pgvector) → `AiService.generate` grounded answer → returns `{answer, citations:[{page,snippet,score}]}`. Endpoint `POST /intelligence/sources/:id/ask`. Normalized text is cached on `SourceDocument.normalizedText` on first use.
- **Frontend.** api-client `analyze`/`getAnalysis`/`ask` + types; hooks `useAnalysis`/`useRunAnalysis`/`useAsk`; `DocumentInsights.tsx` (analysis panel — summary/parties/dates/obligations/risk-flag badges/cited-law health + an ask box with page-cited answers) mounted on `AnalyzePage` under the review. Full `intelligence.insights`/`intelligence.ask` i18n in en.
- **docs/05 §7 status now:** Phase 0 ✅ (engine spike done; **OCR-accuracy benchmark # still un-run** — needs real Hindi scans + key), Phase 1 ✅ (incl. critic; **eval harness still un-run on a gold set** — no fixtures), Phase 2 ✅, Phase 3 ✅. Phase 4 = `docs/07` design. The two outstanding items are **data/runtime deliverables, not code** — the harness/engine are built and runnable.

### 2026-06-09 — Configurable pipeline-engine design doc (docs/07, docs only)

User asked whether the system supports **custom, configurable pipelines** (batch of ~1000 docs → classify → parse-per-type → extract → check/approve with a configurable auto-advance score → export), customizable per user. Verified current state: **no** — `PipelineService` is a fixed single-doc linear method, `decideReview` uses a hardcoded `DEFAULT_ROUTING`, `ExtractionSchema`s are registered in code (not DB/per-org), no Batch/queue/workflow models. This is exactly the **process-as-data engine docs/05 §1 deferred to Phase 4**.

- Wrote **`docs/07-pipeline-engine.md`** — full design (no code). Per-**organisation** (locked decision), process-as-data: `Pipeline → typed Stages → PipelineRun per doc → Batch`. Stage types (ingest/classify/extract/validate/review/export/webhook) each with a `config` jsonb incl. the **auto-advance condition** (`minOverallConfidence`/`minFieldConfidence`/`requireAllRequired`/`onFail`) — the configurable "score to auto-move." Org-scoped + versioned `ExtractionSchema`/`SchemaField`/`FieldMap` (no-code authoring, moved out of the in-code registry). Prisma sketch (Pipeline/PipelineStage/Batch/PipelineRun/StageExecution/ReviewTask/ExtractionSchema/SchemaField). Shows the executor as a `switch(stage.type)` **reusing every existing engine** (ClassifierEngine/ParsingService/Vlm+Agentic engines/decideReview-with-per-stage-policy/convert bridge) — not a rewrite. Batch ingest via a common fan-out seam: **multi-file upload BUILD FIRST** (user decision), zip/S3-prefix/API push **deferred**. Review queue + bulk approve; export targets (convert/CSV/JSON/webhook). Multi-tenant seeding from in-code defaults; whole-pipeline immutable versioning. Batch **cost guardrail** (premium_extraction × N → estimate+confirm + quota stop). Phasing P4.1–P4.6; open decisions; separation contract reaffirmed (export uses public create path).
- Cross-linked from docs/05 §7 Phase 4. Docs only; no code changed. Next: P4.1 (engine core) when the user is ready to build.

### 2026-06-09 — Document Intelligence Phase 3 convert bridge + Analyze nav entry

Closed the loop: a reviewed extraction can now become an **editable Document** (docs/05 §11, the one sanctioned write-bridge). Verified: API `tsc` 0 · app `nx typecheck` 0 · eslint 0 on changed files · **`nx build @org/api` + `@org/app` both succeed** · en translation.json valid. NOT runtime-verified (needs app+API running + a real extraction).

- **Convert bridge (backend)** — `POST /intelligence/extractions/:id/convert` → `IntelligenceService.convert()`. Two targets per §11.3:
  - **structured prefill** — when the extraction has a known `documentTypeKey` AND a registered field-map: coerce single-column `table` fields (`[{text}]→string[]` for RTI questions / notice facts), `applyFieldMap()` onto the bundle's nested Zod paths, look up the type's first active template key, and create via the **public `DocumentsService.create`** (same path as normal drafting + `POST /documents`). Opens prefilled in the structured builder (`/documents/:id/edit`).
  - **freeform fallback** — otherwise: build clean escaped HTML (`<h1>` + `Label: value` paragraphs / `<ul>` for arrays) → create a `freeform` Document (`data:{html,values,templateId}`) → opens in the draft editor (`/documents/:id/draft`).
  - Separation contract holds (§10/§11.5): convert uses the public create path, never edits Document/DocumentVersion/editor. `IntelligenceModule` now imports `DocumentsModule` to inject `DocumentsService`.
- **Convert bridge (frontend)** — api-client `convert()` + `ConvertResult` type; `useConvert()` hook; `ReviewExtraction` gained a **"Create editable document"** button that first saves the corrected values (so the doc is built from them), then converts and navigates to the correct editor by `mode`. "Save review" is now the secondary (outline) action.
- **Analyze reachable** — added an "Analyze" `NavItem` (+ `ScanIcon`) to `MainLayout` between Documents and Quick editor; `nav.analyze` i18n key. The feature was route-only before.
- **NOT done (next):** browser runtime check of upload→review→convert→builder; verifying the prefilled structured builder renders the mapped data correctly (field-map path accuracy is only type-checked, not runtime-proven against the live bundles); confidence/provenance surfaced inside the builder (§11.6, optional/deferred); agentic critic pass; Phase 2 (citations + RAG).

### 2026-06-09 — Document Intelligence Phase 1 frontend: upload → poll → review UI + RTI/legal-notice packs

Built the user-facing slice of Phase 1 (docs/05 §7). Verified: app `nx typecheck` 0 · **`nx build @org/app` success** · eslint 0 on all changed files · `nx lint @org/doc-intelligence` 0 · lib standalone `tsc` 0 · en translation.json valid. NOT runtime-verified in a browser (no live API+key this session) — folded into manual verification.

- **api-client `intelligence.service.ts`** (`libs/shared/api-client`): `createIntelligenceService(http)` with `upload` (multipart FormData + `?engine=`), `getJob`, `getExtraction`, `saveReview` + response/payload types (EngineMode, IntelligenceJob, ExtractionDetail w/ confidence map + ReviewDecision + schema). Exported from the barrel. Wired into `main.tsx` (`createIntelligenceService`) + `ServicesProvider` + a new `useIntelligenceService()` hook in `features/documents/services-context.tsx`.
- **`features/intelligence/`** (new): `queries.ts` (React Query — `useUploadDocument`, `useIntelligenceJob` with **status-driven `refetchInterval` polling** that stops on terminal state, `useExtraction`, `useSaveReview` with cache invalidation + toasts); `IntelligenceUpload.tsx` (file picker + engine-tier `<Select>` auto/native/vlm/agentic → upload → navigate to `/analyze/:sourceId?job=`); `AnalyzePage.tsx` (polls the job, shows current **stage**, handles failed/empty, then renders review); `ReviewExtraction.tsx` (the **HITL review UI** — every field with a calibrated **confidence badge** high/med/low + page provenance, low-confidence/required-missing fields flagged with a banner, inline editable values incl. JSON for complex/table fields, Save → records the edit audit trail server-side). Routes `/analyze` + `/analyze/:sourceId` added in `app.tsx` (inside the authed MainLayout). All strings `t('intelligence.*','English default')`; added the full `intelligence` namespace to `en/translation.json`.
- **Two more ExtractionSchema packs** (`libs/doc-intelligence/src/schemas/rti.ts` + `legal-notice.ts`) — completes the **first three packs** (rent/rti/legal-notice + generic, §11.4). Each mirrors its live `DocumentTypeBundle` fields (incl. `table`-typed `questions`/`facts` line-items) with a FieldMap onto the bundle's nested Zod paths (e.g. `applicant_name → applicant.name`, `cheque_number → cheque.number`). Registered eagerly in the lib index.
- **NOT done (next):** browser runtime check of the flow (needs the app + API running + `OPENAI_API_KEY`); click-to-highlight bbox provenance (extraction emits page-level only — bbox is a future engine enhancement); no-code ExtractionSchema authoring UI (admin); the agentic critic re-verification pass; a way to navigate to `/analyze` from the main nav (route works directly; nav-link not added). Phase 2 = citations + RAG; Phase 3 = convert bridge (the field-maps authored here feed it).

### 2026-06-09 — Document Intelligence: tiered extraction (free native parsers + premium agentic) + OpenAI default

Built the user-requested extraction layering on top of Phase 0: **tool-based native parsing (DOCX/PDF/text) as the free first level**, a **configurable paid/agentic provider for premium**, **OpenAI as the default AI provider**, and **multiple document-parsing libraries** with fallback. Verified: API `tsc` 0 · `nx build @org/api` success (all parsing libs bundle under webpack node target) · eslint 0 on changed files · `nx lint @org/doc-intelligence` 0 · runtime import smoke-test of mammoth/unpdf/pdf-parse OK · two migrations applied to dev DB + client regenerated + re-seed OK.

- **OpenAI is now the default provider.** `AiService` priority is config-driven via `AI_DEFAULT_PROVIDER` (default `openai`; the chosen provider goes first, others fallback). Implemented `extract()` (OpenAI **JSON-schema structured output**, forced), `supportsVision()` (base64 `image_url` — images only; **PDFs throw → handled by the parse-to-text path / provider fallback**), `supportsEmbedding()` + real `embed()` (`text-embedding-3-small`) on `OpenAiProvider`. `generate`/`stream` untouched. LangChain v1 message-union typing handled (cast content to `HumanMessageFields['content']`, read usage off `AIMessage`).
- **Multiple parsing libraries (free native tier).** Added deps `mammoth` (DOCX), `unpdf` + `pdf-parse` (two independent PDF text extractors). `apps/api/src/app/intelligence/parsers/`: `DocxParser`, `UnpdfParser` (primary PDF), `PdfParseParser` (fallback PDF), `PlainTextParser`. `ParsingService` runs them through an `EngineRegistry<IParser>` with **observable fallback**: for PDFs it tries unpdf, and if the text is too thin (`< 24` chars → tricky/scanned layer) falls through to pdf-parse before declaring "no text layer". Returns `null` when nothing yields usable text (→ escalate to vision/agentic).
- **Vendor-agnostic agentic engine (premium, configurable).** `engines/agentic-extraction.engine.ts` implements `IExtractionEngine`, fully env-driven (`EXTRACTION_AGENTIC_BASE_URL`/`_API_KEY`/`_MODEL`/`_RESPONSE_PATH`/`_PROVIDER`) — point it at LlamaParse / Reducto / a self-hosted service with **no code change**. Flow: POST bytes → high-fidelity text (response-path or auto-detected field) → delegate to the structured extractor over that text. `isConfigured()` gates availability; the vendor HTTP contract is isolated to one method (`callAgenticParser`) for easy adaptation to async/multipart vendors. Uses `axios` (existing dep).
- **Tiered selection + premium gating.** New `Feature.premium_extraction` + `ExtractionEngineMode {auto,native,vlm,agentic}` enums + `engineMode`/`engineUsed` columns on `IntelligenceJob` (migration `20260609093350_di_premium_extraction_engine_mode`, applied). `PipelineService.extractTiered`: `auto` parses-to-text first (free, default OpenAI over text) and **escalates** to agentic (if entitled + configured) else vlm when there's no text layer; `native`/`vlm`/`agentic` force a tier. Entitlement = per-user `checkQuota(premium_extraction)`. The paid tier is **gated up front at upload** (`IntelligenceService.createSourceAndStart` 403s if `engine=agentic` without entitlement; org-owned uploads can't force agentic — no per-user wallet) and re-checked defensively in the pipeline. Metering: every run consumes one `ai_attempts`; an agentic run additionally consumes one `premium_extraction`. `engine` threaded through upload (`?engine=`) + register DTOs; persisted as `engineMode`; actual engine recorded in `engineUsed` + telemetry.
- **Seed:** `premium_extraction` quota per plan via an idempotent `planFeature.upsert` loop (lands on every re-seed despite paid plans being `update:{}`-immutable): free=**0**, starter=20, pro-monthly/pro-yearly/agency=unlimited(-1). New wallets get the matching usage row automatically; **existing wallets only gain it on wallet (re)create** — `checkQuota` returns false without the row, the correct safe default for free users. **Re-seed run.**
- **Config:** `config/schema.ts` (Zod) + `.env.example` gained `AI_DEFAULT_PROVIDER`, `AI_MODEL_WHITELIST`, `OPENAI_VISION_MODEL`/`OPENAI_EMBED_MODEL`, `ANTHROPIC_VISION_MODEL`, and the `EXTRACTION_AGENTIC_*` group (+ an OPTIONAL_GROUPS warning entry).
- **NOT runtime-verified:** a real document parse/extract end-to-end (parsing needs a sample file; extraction additionally needs `OPENAI_API_KEY`) and a live agentic-vendor call (needs `EXTRACTION_AGENTIC_*` configured). Imports/build/types are green; correctness of OCR-less scanned handling still depends on a vision provider key (Claude reads PDFs; OpenAI reads images only).
> Mirrors the harness task list but survives across sessions. Update the **Current state** and
> **Next step** blocks every time you stop. Phase order: **editor first, then flows.**

## 🚧 In progress / next (update this when you start/finish a slice)

- **IN PROGRESS:** Comments on documents + shares (collaboration) — backend comments module + public-via-token + owner/guest UI.
- **NEXT (queued, in order):** drawn/typed signatures → eSign (Digio) + Schedule-1 gate → org multi-tenancy + marketplace → Hindi UI i18n.
- Done so far (see journal): editor, multilingual, paper sizes, PDF/Word export, court docs + presets, sharing, version history, standards docs + `@org/legal-reference`.

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
- [x] **T6 · Backend: `/legal-ai/generate` + `/legal-ai/revise`.** **DONE 2026-06-07** — both endpoints produce editor-ready HTML with `{{placeholders}}`, grounded by doc type when known (`getBundle`). Guardrails: disclaimer returned separately, no model-authored statute citations (`{{applicable_law}}` placeholder), no judicial impersonation; quota metering + 24h cache reused. DTOs + controller + api-client (`generate`/`revise`) added. _(Structured-output-vs-Zod for the form builder is a noted future enhancement — the editor flow is HTML-based.)_
- [x] **T7 · Persist freeform editor to `Document` model.** **DONE 2026-06-07** — backend auto-provisions a `freeform` DocumentType+template (also added to seed). `TemplateEditor` gained a `persistence` prop: `local` (localStorage, unchanged `/editor`) vs `bound` (backend doc). New route `/documents/:id/draft` (`DraftEditorPage`) loads `data.{html,values,templateId}` and debounce-autosaves via PATCH. `/editor` got "Save to my documents" → creates a freeform doc → navigates to the bound editor.
- [x] **T8 · Real PDF/Word export for freeform docs.** **DONE 2026-06-07** — added a `freeform` template component (`libs/document-templates`) that renders editor HTML (placeholders filled, page-break split, page-size aware) and registered it under `componentKey: 'freeform'`, so the **existing Puppeteer PDF pipeline works for freeform docs unchanged**. Added Word (`.doc`) export: dependency-free, Word/LibreOffice-openable, rendered inline (CPU-only) via `DocxRendererService`; `format: 'doc'` added to the export DTO + api-client; freeform-only for now. _(True OOXML `.docx` via a converter is a future swap of `buildWordHtml`.)_
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

### 2026-06-08 — Document version history (snapshot / list / restore)

- **Backend:** `documents.service` gained `listVersions` + `restoreVersion` (restore first snapshots current state, so it's reversible); controller `GET /:id/versions` + `POST /:id/versions/:versionId/restore`. (`snapshot` already existed.)
- **api-client:** `listVersions` / `restoreVersion` + `DocumentVersionSummary`.
- **Frontend:** `useDocumentVersions` / `useSnapshotDocument` / `useRestoreVersion`; `VersionHistoryDialog` (list newest-first, "Save current as version", per-row Restore). Wired a **History** button into `BuilderShell` and the freeform editor (`TemplateEditor.onHistory` via `DraftEditorPage`).
- Verified: api `tsc` 0, `app:typecheck` green, eslint clean, `app:build` ✓.

### 2026-06-08 — Sharing (Phase D): share links + public view + long-tail presets

- **Long-tail presets** added to `@org/legal-reference` `DOCUMENT_PRESETS`: writ petition, NDA, MoU, partnership deed, offer letter, gift deed, will, power of attorney (new categories `Agreements`/`Personal`). Will/PoA/gift-deed carry the IT-Act Schedule-1 "not Aadhaar-eSign-eligible" note. Backend `court-scaffolds.ts` gained a shared `AGREEMENT` scaffold + will/gpa/writ scaffolds. Picker now groups presets by category.
- **Sharing UI (backend was already complete):**
  - api-client `createSharesService` (`create`, `resolve`, `isSharedDocument`) + index export; wired into `services-context` (`useSharesService`) + `main.tsx`.
  - `useCreateShare` mutation; `ShareDialog` (access mode view/comment/edit, optional password, expiry 0/7/30d → URL + copy).
  - Enabled **Share** in `BuilderShell` (was a disabled stub) and added a Share action to the freeform editor (`TemplateEditor.onShare`, wired in `DraftEditorPage`).
  - **Public route `/s/:token`** (`SharedDocumentView`, outside ProtectedRoute): resolves the share, handles password prompt, renders freeform docs read-only via `PaginatedPreview` (zoom/paper), graceful fallback for structured types. Links point at `${origin}/s/<token>`.
- Verified: api `tsc` 0, `app:typecheck` green, eslint clean, `app:build` (vite) ✓.
- **Still pending (phases):** comments on shares (model exists; not surfaced), eSign (Digio) + Schedule-1 gating, org multi-tenancy + marketplace, Hindi UI i18n, structured React court templates.

### 2026-06-08 — Court & legal documents (AI-drafted, end-to-end)

- **Presets catalog** `DOCUMENT_PRESETS` in `@org/legal-reference` (frontend-safe): cheque-bounce notice §138, general notice, consumer complaint (CPA 2019), regular + anticipatory bail (BNSS), plaint, written statement, vakalatnama, affidavit, RTI — each with name/category/description/editable `sampleBrief`/citation topics.
- **Backend scaffolds** `apps/api/.../legal-ai/court-scaffolds.ts`: per-preset structural prompt (cause title, memo of parties, numbered facts/grounds, prayer, verification, advocate block / notice / affidavit / vakalatnama). `GenerateDocumentDto` + api-client gained `presetKey`; `generateDocument` appends the scaffold (and the criminal-code guardrail) to the system prompt. Bail/criminal presets explicitly steer to **BNSS, not the repealed CrPC**.
- **Frontend:** New-document picker now has a "Court & legal documents" section; a preset opens the AI modal seeded with its brief + `presetKey`, generates a freeform doc, and opens `/documents/:id/draft` — where it can be edited, translated to any language, paper-sized, and exported (PDF backend / Word frontend).
- **Why presets-into-freeform, not structured templates:** court docs are prose-heavy and don't fit rigid forms; AI-draft + structural scaffold + the citation guardrail is the architecture-fitting, scalable path. Structured React court templates remain a future option.
- Verified: api `tsc` 0, legal-reference `tsc` 0, `app:typecheck` green, eslint clean, `app:build` (vite) succeeds.

### 2026-06-08 — Maintainability docs + @org/legal-reference commons lib

- **Standards docs:** added root `CONTRIBUTING.md` (repo map, setup, the golden rules, verify-before-claiming) and `docs/CODING_STANDARDS.md` (TS/React/NestJS conventions, module boundaries, i18n/translations, error handling, the per-app `tsconfig.json` rule, recipes, AI-agent guidance). `CLAUDE.md` now points at both (appended after the nx-managed markers).
- **New commons lib `@org/legal-reference`** (`libs/shared/legal-reference`, tag scope:shared/type:util; path added to `tsconfig.base.json`): `jurisdictions` (Indian states/UTs + `IN-*`) and the **citation library** — `Citation` type, `CRIMINAL_CODE_REFORMS` (IPC→BNS / CrPC→BNSS / Evidence→BSA, effective 2024-07-01, authoritative), curated stable citations (NI §138, CPA 2019, Registration Act §17, IT Act §3A, RTI 2005) and a few criminal remaps (confidence-flagged + "verify against bare act"). Created manually mirroring the transliteration lib (nx-generate skill not available in this harness).
- **Guardrail wired:** `CRIMINAL_CODE_REFORM_NOTE` appended to legal-ai generate + revise system prompts, so the AI won't silently reproduce repealed IPC/CrPC/Evidence sections.
- Verified: api `tsc` exit 0, legal-reference lib `tsc` exit 0, eslint clean on the new lib + legal-ai.
- **NOT done (remaining phases — see roadmap):** court-doc `_internals` scaffolding + types (plaint/WS/bail/vakalatnama), share links + comments, eSign (Digio) with Schedule-1 gating, org multi-tenancy + marketplace, long-tail doc types, Hindi UI i18n. These need either live integrations or large vertical slices; tackle one at a time.

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
- **Known follow-ups (not blocking):** structured-output-vs-Zod generation for the form builder; true OOXML `.docx`; accept/reject _diff_ UI for AI revise (today it replaces + relies on undo); court-doc types + citation library (BNS/BNSS/BSA) per `docs/02-product-roadmap.md` Phase C.

### 2026-06-07 — T5 (Claude provider) + T4 (editor polish)

- **T5 done:** `@anthropic-ai/sdk@0.102.0` installed; `ClaudeProvider` (official SDK, Opus-4.8-safe) registered first in the AI fallback chain; config + `.env.example` updated. `apps/api` tsc exit 0.
- **T4 done:** localStorage autosave/restore + saved indicator added to `TemplateEditor`; page-break divider/shortcuts already present. `app:typecheck` green.
- **Files touched:** `package.json`/`pnpm-lock.yaml` (anthropic sdk), `apps/api/src/app/ai/providers/claude.provider.ts` (new), `ai.service.ts`, `ai.module.ts`, `config/schema.ts`, `.env.example`, `apps/app/src/app/features/editor/TemplateEditor.tsx`.
- **Phase 1 (editor) is complete (T1–T4).** Next is the rest of Phase 2 flows.
- **Next step for whoever resumes:** **T6** — `/legal-ai/generate` + `/legal-ai/revise` (read `legal-ai.service.ts`/`legal-ai.controller.ts`/`legal-ai.dto.ts` + `document-schema` prompts; use Claude structured outputs vs the Zod schema; guardrails + metering). Then **T7** (persist freeform editor to `Document`) and **T9** (wire "Draft with AI" into the editor). To runtime-verify T5: set `ANTHROPIC_API_KEY`, `pnpm dev:api`, hit an `/ai` or `/legal-ai` endpoint.

### 2026-06-08 — Fix: AI over-inserting page breaks on short documents

- **Symptom:** the generate/revise prompts told the model to insert `<div data-page-break></div>` "between major sections that should begin on a new page" — read as "every section," so short docs (a one-page notice, affidavit, etc.) got spurious page breaks and rendered as several near-empty pages.
- **Fix (`apps/api/.../legal-ai/legal-ai.service.ts`):** rewrote the page-break rule in both `GENERATE_SYSTEM` and `REVISE_SYSTEM` to gate breaks on length — only insert when the document genuinely spans multiple printed pages (~500+ words/page), never on short docs or between every section. No code path / API change; prompt-only.
- Verified: api `tsc -p apps/api/tsconfig.app.json --noEmit` exit 0, eslint clean on the changed file.

### 2026-06-08 — Phase D: multi-signer drawn/typed signatures (capture, end-to-end)

- **Backend `signers/` module** (`apps/api/.../signers/*`, mirrors `comments/`): `GET/POST /documents/:id/signers`, `PATCH/DELETE /documents/:id/signers/:signerId`, and `POST :signerId/sign`. `sign` records a drawn PNG data-URL (`method: 'draw'`) or typed name (`method: 'typed'`, `font`) into `DocumentSigner.evidence` along with server-stamped `signedAt`, IP and user-agent; sets `status='signed'`, `provider`. When the last signer signs, the document flips to `status='signed'`. Same owner/org access guard as comments. Registered in `app.module.ts`.
- **DTOs** (`signers.dto.ts`, zod + `createZodDto`): `AddSignerDto`, `UpdateSignerDto`, `RecordSignatureDto` (refine: draw⇒image, typed⇒typedText; image capped at 2 MB).
- **api-client:** `DocumentSigner`/`SignerRole`/`SignerStatus` types + `AddSigner`/`UpdateSigner`/`RecordSignature` payloads; `listSigners`/`addSigner`/`updateSigner`/`removeSigner`/`signSigner` on `documents.service`.
- **Frontend:** `SignaturesDialog.tsx` — signer list with status badges, add-signer form (name/role/email), per-signer **canvas signature pad** (pointer-events draw → `toDataURL`) and **typed** mode (cursive preview), captured signature shown back. Query hooks in `queries.ts`. Mounted in `BuilderShell` (Signatures button) and the freeform editor (`DraftEditorPage` → `TemplateEditor` new `onSignatures` prop + button).
- **Pre-existing bug found & fixed (correctness):** TipTap types `editor.storage` as the bare `Storage` interface; with no module-local declaration it resolved to the **DOM `Storage`** (localStorage), so `editor.storage.transliteration` only type-checked by luck of program composition — adding _any_ new app code (this feature) tipped resolution and surfaced 7 `TS2339` errors across `TemplateEditor` + the rich-text-editor lib. Fixed at the source: `declare module '@tiptap/core' { interface Storage { transliteration: TransliterationState; [key: string]: unknown } }` in `transliteration-extension.ts`. App + lib now type-check green with the new code.
- Verified: api `tsc` exit 0, **app `tsc -p apps/app/tsconfig.app.json` exit 0** (was failing pre-fix), eslint clean on all changed files. Runtime needs Postgres (DocumentSigner table) — not run here.
- **Not done (follow-ups):** placing the captured signature image onto the exported PDF/artboard; drag-to-reorder signing order; remote/guest signing — that's the eSign (Digio) + Schedule-1 gate task.

### 2026-06-08 — Hindi UI i18n: app shell + dashboard slice

- **Scope chosen:** i18next was plumbed but only 2 key-groups existed and 3 files used `useTranslation`; the whole UI was hardcoded English. A full Hindi UI is a large multi-surface extraction, so this slice does the highest-leverage frame a Hindi user sees first.
- **MainLayout** (`apps/app/.../layouts/main-layout`): nav items, New-document CTA, logout, mobile menu aria now use `t('key','English default')`; added a `<LanguageSwitcher>` to the sidebar footer (previously reachable only from Settings) so users can switch to हिन्दी from anywhere in the app shell.
- **Dashboard**: greeting (morning/afternoon/evening), subtitle, 3 action cards, recent/empty states, "View all", and `StatusPill` (status labels via `status.*`) translated; `greeting()` now takes `TFunction`.
- **Translations:** added `common`/`nav`/`greeting`/`dashboard`/`status` keys to `en/translation.json` and **real Hindi** to `hi/translation.json` (also fixed `settings`/`theme`, which were still English in the hi file). es/fr/de untouched → fall back to English defaults.
- **Honesty:** Hindi strings are AI-authored standard Hindi — need native-speaker QA before shipping to users. Remaining surfaces (DocumentsList, NewDocumentPicker, editors + dialogs, auth, Settings finish, toasts) tracked as a follow-up task.
- Verified: app `tsc -p apps/app/tsconfig.app.json` exit 0, eslint clean on MainLayout + Dashboard, both locale JSONs valid.

### 2026-06-08 — Signatures: add image-upload mode (interim, alongside drawpad)

- Per request, the signature capture now offers **Draw / Upload / Type**. Upload accepts an image file, normalises it client-side through a canvas (scale to ≤600px wide, re-encode PNG) so it stays under the 2 MB cap and renders like a drawn signature; shows a preview before saving.
- Backend `RecordSignatureDto` method enum → `'draw' | 'upload' | 'typed'` (refine: typed⇒typedText, else⇒image); `provider`/`evidence.method` record `'upload'`. api-client `RecordSignaturePayload` + service `DrawnTypedEvidence` unions updated. Saved uploads display via the existing image-evidence path.
- Verified: api `tsc` 0, app `tsc` 0, eslint clean on changed files. This is the interim signing approach until provider eSign (Digio) lands.

### 2026-06-08 — Hindi UI i18n (cont.): Documents list + New-document picker

- **DocumentsList**: title/subtitle, New-document CTA, load-error, empty state, card chrome (type/untitled/updated) and `StatusPill` now i18n'd (reusing common/dashboard/status keys + new `documents.*`).
- **NewDocumentPicker**: all UI chrome — headings, the Draft-with-AI / Blank-document cards, preset section heading, preset **category labels** (`presetCategory.*`), structured-template heading, template count (plural via `templateCount_one/_other`), pick-template/back, Premium, create buttons, and the AI-draft modal (title, descriptions, brief label+placeholder, language label, Cancel/Generate) + the toast + default-title strings. New `newDoc.*` + `common.back/cancel/loading` keys, real Hindi added.
- **Left in English on purpose:** data-driven content — preset names/descriptions (`@org/legal-reference`) and document-type catalog names/descriptions/categories (backend). Translating those is a separate content effort.
- **Bug fixed:** in NewDocumentPicker the catalog `.map((t) => …)` param shadowed the translation `t` — renamed to `ct` so `t('newDoc.templateCount', …)` resolves correctly.
- **Reworded** the preset modal description to drop a literal `{{placeholders}}` token (i18next would have interpolated it) → "replace the placeholder tokens".
- Verified: app `tsc` exit 0, eslint clean (DocumentsList + NewDocumentPicker), both locale JSONs valid. Remaining #7 surfaces: editors + dialogs, auth, Settings finish, other toasts; + native-speaker QA.

### 2026-06-08 — Hindi UI i18n (cont.): document dialogs (Share / Version / Comments / Signatures)

- Wrapped all UI chrome in these four dialogs with `t('key','English default')`. **Locale JSON intentionally NOT edited** — owner is populating all locale files manually; inline English defaults keep the app working, and `pnpm i18n:extract` (i18next-parser) can harvest the keys.
- New key namespaces introduced (English defaults live in code):
  - `share.*` — title, description, access, password, passwordPlaceholder, expires, linkLabel, copy, copied, copyError, passwordNote, createLink; `share.mode.{view,comment,edit}`, `share.modeHint.{view,comment,edit}`, `share.expiry.{0,7,30}`
  - `versions.*` — title, description, count (plural), manualSave, saveCurrent, empty, snapshot, restore
  - `comments.*` — title, description, empty, reopen, resolve, placeholder, submit
  - `signatures.*` — title, description, empty, addSigner, fullName, emailOptional, addSignerBtn, signatureAlt, resign, sign, remove, draw, upload, type, clear, uploadedAlt, typeNamePlaceholder, preview, save, errNotImage, errProcess, errReadImage, errReadFile
  - `signerRole.{party_a,party_b,witness,lawyer,custom}`, `signerStatus.{pending,invited,viewed,signed,declined}`
  - `common.done` (added)
- Verified: app `tsc` exit 0, eslint clean on all four dialogs.
- Remaining #7: editor toolbars (BuilderShell + TemplateEditor), auth pages, Settings finish, SharedDocumentView, stray toasts; + native-speaker QA.

### 2026-06-08 — Fix: preview/PDF list markers missing + long content clipped in print

- **Bug 1 — no bullets/numbers in preview & PDF.** `.document-preview-page ul/ol` and the PDF `PagePrintStyles` set padding but never `list-style-type`, so Tailwind's preflight reset (`ul,ol{list-style:none}`) won — markers vanished (the editor's `.ProseMirror` set it explicitly, which is why they showed _there_ only).
  - Fix: re-assert `list-style: disc/decimal outside` (+ nested circle / lower-alpha, `display:list-item`) in `editor.css` `.document-preview-page`, in `Page.tsx` `PagePrintStyles` (`.doc-page ul/ol/li`), and in `export-word.ts`.
- **Bug 2 — long content cut off in print.** `Page.tsx` gave every page a fixed `height` + `overflow:hidden`, so any logical section taller than one sheet was clipped with no overflow path.
  - Fix: `height` → `min-height` and `overflow:hidden` → `visible`. With `@page size` + `break-after:page`, the paged renderer (Puppeteer) now flows an over-long section onto the next physical sheet instead of clipping it; nothing is hidden. Added `break-inside:avoid` for li/tr/img and `break-after:avoid` for headings so breaks land cleanly.
- **Preview now auto-paginates too.** `PaginatedPreview` measured-pagination: each manual-break chunk is rendered offscreen, its top-level blocks measured, and packed into page-height buckets — so an over-long section visually flows to page 2+ (matching the PDF) instead of growing into one tall sheet. First page still reserves the stamp-paper zone.
- **Known limits (honest):** the preview splits only _between_ top-level blocks — a single block taller than a full page isn't split in the preview (the PDF/Puppeteer still splits it correctly); PDF "Page X of Y" counts logical (manual-break) pages, so auto-split overflow pages share a footer.
- Verified: app `tsc` exit 0, eslint clean (PaginatedPreview, Page, export-word). Runtime/visual check needs the app + a PDF export (couldn't run here).

### 2026-06-08 — Signatures rendered onto the document + PDF + audit page (non-eSign signing complete)

- **Shared builder** `@org/legal-reference/.../signature-block.ts` (pure HTML, framework-free, imported by both API and app): `buildSignatureBlockHtml` (per-signer cell: drawn/uploaded image, typed-cursive, or blank ruled line for pending + name/role/date), `buildSignatureAuditHtml` (own page via `data-page-break`: name/role/method/signed-at/IP table + "not a certified eSignature" note), `appendSignaturesToHtml`.
- **PDF/print:** `documents.service.renderPayload` now, for freeform/HTML docs, loads `DocumentSigner` rows, maps `evidence` (image/typedText/ip/ua/signedAt), and appends the signature block + audit page to the body HTML → the exported PDF includes signatures. (Structured-template docs would need signature rendering in their React template — noted, not done.)
- **Live preview:** `PaginatedPreview` gained `appendHtml`; `TemplateEditor` gained `previewAppendHtml`; `DraftEditorPage` loads signers (`useSigners`), builds the same block, and passes it — so the freeform editor preview shows signatures WYSIWYG. (Structured builder uses the artboard iframe; it shows signatures in the PDF only.)
- **Schedule-1 (legal):** `@org/legal-reference/.../schedule1.ts` — `SCHEDULE_1_EXCLUSIONS`, `ESIGN_EXCLUDED_KEYS` (will, gpa, gift-deed, sale/trust/PoA…), `isESignExcluded()`, `SCHEDULE_1_NOTE`. `SignaturesDialog` takes `docTypeKey` and shows a warning banner for excluded types. This is the free, provider-independent half of the eSign gate; the Digio enforcement is still deferred.
- Verified: api `tsc` 0, app `tsc` 0, eslint clean on all changed files. Runtime/PDF visual check still needs the stack (Postgres + Browserless).

### 2026-06-08 — Citation validation safety-net (repealed-code detection)

- **`@org/legal-reference/.../citation-validator.ts`** (pure): `validateCitations(text)` scans for references to the **repealed IPC / CrPC / Indian Evidence Act** (section-attached or bare mentions), and where the curated `CITATIONS.supersedes` map knows the remap, suggests the successor (e.g. "IPC §302 → BNS §103 — Punishment for murder, verify against bare act"). `citationWarnings(text)` returns human-readable lines. Dedupes by code+section; conservative regexes (`\bIPC\b`, `Cr.P.C`, `Evidence Act 1872`).
- **Backend:** `legal-ai.service` runs it on the stripped HTML of every generate/revise result, logs a `warn` if any, and returns `citationWarnings: string[]` on both responses. (The model is still _instructed_ to avoid citations + use `{{applicable_law}}`; this catches slips rather than trusting the model.)
- **api-client:** `GenerateDocumentResponse` / `ReviseDocumentResponse` gained `citationWarnings`.
- **Frontend:** `warnCitations()` (exported from `DraftEditorPage`) shows a 10s `toast.warning` listing the findings; wired into the editor's AI generate + revise handlers and `NewDocumentPicker`'s Draft-with-AI.
- **Not done (deliberate):** auto-_filling_ `{{applicable_law}}` from the library — picking the right citation by context is unreliable, so we flag + let the human fill. The remap suggestions are confidence-flagged "verify against bare act".
- Verified: api `tsc` 0, app `tsc` 0, eslint clean.

### 2026-06-08 — AI revise: accept/reject diff (no more silent overwrite)

- **Before:** "Revise with AI" applied the model's HTML straight onto the editor (only Ctrl+Z to undo). Now it **stages** the result and shows a review modal first.
- **`apps/app/.../editor/revision-diff.ts`** (pure, no React/DOM): `diffText(before, after)` — LCS over plain-text tokens → coalesced `{op:'equal'|'added'|'removed', text}` segments. Word granularity (catches "1 month"→"2 months" inline); falls back to **block (line) granularity** when `tokens.length` product > 1.5M to bound the O(n·m) DP. `isUnchanged()` normalises whitespace to detect formatting-only revisions.
- **`TemplateEditor`:** `handleAiReviseSubmit` now sets `pendingRevision={before,after}` instead of applying; `acceptRevision` does the `setContent`+`setHtml`, `rejectRevision` discards. A diff `Dialog` (opens on `pendingRevision`) renders the inline word-diff (added = green bg, removed = red bg + strikethrough) over the **plain text** (shows what changed, not HTML structure), with Accept/Reject. Closing the dialog = reject. Formatting-only revisions show a "no visible text changes" note but are still appl(able).
- **Theme fix:** discovered the live token set (`apps/app/src/styles.css`) is `error/warning/success/secondary` (+`-accent`/`-foreground`), **no `destructive`/`muted`**, and `-foreground` tokens are near-white (for text _on_ a fill). Diff uses `bg-success/25` / `bg-error/20` with `text-foreground` so it stays readable. Also fixed the Schedule-1 banner I'd added earlier: `text-warning-foreground` (near-white, invisible on the light amber bg) → `text-foreground/80`.
- Verified: app `tsc` 0, eslint 0 on TemplateEditor + revision-diff + SignaturesDialog.
- **Not translated yet:** the diff modal chrome is English, consistent with the rest of the editor toolbar (revise/placeholder modals) — covered by the Hindi-editor pass (#7).

### 2026-06-08 — Fix: PDF export "Artboard responded 431" (data was in the URL)

- **Root cause:** `pdf-renderer.service` encoded the _entire_ document `data` (HTML + values) into the artboard URL as `?data=<urlencoded JSON>`, then `page.goto(url)`. For any sizeable doc — long AI-drafted court documents, an editor-embedded base64 image, or a signature block — the request line blew past the artboard HTTP server's limit → **HTTP 431 (Request Header Fields Too Large)**. Independent of the signature work, but the signature/image cases make it far easier to hit.
- **Fix:** stop putting data in the URL. The worker now injects it into the page via `page.evaluateOnNewDocument(... window.__ARTBOARD_DATA__ = injected ...)` (ships over the DevTools protocol — no size cap) before `page.goto`. URL is now just `/render/:key?pageSize=…`. `RenderRoute.tsx` reads `window.__ARTBOARD_DATA__` first, falling back to `?data=` (local dev) then `?docId=&token=` (API fetch).
- **Bonus — signatures now actually reach the PDF.** The inline path reads `doc.data` straight from the DB, so it had been _bypassing_ the signature injection that lives in `DocumentsService.renderPayload` (only the `docId/token` fetch path got signatures). Added `PdfRendererService.withSignatures()` mirroring renderPayload (loads `DocumentSigner` rows, maps `evidence`, `appendSignaturesToHtml`). **Duplication noted** — both should later call one shared helper.
- **Deploy note:** the artboard (`RenderRoute`) and API must deploy together — the new worker no longer sends `?data=`, so an old artboard build would find neither the global nor docId/token. Coordinated deploy required.
- **Not verified at runtime:** couldn't run the full stack here (Postgres + Browserless + artboard). Verified: api `tsc` 0, artboard `tsc` 0, eslint 0. Needs a real PDF export to confirm 431 is gone and signatures render.

### 2026-06-08 — Hindi i18n (cont.): auth, shared view, settings, editors (#7)

- **Auth** (`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `AuthLayout`): all chrome + toasts wrapped under `auth.*` (shared keys in `auth.common.*`).
- **SharedDocumentView** (public `/s/:token`): wrapped under `shared.*`, incl. interpolated meta line + password/comment flows.
- **Settings**: finished the remaining strings (`settings.*`) — toasts, headings, provider/passkey buttons, passkey-name prompt.
- **Editors** — the big one:
  - `TemplateEditor.tsx`: all toasts, top-bar buttons, sidebar tabs, status bar, and the Generate/Revise/Diff/Placeholder modals under `editor.*`. **Fixed 3 latent `t` shadows** (a `DocumentTemplate` param + two `const t` locals for template/timeout) that would have collided with the translation hook — renamed to `tpl`/`timer` (same bug class the BUILD_LOG flagged earlier in NewDocumentPicker).
  - `components/EditorToolbar.tsx`: every formatting tooltip + Field/Page-Break labels (`editor.format.*`).
  - `components/PageNavigator.tsx`, `TemplateGallery.tsx`, `PlaceholderForm.tsx`: page list, gallery (renamed pervasive `t` template loop var → `tpl`), and field-form chrome. Used explicit `_one`/`_other`-style keys for the field count so English stays correct without locale JSON.
- **Convention reaffirmed:** `t('key','English default')`, **locale JSON NOT edited** (owner populates Hindi manually; defaults keep the app working; `i18n:extract` harvests keys). Prompt strings sent to the AI (e.g. "Translate this document into …") left in English on purpose.
- **Still English (follow-ups):** builder sub-components (`BuilderForm`, `RisksPanel`, `SectionsTree`, `InlineEditPopover`, `sectionLabels`), `AuthCallback`, and data-driven content (preset / doc-type names). + native-speaker QA.
- Verified: app `tsc` 0, eslint 0 on every changed file.

### 2026-06-08 — Editor UI/UX redesign (Option C two-row toolbar) + mobile

- **Design doc:** `docs/ui-redesign-editors.md` — mocked the current state + 3 toolbar options (A grouped/menus, B right rail, C two-row) for both editors; user picked **C**.
- **Token fix:** `bg-destructive`/`text-destructive` don't exist in the theme (`apps/app/src/styles.css` defines `error`, not `destructive`) — those styles rendered colourless. Replaced with `error` in `BuilderPage`, `BuilderShell` (×2), `PageNavigator` (page-delete hover).
- **Freeform editor (`TemplateEditor`)** — two-row header:
  - Row 1: identity (back/icon/name·meta) + **primary** cluster (Draft/Revise AI, Export PDF, preview toggle). AI labels collapse to icon-only below `sm`.
  - Row 2: grouped, horizontally-scrollable strip — **File** group (Templates, Copy, Word, Save-to-docs) · **Collaborate** group (Share, Comments, Signatures, History) · PageSize pushed right. Ghost buttons w/ new icons (`ShareIcon/CommentIcon/SignatureIcon/HistoryIcon`) + `ToolbarDivider`/`ToolbarGroup` helpers.
  - **Mobile:** below `lg` the 3 resizable panes are replaced by a single-pane **Fields / Editor / Preview** segmented switcher (panes extracted to `sidebarPane`/`editorPane`/`previewPane` consts so the one Tiptap `EditorContent` is never duplicated; inactive panes are `hidden`, not unmounted). `lg+` keeps the resizable `Group`/`Panel`.
- **Structured builder (`BuilderShell`)** — same two-row pattern: Row 1 = back/title/save-dot/Export PDF; Row 2 = Language + Share/Comments/Signatures/History + PageSize (scrolls on mobile, so collaborate actions are now reachable on phones — previously `lg:`-only). Mobile switcher extended to **Sections / Form / Preview** (the Sections+Risks pane was previously inaccessible on mobile).
- **New hook:** `@org/hooks` `useMediaQuery(query)` (SSR-safe) — drives the desktop/mobile layout swap. Added to `libs/shared/hooks`.
- New i18n keys: `editor.group.*`, `editor.mobile.{editor,preview}`, `builder.tab.sections`.
- Verified: app `tsc` 0, eslint 0 on every changed file. **Runtime/visual check still pending** (couldn't run the app here) — needs a look on desktop + a narrow viewport.

### 2026-06-08 — Structured builder: preview zoom + scroll + resizable panes (match freeform)

- **Goal:** the freeform editor's preview zooms/scrolls; the builder's was a bare iframe. Make them consistent and make the builder's 3 panes resizable.
- **Zoom inside the artboard** (`apps/artboard/.../LivePreview.tsx`): wraps `TemplateRenderer` in `<div style={{ zoom }}>`. Owns zoom jointly with the host — `doc:zoom` message sets it (host buttons); trackpad pinch / ctrl+wheel are handled _inside_ the iframe (it captures those, the host can't) and reported back via `artboard:zoom`. PDF `RenderRoute` is a separate component → unaffected (PDF still renders at 100%).
- **Host** (`ArtboardIframe.tsx`): zoom state + the same corner ⊕/%/⊖ control overlay as `PaginatedPreview`, posts `doc:zoom` on change, listens for `artboard:zoom` to keep the % in sync with gestures. Same MIN/MAX/DEFAULT (0.3/3/0.85) as the freeform preview. Scroll stays native to the artboard document.
- **Resizable panes** (`BuilderShell.tsx`): desktop now uses the same `react-resizable-panels` `Group`/`Panel`/`Separator` as the freeform editor (Sections | Form | Preview, draggable grips) instead of a fixed CSS grid. Below `lg` keeps the Sections/Form/Preview segmented switcher. Panes extracted to `sectionsPane`/`formPane`/`previewPane` consts so the single artboard iframe is never duplicated across the desktop/mobile branches. Switcher now gated on `!isDesktop` (was `lg:hidden`) for one source of truth.
- **`useMediaQuery`** improved: synchronous lazy init from `matchMedia` (this is a Vite SPA — `window` always present) so there's no layout flash / double iframe-mount on load.
- **Field-click popover:** unaffected — CSS `zoom` keeps `getBoundingClientRect` in the visual coordinate space the host already offsets by.
- Verified: app `tsc` 0, artboard `tsc` 0, eslint 0. **Runtime/visual still pending** — needs the artboard + app running to confirm zoom sync (buttons ↔ pinch) and that field-click popovers land correctly while zoomed.

### 2026-06-08 — Freeform pagination: preview ↔ PDF in sync, overflow contained, page-select sync

- **Root cause:** freeform had TWO pagination engines that disagreed — the live preview (`PaginatedPreview`) measured + auto-split overflow with serif (Times) CSS; the PDF/artboard (`FreeformDocument`) did NOT measure (one page per manual chunk), used sans (Inter) CSS, and set `totalPages` = chunk count → wrong "Page X of Y" and text spilling past the page.
- **Shared paginator** `@org/document-templates/.../paginate-html.ts`: `splitHtmlOnPageBreaks` + `paginateChunks(host, chunks, profile)` (measure top-level blocks, honour manual breaks as forced breaks, first page reserves the stamp zone). Used by BOTH:
  - `PaginatedPreview` — replaced its inline copy.
  - `FreeformDocument` — now measures in a `useLayoutEffect` against a hidden `.doc-page` host; **falls back to one-page-per-chunk on first render** so the PDF is never blank if measuring is skipped. `totalPages` is now the real measured count → "Page X of Y" correct on every sheet.
- **CSS unified:** `.document-preview-page` (editor.css) rewritten to mirror `.doc-page` (PagePrintStyles) exactly — Inter/Devanagari stack, line-height 1.5, justified 11pt paragraphs, centered-uppercase h1, underlined h2, 22pt list indent, table/cell rules. So the preview now looks AND measures like the exported PDF (PDF output itself unchanged → structured templates unaffected). Comment in each file flags they must stay in lockstep.
- **Overflow contained (both):** `overflow-wrap:anywhere` + `word-break:break-word`, `img/table max-width:100%`, `td/th` wrap, `pre` wrap — long tokens / wide media can no longer spill outside the page or the artboard.
- **Selected-page sync:** `PaginatedPreview` gained `activePage` (highlight + smooth scroll-into-view) and `onSelectPage` (click a page → select). Wired in `TemplateEditor` to the existing `activePage` / `handleJumpToPage`, so editor caret ↔ Pages panel ↔ preview stay in sync.
- Verified: app `tsc` 0, artboard `tsc` 0, eslint 0.
- **Honest limits / needs runtime check:** (1) measured sync assumes the same font is available at measure-time and render-time — if **Inter** is bundled in the app but not the artboard (or loads late under Puppeteer), heights can drift and break positions diverge by a line; verify a multi-page export. (2) Page-select sync is exact when manual breaks == physical pages; with auto-split overflow the logical (editor) and physical (preview) page indices differ, so highlight/jump is approximate (clamped, never crashes). (3) A single block taller than one page still overflows that page (can't be split) — rare; would need block-splitting.

### 2026-06-08 — Fix: Next.js (`apps/web`) build can't resolve `@org/transliteration`

- **Symptom:** `next build` (webpack) failed — `Module not found: Can't resolve '@org/transliteration'` from the rich-text-editor files in `@org/ui`, pulled into web via `forgot-password/page.tsx` → `@org/ui`. Vite/tsc/the `app` build never showed it (they resolve via `nxViteTsPaths()` reading `tsconfig.base.json`).
- **Root cause (two omissions, both Next-specific):** `apps/web/tsconfig.json` defines its **own** `paths` block, which _replaces_ (does not merge with) the extended base paths — and it omitted `@org/transliteration`. And `next.config.js` `transpilePackages` also omitted it (Next won't compile a workspace lib's TS/JSX from source unless listed). `@org/transliteration` is a transitive dep of `@org/ui`'s rich-text-editor (recently added) and was in neither list, so webpack couldn't resolve it; `@org/ui` itself is in both → resolved fine.
- **Fix:** added `@org/transliteration` to both `apps/web/tsconfig.json` `paths` and `next.config.js` `transpilePackages`, mirroring `@org/ui`.
- Verified: `next build --webpack` in `apps/web` → **Compiled successfully**, 12/12 static pages generated.
- **Unrelated pre-existing breakage noted:** `pnpm nx build web` still fails earlier in the dependency task `@org/store:build` — its `vite:dts` step type-checks files outside the lib (`apps/api/src/main.ts` cookie-parser default import, `apps/app/src/app/app.tsx` `--jsx not set`). Not touched here; separate fix needed for the store lib's dts `include`/tsconfig.

### 2026-06-08 — Freeform PDF ≠ preview spacing fixed; per-document font picker (any Google font)

- **Bug:** exported PDF broke pages differently from the live preview (e.g. a whole `<ol>` bumped to the next page leaving a big blank; PDF 4 pages vs preview 3). Root cause: the shared block paginator (`paginate-html.ts`, atomic top-level blocks) measured against **different fonts** on the two surfaces. `.document-preview-page` (editor.css) listed `'Noto Sans Devanagari'`; `.doc-page` (`Page.tsx`) listed **no** Devanagari font — and _no_ font was bundled anywhere (both relied on system fonts). The artboard also measured pagination **before** fonts loaded (readiness was a blind `setTimeout(300)`), freezing breaks against a fallback face.
- **Fixes (pagination parity):**
  1. **Bundled fonts** — added `@fontsource/inter` + `@fontsource/noto-sans-devanagari` (400/500/600/700), imported in `apps/app/src/main.tsx` **and** `apps/artboard/src/main.tsx`. Deterministic, offline, version-pinned — preview and Puppeteer now paint identical faces.
  2. **Unified font stack** — `.doc-page *` and `.document-preview-page *` are now byte-identical and use `var(--doc-font, 'Inter'), 'Noto Sans Devanagari', 'Segoe UI', system-ui, sans-serif`.
  3. **Font-readiness gate** — new `useFontsReady`/`loadDocumentFonts` (`document-templates`). `PaginatedPreview` + `FreeformDocument` re-run `paginateChunks` once fonts load; `RenderRoute` now `await`s font load (not a 300ms guess) before setting `window.__ARTBOARD_READY__`, with two rAFs so the re-pagination paints before `page.pdf()`.
- **New feature — per-document font (any Google Fonts family, whole-document):**
  - New `google-font.ts` (`document-templates`): `ensureGoogleFont(family)` injects the Google Fonts `<link>` idempotently and awaits the faces via `document.fonts.load`; `useGoogleFont(family)` flag re-paginates when the chosen font loads. Devanagari fallback always trails the chosen family so Hindi glyphs never tofu.
  - `FreeformData.fontFamily` carries the choice; `FreeformDocument` + `PaginatedPreview` load it, set `--doc-font`, and re-measure. `RenderRoute` loads `data.fontFamily` before signaling Puppeteer.
  - UI: `DocumentFontSelect` (apps/app/lib/document-fonts.tsx) — a free-text combobox (any family) with a curated India-first datalist (Noto Sans/Serif Devanagari, Mukta, Hind, Tiro Devanagari Hindi, Baloo 2, …); commits on blur/Enter/suggestion-pick to avoid loading on every keystroke. Sits beside the page-size selector in the editor toolbar.
  - **Persistence:** stored in the document `data` JSON (`data.fontFamily`) — versions with the doc, reaches the PDF via the existing render-payload pass-through, and needs **no DB migration or API/DTO change** (`PatchDocumentDto.data` is `z.record`). Saved/restored by `DraftEditorPage`; local `/editor` draft carries it too.
- Verified: app + artboard `tsc` 0; eslint 0 on all changed files; `vite build` for app **and** artboard bundle the Inter + Noto Sans Devanagari woff2. **Not run:** live end-to-end PDF export with a chosen Google font (needs api+artboard+browser) — confirm a multi-page Hindi export matches the preview page count and renders the picked family.

### 2026-06-08 — Paginator: split tall containers across pages (kill the blank gap)

- **Symptom after the font fix:** still a big blank gap (e.g. प्रार्थना heading at page foot, the whole numbered `<ol>` on the next page). Cause: `paginateChunks` packed **atomic top-level blocks** — a container that didn't fit the space left on a page jumped down whole, leaving the gap. Font parity made preview==PDF, but both still showed the gap.
- **Fix:** rewrote `paginateChunks` with a recursive packer. Splittable containers (`ol/ul/div/section/blockquote`, >1 child) are now **divided by their children**: leading items fill the current page, the rest continue on the next. Ordered-list continuations keep numbering via `start`. Added heading **keep-with-next** (a heading with < 48px of room below is pushed down with its content). Tables/images stay atomic (can't be halved cleanly). Same function still drives preview + PDF, so they split identically. No infinite-loop: after a page break the first child is always consumed (placed alone if taller than a whole page, accepting overflow).
- Verified: app + artboard `tsc` 0; eslint 0 on the paginator. **Needs runtime check:** confirm the gap is gone and list numbering continues correctly across the split in a real multi-page export — and restart/rebuild the running app + artboard dev servers, since the font/CSS/paginator changes won't appear until they reload.

### 2026-06-08 — Auto-break: PDF broke earlier than preview (blank foot on A4)

- **Symptom:** on auto page break (A4), the live preview filled to the page bottom but the exported PDF broke earlier, leaving blank space at the foot. Same `paginateChunks` → the artboard measured content **taller** than the app.
- **Cause:** the two measuring hosts use different CSS classes (app: `.document-preview-page`, artboard: `.doc-page`). `.document-preview-page` pins `font-size: 11pt` on its **root**; `.doc-page` did **not** — so content not covered by the p/li/h rules (wrapper divs, bare text, line-boxes) measured at the UA default (~16px) in the PDF vs 11pt in the preview → taller → early break.
- **Fixes:**
  1. `.doc-page` root now sets `font-size: 11pt; color: #111` to mirror `.document-preview-page` exactly.
  2. `FreeformDocument` now **gates** the measured paginate on `fontsReady && docFontReady` — it no longer measures against a fallback font and then race a re-measure the PDF capture might miss; the only measured pass is the correct one (one-page-per-chunk fallback stands until fonts load).
- Verified: app + artboard `tsc` 0, eslint 0. **Needs runtime check after restarting the artboard** (changes won't show on a stale server).

### 2026-06-09 — Root cause of preview≠PDF page count: unstyled h3; diagnostic kept as a tool

- **Found via the new pagination diagnostic:** preview and PDF block heights were identical EXCEPT `H3` — preview `22px`, PDF `60px`. `h3` was unstyled in both stylesheets, so it inherited Tailwind preflight's heading reset in the app (22px) but the browser UA default (1.17em + 1em margins = 60px) in the artboard (no preflight). ~16 h3s × 38px ≈ one extra page → PDF 4 vs preview 3.
- **Fix:** pinned `h3–h6` identically in `.doc-page` (Page.tsx) and `.document-preview-page` (editor.css) — `font-size: 11pt; font-weight: 600; margin: 0`. `margin:0` keeps the preview's measured heights unchanged; the PDF's h3 drops 60→22. Confirmed by the user: both now `pages=3`, all `H3:22`.
- **Diagnostic kept (not removed), now a reusable off-by-default tool:**
  - `PAGINATION_DEBUG` const → `isPaginationDebug()` runtime check: enable via URL `?paginationDebug=1`, `localStorage.paginationDebug='1'`, or `window.__PAGINATION_DEBUG__`.
  - PDF path: `pdf-renderer.service` appends `?paginationDebug=1` to the artboard URL when API env `PAGINATION_DEBUG=1` — the report prints as a yellow box into the PDF. Off in normal exports.
  - `debugMeasure`/`formatPaginationDebug` report loaded-fonts booleans, computed font, budgets, and per-block heights for both surfaces.
  - **Doc:** `docs/PAGINATION_DEBUG.md` — architecture, how to enable (app + PDF), how to read, and a cause→fix matrix (font not loaded / CSS metric divergence / overflow).
- Verified: app + artboard + api `tsc` 0; eslint 0 on all changed files.

### 2026-06-09 — Document Intelligence roadmap v2 + pluggable-architecture principle (docs only)

- Reworked `docs/05-document-intelligence-roadmap.md` to **v2** after reviewing an internal IDP POC + current industry research (cited): VLM-native + agentic multi-pass extraction, calibrated per-field confidence + provenance, eval/STP harness, citation verification, India-first Devanagari/scanned/handwritten focus. POC verdict table (adopt engineering-hygiene patterns; reject text-first core; defer the workflow/assignment engine to a teams/ops phase). Re-ordered phases: extraction quality + eval first, ops later.
- Added **`docs/ARCHITECTURE_PRINCIPLES.md`** (standing reference): all external/provider seams go through interface → registry → factory → config-driven selection with capability negotiation and **observable** fallbacks. Key guardrails called out: don't interface-wrap single-implementation internals (avoid premature abstraction); **no silent downgrade** — fallbacks are recorded, and accuracy-critical steps (citation verification, load-bearing legal extraction) are `allowDowngrade: false` (fail loudly, not quietly worse). Includes a seam inventory (incl. upgrading `AiService`'s "first available" selection to config+capability+health+fallback) and an add-a-service checklist.
- Wired the principle into **CLAUDE.md** conventions so it's loaded every session ("always refer"). No code changed — docs only.

### 2026-06-09 — Platform strategy doc (market analysis + focused, anti-bloat plan)

- Added `docs/06-platform-strategy.md`: market-grounded (web-researched) strategy for an AI-native, India-first document _lifecycle loop_ (Draft⇄Understand⇄Verify⇄Execute), reconciling `01` (market/regulatory), `02` (build phases), `05` (intelligence), `ARCHITECTURE_PRINCIPLES`.
- Corrected the user's framing: AI is not a moat and buyers already adopting fast (law-firm AI 19%→79%); the real laggards are the _business models_ — template doc-gen (LegalZoom/Rocket Lawyer/LawDepot), Indian compliance _services_ (Vakilsearch/Zolvit, IndiaFilings, LegalRaasta = labor-margin, structurally can't go self-serve-AI without cannibalizing), and e-sign/e-stamp _rails_ (eMudhra/Leegality/Digio = partners, not targets). Each owns one slice; none owns the AI-native vernacular loop.
- Includes an explicit **cut list** (own e-sign stack, heavy workflow engine, legal-research DB, practice mgmt, lawyer marketplace, generic AI chat, early US expansion = NON-goals) to keep it "full-fledged but not overloaded," plus JTBD, positioning vs each incumbent, wedge→loop sequencing, north-star metrics, risks, and sources (third-party, moderate confidence — flagged to validate against primary filings).
- Docs only; no code changed.

### 2026-06-09 — Two new structured document types: RTI Application + Legal Notice

- **Why:** only `rent_agreement` was a fully implemented structured template. The seed catalog (`tools/prisma/seed-data/document-types.ts`) already listed `rti` (`rti.default`) and `legal_notice` (`legal-notice.formal`) as document types, but neither had a code bundle or a render component — so they were broken catalog entries (`getTemplate()` returned undefined). Implemented both, mirroring the rent-agreement pattern exactly. No new doc types invented (anti-bloat per `docs/06`); no DB/seed change needed.
- **RTI Application** (`@org/document-schema/src/rti/*` + `@org/document-templates/src/rti/default`): schema (applicant/authority/pio/request/fee) + form-metadata + versioned prompts + deterministic risks + A4 render component. Author-verified RTI Act 2005 references (§6(1), §6(3), §7(1)+proviso 48h, §7(5) BPL fee exemption). Risks: missing authority/questions, fee-zero-non-BPL, life/liberty 48h, voluminous request.
- **Legal Notice** (`.../legal-notice/*` + `.../legal-notice/formal`): schema with `noticeType` branch (cheque_bounce/consumer/civil_recovery/employment/general), through-advocate framing, sender/recipient, facts, demand, cheque particulars. Render component branches to the **NI Act §138** statutory paragraph for cheque bounce. Risks: §138 15-day demand (proviso c), 30-day issuance window (proviso b, computed from dishonour date), mandatory cheque details, party/demand essentials. Consumer→CPA 2019 proceeding line.
- **Golden rule respected:** statute references are deterministic, author-written text in templates/risks (exactly how `rent-agreement/risks.ts` cites Registration Act §17). The AI prompts only tighten the user's facts/phrasing — they never author citations.
- **Wiring:** registered bundles in `document-schema/src/index.ts`; registered `rti.default` + `legal-notice.formal` in `document-templates/_registry.tsx`; exported components from `document-templates/src/index.ts`.
- Verified: app + artboard `tsc` 0, eslint 0 on all new/changed files. **Not run:** live builder/PDF render of the two new types (needs the app + artboard running) — recommend a visual pass on each, and confirming the structured builder's select widgets infer options from the new zod enums.

### 2026-06-09 — Wire Document Intelligence to the document generator (roadmap alignment, docs only)

- **Why:** `05` had Document Intelligence and the document generator (`@org/document-schema` bundles + builder) growing as parallel universes — the convert bridge only produced lossy `freeform` HTML, even though `05` §5.1 itself notes `ExtractionSchema` "is the reverse of `DocumentType`." Aligned them so the next phase's development converges. Scope confirmed with user: **docs only** (DI has no code yet; Phase 0 not started — keep the separation contract intact), and **structured prefill + freeform fallback** for convert.
- Added **`05` §11 — Integration with the document generator (drafting ⇄ intelligence)**: (11.1) the two schema systems are mirrors (table: `DocumentTypeBundle` ↔ `ExtractionSchema`); (11.2) **one shared doctype vocabulary** — the classifier emits the generator's `DocumentType` key (`rent_agreement`/`rti`/`legal_notice`) verbatim, so convert routes with no translation layer; (11.3) **convert = structured prefill** (map reviewed extraction → bundle Zod schema → create via the existing `POST /documents` API with a `knownTemplates` templateKey → opens prefilled in the builder, risks/templates/export reused) **+ freeform fallback** (no match / low confidence); (11.4) the **field-map is config-as-data** (per-type, versioned, ships in §5.5 packs; first three: rent/rti/notice); (11.5) separation contract holds — convert uses the *public create path* (not an editor edit), `AiService` extended additively; (11.6) surfacing confidence inside the builder is an optional additive `Warning[]` input, deferred.
- Threaded the alignment through the doc: updated the §4 architecture diagram (convert → structured | freeform), the §7 **Phase 3** bullet (two targets + ship field-maps for the 3 live types) and **Phase 1** bullet (classifier emits the generator's DocumentType key — the cheap enabler), and the §10 separation-contract note + diagram. Renumbered Sources §11→§12 and fixed the one cross-ref.
- Added a pointer from **`docs/06-platform-strategy.md` §4** (the DRAFT⇄UNDERSTAND seam → `05` §11) so the strategy doc references where the loop actually closes.
- Docs only; no code changed.

### 2026-06-09 — Replace native window.prompt with a modal (completes native-dialog removal)

- Added `apps/app/src/app/components/confirm/PromptProvider.tsx` — a promise-based `usePrompt()` mirroring the earlier `ConfirmProvider`: one app-level `@org/ui` Dialog with a text input, returns `Promise<string|null>` (null = cancel/dismiss). Supports title/description/label/placeholder/defaultValue/confirmLabel/cancelLabel/required; Enter submits (wrapped in a `<form>`). Mounted in `main.tsx` nested under `ConfirmProvider`.
- Converted the last native dialog: `Settings.tsx` passkey-label `prompt()` → `await prompt({...})`. No native `prompt()`/`confirm()`/`alert()` remain anywhere in `apps/app/src`.
- Verified: app `tsc` 0, eslint 0 errors on changed files (4 pre-existing warnings in Settings.tsx — `_providers`, catch `any` — untouched, out of scope).

### 2026-06-09 — Third structured document type: General Affidavit

- **Why:** continue the "more structured templates" arc. Added a single general-purpose affidavit (anti-bloat: one flexible type with a free list of numbered declarations covers name/address/DOB/income/gap/lost-document uses, rather than many near-duplicate templates). Mirrors rent-agreement/rti/legal-notice exactly.
- **Affidavit** (`@org/document-schema/src/affidavit/*` + `@org/document-templates/src/affidavit/default`, key `affidavit`, componentKey `affidavit.default`): schema (deponent / declaration{title,purpose,statements} / attestation) + form-metadata + versioned prompts + risks + A4 render component (opening "I, …, aged about … do hereby solemnly affirm …", numbered declarations, VERIFICATION clause, DEPONENT signature, attestation block that branches on notary / oath-commissioner / executive-magistrate / self-attested).
- **Citations — deliberately NOT hardcoded:** the false-affidavit/truthfulness risk is phrased *conceptually* (no section number). The IPC→Bharatiya Nyaya Sanhita 2023 false-evidence mapping is not asserted because I'm not certain of the exact BNS section; per the golden rule it must be resolved/verified via `@org/legal-reference`, never guessed. Flagged in schema + risks comments.
- **Wiring:** registered bundle (`document-schema/src/index.ts`), component `affidavit.default` (`document-templates/_registry.tsx`), export (`document-templates/src/index.ts`), and seed catalog entry (`tools/prisma/seed-data/document-types.ts`: type `affidavit`, template `affidavit-default-en`, category `declarations`, sortOrder 40). **Requires a re-seed** for the new catalog row to appear.
- **Known builder limitation (pre-existing, not a regression):** `BuilderForm` renders only sections listed in `sectionOrder`; it does not specially handle array fields or `select` enums (arrays/selects render as plain text inputs — see the code's own "future iteration" note). So `declaration.statements` is edited primarily via the preview `EditableField` + AI assist, exactly like RTI's `request.questions`. The earlier task-3 note about "select widgets inferring enum options" was a wrong expectation — the builder doesn't infer enum options today.
- Verified: app + artboard `tsc` 0, eslint 0 on all new/changed files. **Not run:** live builder/PDF render (needs app + artboard running) — folded into the render-verification task.

### 2026-06-09 — PDF print learnings doc (portable, for reuse in another app)

- Added `docs/PDF_PRINT_LEARNINGS.md`: the app-agnostic *rulebook* distilled from this repo's preview↔PDF parity work — the two-surfaces root cause; mm-based page sizing with the page owning margins as padding (`@page size; margin:0` + Puppeteer `preferCSSPageSize`); `min-height`/`overflow:visible` for flow-not-clip; font preloading via explicit `fonts.load(spec)` before measuring (the #1 preview≠PDF cause); metric parity between the two page stylesheets; the **CSS-reset trap** (Tailwind preflight present in app, absent in artboard → unstyled `h3` adds a page); overflow/break-hint rules; JS measure-then-pack pitfalls (mm→px at 96dpi, first-page budget, atomic blocks, residual spill) vs native paged media; headless-Chrome operational gotchas (inject data not via URL → avoid HTTP 431, readiness-flag gate, host.docker.internal); a portable checklist; and a file-by-file map of where this repo implements each.
- Cross-linked with `docs/PAGINATION_DEBUG.md` (debugger ↔ rulebook). Docs only.

### 2026-06-09 — Builder form upgrade: real dropdowns + array list editors

- **Why:** `BuilderForm` previously rendered `select` enums and array fields as plain text inputs (its own code said "future iteration … once form-metadata carries enums"). So enum fields were free-text and array fields (RTI questions, affidavit statements, notice facts, rent inventory/rules) showed a comma-joined string. Made the builder "open to all field kinds."
- **Schema lib (`@org/document-schema/types.ts`):** added a `FieldOption` type + `options?: FieldOption[]` on `FieldMetadata`, and a `'list'` widget for string arrays. Additive, non-breaking.
- **Bundles:** populated `options` on every `select` and marked string-array fields `widget:'list'` across all four bundles — rent-agreement (parentRelation ×2, property.type, furnished, 6× utilities `*PaidBy` sharing a `PAID_BY` list, inventory+customRules as lists), rti (parentRelation, preferredFormat, fee.mode, questions=list), legal-notice (noticeType, deliveryMode, facts=list), affidavit (parentRelation, idType, attestation.type, statements=list).
- **`BuilderForm.renderInput`:** `select`/`lookup` now render a real `<select>` from `meta.options` (with a placeholder option; `lookup` falls back to text when no static options); new `'list'` branch renders a `ListEditor` (add/edit/remove string rows, full-width, textarea rows for long items). Hoisted the shared input class to module scope. Kept number/currency/date/boolean/textarea/address; phone/aadhaar/pan/pincode still text.
- **Known remaining gaps (tracked, task #8, NOT regressions):** dynamic DB-backed lookups (state via `in_states`) still text — needs a public lookups endpoint + hook; phone/aadhaar/pan/pincode have no input masks; object-array fields (rent witnesses) use fixed indexed paths.
- Verified: app + artboard `tsc` 0, eslint 0 on all changed files. **Not run:** live builder render (needs app running) — folded into task #3.

### 2026-06-09 — Builder enhancements: dynamic DB lookups + input affordances

- **Dynamic `lookup` fields → real dropdowns (end-to-end).** Reused the existing `@Public() GET /lookups` API (no backend change). Added `createLookupsService` to `@org/api-client` (+ export), wired it through `main.tsx` → `ServicesProvider` (`useLookupsService`), and a `useLookupOptions()` React Query hook that fetches all public groups once and returns a `lookupKey → FieldOption[]` map. `BuilderShell` passes the map to `BuilderForm`, which resolves any `widget:'lookup'` field against `meta.lookupKey` (merging into `meta.options`) so it renders via the same `<select>` path; falls back to text when a key has no data.
- **Seeded the `in_states` lookup group** (`tools/prisma/seed-data/lookups.ts`) — all 28 states + 8 UTs with **uppercase ISO 3166-2:IN codes** as values. Built literally (NOT via `toValues`, which lowercases) because the consuming fields validate `/^IN-[A-Z]{2}$/` (rent `property.state`, RTI `authority.state`) — lowercased codes would fail. Without this the `state` lookup field had no data and silently fell back to text. **Requires running the lookups seed** to take effect.
- **Input affordances** for India-specific text widgets in `BuilderForm` (`MASKED_INPUTS`): phone→`inputMode=tel`, pincode/aadhaar→`inputMode=numeric` + length caps, PAN→uppercase + maxLength 10. Light-touch (keyboard + caps); authoritative validation still lives in the Zod schema so typing is never blocked.
- **Confidence note:** ISO codes use the official ISO 3166-2:IN values (Chhattisgarh IN-CT, Odisha IN-OR, Uttarakhand IN-UT, Telangana IN-TG, DNH&DD IN-DH) — these differ from some govt-internal abbreviations (CG/OD/UK); the field helperText explicitly says "ISO 3166-2:IN", so ISO is correct. Verify against `@org/legal-reference`/jurisdiction usage if any downstream switch expects a different code.
- Remaining builder gap tracked as task #9 (generic repeat-group editor for object arrays like `witnesses`; current fixed indexed paths still work).
- Verified: app + artboard `tsc` 0, eslint 0 on all changed files. **Not run:** live render (needs app running) — folded into task #3.

### 2026-06-09 — Builder: generic repeat-group editor for object arrays (witnesses)

- Added a `'group'` widget + `itemFields`/`maxItems`/`itemLabel` to `FieldMetadata` (`@org/document-schema`). A `group` field is an array of objects; the builder renders N repeating sub-forms (driven by `itemFields`) with add/remove and a max cap.
- Replaced rent-agreement's four fixed indexed witness entries (`witnesses.0.name` … `witnesses.1.address`) with a single `witnesses` group field (itemFields name+address, maxItems 4).
- `BuilderForm`: new `GroupEditor` component + a `widget==='group'` branch in the field map (full-grid-width). Sub-fields reuse the existing `Field`/`renderInput` via `${path}.${idx}.${sub}` paths and the shared `setAt`.
- **Fixed a latent bug:** the old indexed-path approach made `deepSet` build `witnesses` as an OBJECT (`{"0":…,"1":…}`), which has no `.length`/`.map`, so witnesses entered in the form silently never rendered in the template (`data.witnesses ?? []` → `.map`). The group editor writes a proper array, so witnesses now actually appear.
- Verified: app + artboard `tsc` 0, eslint 0 on all changed files; no dangling references to the old `witnesses.0/1` paths.

### 2026-06-09 — Note: visual verification is manual (user-owned)

- Live render/builder verification is being done manually by the user, not via an automated browser pass. Before that check, re-seed the DB so the new data exists:
  - **document-types** seed → adds the `affidavit` catalog row (`affidavit` / `affidavit.default`).
  - **lookups** seed → adds the `in_states` group so the `state` lookup field renders as a dropdown (else it falls back to text).
- What to eyeball when verifying: rti.default / legal-notice.formal (incl. NI Act §138 branch) / affidavit.default render + pagination; builder enum dropdowns, `list` editors (questions/statements/facts/inventory/customRules), the `state` dropdown, masked inputs (phone/aadhaar/pan/pincode), and the witnesses repeat-group (add/remove → witnesses now render in the doc).

### 2026-06-09 — Document Intelligence **Phase 0** (foundations) — code, end-to-end skeleton

Implemented Phase 0 of `docs/05-document-intelligence-roadmap.md` (the sanctioned, self-contained start). New SEPARATE domain — reuses StorageService / AiService (extended additively) / WalletUsage, **never touches Document/DocumentVersion/editor** (separation contract §10 holds). All four units verified: API `tsc` 0, API webpack **build** success (proves the new lib alias resolves + bundles), eslint 0 on all new files, `@org/doc-intelligence` lint 0, Prisma migration **applied** to the dev DB + client regenerated, lib standalone `tsc` 0.

- **Extended `AiProvider` additively** (`apps/api/src/app/ai/providers/ai-provider.interface.ts`): optional `supportsVision()`/`supportsEmbedding()`/`extract<T>(MultimodalInput, JsonSchema, opts)`/`embed()` + `MultimodalPart` (text|image|document base64) / `JsonSchema` / `Structured<T>` types. `generate`/`stream` untouched. Implemented vision + **forced tool-use structured extraction** in `claude.provider.ts` (Opus/Sonnet read PDFs/scans natively → **no OCR dep needed for Phase 0**; `ANTHROPIC_VISION_MODEL` overrides the extraction model). `AiService` gained `extract`/`extractWith`/`embed`/`getVisionProviders` with **capability negotiation + observable fallback** (no silent downgrade) and a `provider:model` whitelist guard (`AI_MODEL_WHITELIST`, fail-fast, empty = allow all). `embed` throws until Phase-2 RAG wires a provider (Anthropic has no embeddings endpoint).
- **New Postgres models** (`tools/prisma/schema.prisma`, migration `20260609064721_add_document_intelligence`, applied): `SourceDocument`, `IntelligenceJob` (idempotent + stage-guarded + `heartbeatAt`), `Extraction` (per-field `confidence` + `edits` audit jsonb, `overallConfidence` for STP) + enums `SourceDocStatus`/`IntelligenceJobStatus`/`IntelligenceStage`. All `jsonb`/arrays (no JSON-as-string, per §1 reject list). Back-relations added to User/Organisation only.
- **New lib `@org/doc-intelligence`** (`libs/doc-intelligence/`, pure — no React/Nest/SDKs; alias in `tsconfig.base.json`): `ExtractionSchema` (the **mirror of `DocumentTypeBundle`**, §11.1 — config-as-data, not Zod); engine **contracts** `IParser`/`IOcrEngine`/`IClassifierEngine`/`IExtractionEngine` + a generic `EngineRegistry` (interface→registry→factory, capability-negotiated select w/ recorded `skipped` trail, `allowDowngrade:false` for accuracy-critical steps); `buildJsonSchema`/`buildExtractionToolSchema` (values + sibling per-field confidence/provenance) + `buildClassificationSchema`; versioned prompt builders (golden rule: model never authors citations); confidence aggregation + `decideReview` (STP routing); the **eval harness** (§6 — precision/recall/F1, exact+fuzzy, cell accuracy, STP rate, calibration buckets — pure scorers); the convert **field-map** (§11.4, config-as-data) + `applyFieldMap`; first packs `rent_agreement` (co-designed with the live bundle, real field-map onto its Zod paths) + a `generic_document` fallback (no `documentTypeKey` → freeform on convert).
- **New NestJS module `intelligence`** (`apps/api/src/app/intelligence/`, wired into `app.module.ts` via `forRootAsync()`): mirrors the exports pattern — **REDIS set → BullMQ queue + worker; unset → inline fire-and-forget**, identical status transitions. `PipelineService` runs the linear v1 state machine (load bytes → **classify** to the generator's `DocumentType` key §11.2 → resolve `ExtractionSchema` → **VLM extract** via the registry → confidence + review decision → persist `Extraction` in one `$transaction` → meter `WalletUsage.ai_attempts`), with telemetry (classify/extract/total ms, model) and heartbeats. `ReconcilerService` is a **dependency-free interval sweep** (no `@nestjs/schedule` dep) that fails jobs stuck in `processing` with a stale heartbeat. Controller: `POST /intelligence/upload` (multipart — works on local-fs dev), `POST /intelligence/presign` (S3 direct) + `POST /intelligence/sources` (register presigned), `GET /intelligence/jobs/:id`, `GET /intelligence/sources/:id/extraction`, `POST /intelligence/extractions/:id/review` (the Phase-1 review-UI backend, with edit audit trail). Bytes loaded via `readBuffer` (local) or presigned-download `fetch` (S3) — StorageService untouched.
- **NOT done / honest gaps (next phases):** (1) the **OCR/engine accuracy benchmark** (the Phase-0 *exit* number on real Hindi/scanned court docs) was NOT run — needs real fixtures + a provider API key; the engine is built so it's *runnable* (point `intelligence/upload` at a sample with `ANTHROPIC_API_KEY` set). (2) **No live extraction run** here (no key in this session) — DI typechecks/builds but the classify→extract path hasn't executed against a real doc. (3) **Review UI, no-code schema authoring, agentic critic re-verification pass, and DB-backed schema/field-map storage** are **Phase 1** (frontend `apps/app/src/app/features/intelligence/` not started). (4) **RTI + legal-notice ExtractionSchemas/field-maps** not yet authored (only rent + generic). (5) **Citation verification + RAG/embeddings** are Phase 2 (`embed` is a stub). (6) Convert bridge (structured prefill / freeform) is Phase 3.
- **Migration must be `migrate deploy`'d on other environments** (applied here on local dev only).

### 2026-06-10 — Document Intelligence **P4.2**: config-as-data schemas/pipelines + admin authoring portal

Implemented docs/07 **P4.2** (org-scoped DB schemas/pipelines + authoring UI) — make document types, their extraction fields, and the processing **flow** configurable from an admin portal as data, not code. The runtime pipeline engine (P4.1) already executed configurable flows; this adds the **DB-as-source-of-config** layer + the authoring UIs + decouples the classifier candidate set from "has a drafting bundle". Additive — the in-code `@org/doc-intelligence` registry stays as a seed/fallback, the legacy single-doc flow is untouched. Verified: API `tsc` 0 + `nx build @org/api` OK; `@org/app` `tsc` 0 + `nx build @org/app` OK; eslint 0 on all changed files; `@org/doc-intelligence` lint 0; migration applied + re-seed OK; **runtime smoke against live Postgres** (models + mint-new-version precedence + enum-config roundtrip + candidate-key decoupling) passed. **NOT browser-verified** and the HTTP/auth layer of the admin API was not exercised end-to-end (consistent with prior status).

- **New Postgres models** (`tools/prisma/schema.prisma`, migration `20260610071159_pipeline_config_as_data`, applied): `ExtractionSchemaDef` (`Def` suffix to avoid clashing with the TS `ExtractionSchema`; org-scoped via `ownerOrgId String?` null=system-template, versioned `@@unique([ownerOrgId,key,version])`, `documentTypeKey?`), `SchemaField` (key/label/type/required/`reviewMandatory`/`fieldThreshold`/description/example/format + `config` jsonb for enumValues/columns), `FieldMapDef` + `FieldMapEntry` (extraction key → bundle dot-path, versioned). Follows the existing `Pipeline` convention: `ownerOrgId` is a plain nullable string + index, no FK to Organisation. Pipeline/PipelineStage/PipelineRun/StageExecution reused as-is.
- **`SchemaResolverService`** (`apps/api/src/app/intelligence/config/schema-resolver.service.ts`) — the load-bearing seam. `resolveSchema(orgId,key)` / `resolveFieldMap(orgId,key)` / `candidateKeys(orgId,override?)` with **DB-over-code precedence**: org row → system template (`ownerOrgId=null`) → in-code registry → `genericExtractionSchema`. Maps DB rows back into the existing TS shapes so engines/prompt builders/`decideReview` are untouched. **Decouples classifier candidacy from `documentTypeKey`** (was `_registry.classifierCandidateKeys()` filtering those out) so a read-only/admin-authored type with no drafting bundle is still classifiable; a stage's `config.candidateKeys` narrows the set (per-pipeline allowlist). Wired into `PipelineExecutorService` (threaded `ownerOrgId` through `RunContext`; classify/extract/approveRun now resolve via the service) and `PipelineService.classifyDoc(…, candidateKeys?)` (defaults to the registry for the legacy flow). Registered + exported in `IntelligenceModule`.
- **Seed templates** (`tools/prisma/seed.ts`): seeds `ownerOrgId=null` `ExtractionSchemaDef`+`SchemaField`+`FieldMapDef` rows from the in-code registry (rent_agreement / rti / legal_notice / generic_document) — idempotent (findFirst→update/create); orgs clone-on-write later.
- **Admin CRUD API** (`apps/api/src/app/intelligence-admin/`, gated `@UseGuards(RolesGuard) @Roles('admin')`, Zod DTOs via `createZodDto`): `/admin/intelligence/schemas` (+`:key`), `/field-maps/:schemaKey`, `/pipelines` (+`:key`) — list/get/create/update/delete. Operates on the platform/system scope (`ownerOrgId=null`); **an edit MINTS A NEW IMMUTABLE VERSION** (docs §7) so in-flight runs keep their pinned config and the resolver always picks the highest active version. Pipeline stage config carries `engineMode`/`schemaKey`/`candidateKeys`/`autoAdvance{minOverall,minField,requireAllRequired,onFail}`/`targets`. Registered in `app.module.ts`.
- **Admin authoring UI** (`apps/app/src/app/features/admin/intelligence/`): `IntelligenceConfigPage` (admin-gated, Tabs) at route `/admin/intelligence` (+ a "Configure" card on the Admin dashboard). **SchemaManager** — list + field-table editor (key/label/type incl. enum/currency/date/table, required, always-review, format, enum values; reorder; save = new version). **PipelineManager** — compose an ordered, typed stage list (`ingest|classify|extract|validate|review|export`) with add/remove/reorder, per-stage config panels (classify: candidate-type allowlist; extract: engine + forced-type pin; validate: min-overall/min-field/require-all/on-fail review|reject), and a default `classify→review→extract→review→export`-style template. New api-client `intelligence-admin.service.ts` + `createIntelligenceAdminService` wired through `main.tsx`→`ServicesProvider`→`useIntelligenceAdminService`; react-query hooks in `features/admin/intelligence/queries.ts`. New strings wrapped in `t('key','English default')`.
- **NOT done / deferred (honest gaps):** (1) **per-org clone-on-write** — the service takes `ownerOrgId` but the controller uses the platform scope (`null`); true per-tenant authoring (clone defaults to an org's editable rows) is the next step. (2) **No-code DRAFTING bundles** — risks (`RisksFunction` closures), templates (React components), and the Zod draft schema remain code/assets; deriving a draft form from `SchemaField` is a later step. (3) **Runtime per-run type override** (re-extract with a different type at review) — the config-time controls (candidateKeys allowlist + extract `schemaKey` pin) cover "manually set classification/extraction type"; the heavier per-run re-extract was deferred. (4) `fieldThreshold` is stored but not yet wired into `decideReview` (which uses a single global per-field threshold). (5) **Admin HTTP/auth path + browser UI not runtime-verified**; per-stage BullMQ queueing/reconciler, `StageTransition` branching, reviewer assignment, and CSV/JSON/webhook export targets remain docs P4.5+.
- **Migration must be `migrate deploy`'d on other environments + re-seed run** (applied + seeded here on local dev only).

### 2026-06-11 — P4.2 follow-ups: batch pipeline picker, field-map UI, editor UX, open access

Flow/UX upgrades on top of the P4.2 portal. Verified: API `tsc` 0 + `nx build @org/api`; `@org/app` `tsc` 0 + `nx build @org/app`; eslint 0 on all changed files; re-seed OK.

- **Batch pipeline selector (was missing in UI):** `GET /intelligence/pipelines` (JWT, non-admin) via `PipelineExecutorService.listAvailablePipelines()` (seeds default, lists `ownerOrgId=null` active, latest-per-key); api-client `listPipelines()` + `usePipelineOptions()`; BatchesPage now has a Pipeline `<select>` wired through `createBatch({ pipeline })` (backend already accepted `?pipeline`). The single-doc Analyze flow still uses the legacy job path (no pipeline picker — separate code path, left as-is).
- **Default pipeline seeded** (`tools/prisma/seed.ts`, `ownerOrgId=null` `default`) so the admin Pipelines tab + batch picker aren't empty before any on-demand run.
- **Field-map editor (was missing surface):** new `FieldMapEditor` + `useFieldMap`/`useSaveFieldMap`; reachable via a "Mapping" action on each schema row that has a `documentTypeKey` (read-only types show a "nothing to map" note). Maps each extraction field key → bundle dot-path for the export/convert step. Backed by the existing `/admin/intelligence/field-maps/:schemaKey` endpoints.
- **Editor robustness/UX:** replaced the setState-during-render draft-hydration in SchemaManager + PipelineManager with `useEffect`; added inline validation (Save disabled + hint when key/name/fields|stages missing); PipelineManager shows non-blocking structural warnings (no extract / no classify+no forced type / extract-without-ingest); empty-state messages on both lists.
- **Access (temporary, per request):** the admin intelligence portal is open to any authenticated user — controller swapped `@Roles('admin')`→`@UseGuards(JwtAuthGuard)`, the page role-gate removed, and a "Doc config" nav item added for all users. Role system left intact; comments mark exactly how to re-lock. **Re-lock before production.**
- **NOT browser-verified.** Restart the API (guard + endpoint changes) and reload the app.

### 2026-06-11 — Commercial extraction catalog: 24 types / 526 fields seeded

- Ported the full reference `DOCUMENT_TYPE_CONFIGS` catalog into `tools/prisma/seed-data/extraction-types.ts` (data file, like `document-types.ts`/`lookups.ts`): 24 types (SOW, NDA, Contractor, Service Proposal, MSA, MSP, PO, Amendment-to-SOW, Amendment/Addendum-to-Master, Change Order, Engagement Letter, DPA, Hotel/Venue, Insertion Order, Lease, License/SaaS, Master Recruiting, Order Form, Quote, Recruiting Contingent, Recruiting Retained, Sponsorship, Termination/Non-renewal, Other), **526 fields total**. Mapping: reference `name`→`key`, `description`→`label`, kept `type`/`required`/`format`/`example`; every source field was `required:true` so the `f()` helper defaults that. Dates → `type:'date'` with the source ISO format hint.
- `seed.ts` upserts them as **system templates** (`ownerOrgId=null`, version 1, idempotent: delete+recreate fields). They are **read-only extraction types** (`documentTypeKey=null`) — classified + extracted + reviewed, not converted to a draftable doc (no field-map).
- Verified via live DB: 24/24 rows, 526 fields, counts match the source (e.g. sow=27, nda=20, contractor=30, msa=30, dpa=25, other=3). They surface in the admin Schemas tab, the resolver's classifier candidate set (decoupled from `documentTypeKey`), and the extract-stage type pin.
- **Re-seed required on other environments.** US-commercial catalog (the platform is otherwise India-first) — seeded as-is per request; admins can edit/disable any in the portal.

### 2026-06-11 — Config-as-data honored end-to-end (resolver everywhere) + batch routing/funnel/skip

**Two pieces: (A) close the "configured-but-ignored" holes; (B) classification-gated routing + funnel + manual skip.**

**(A) Resolver wired everywhere (no more code-registry bypass).** Audit found values editable in the admin UI that the runtime ignored. Fixed:
- Per-field `fieldThreshold` now honored: added to `ExtractionField` (`libs/doc-intelligence/types.ts`), mapped in `SchemaResolverService.mapField`, and `decideReview` uses `field.fieldThreshold ?? policy.fieldThreshold` (`confidence.ts`).
- `IntelligenceService.getExtraction` + `convert` now resolve schema **and field-map** via `SchemaResolverService` (org-aware), not the code registry — so the 24 DB-only types render their real fields in review, and **admin-authored field-maps are actually used on convert**. Injected the resolver; dropped `getExtractionSchema`/`getFieldMap`/`genericExtractionSchema` code imports there.
- Legacy single-doc `/analyze` (`PipelineService.run`) now classifies against the resolver's org candidate set + resolves the schema via the resolver — same authored catalog as the pipeline flow.

**(B) Batch routing / funnel / skip** (migration `batch_filter_archive`):
- Schema: `PipelineStageType.filter`, `PipelineRunStatus.archived`, `PipelineRun.documentTypeKey` + `archivedReason`.
- Executor: new `filter` stage (keep `allowedTypes`, `minConfidence`; `onUnmatched: archive|reject|review`); `runStage` gained a `terminal` outcome the `run()` loop honors; classify persists `documentTypeKey` on the run; `archiveRun` + `bulkArchive` for manual skip. So 10k docs → classify → keep wanted types → the rest auto-**archived** (no extraction).
- Batch API: `withCounts` adds `archived`; `get()` returns a **funnel** (inProgress/needsReview/completed/archived/failed) + a **classified-type histogram**; controller `POST /intelligence/pipeline-runs/:id/archive` + `POST /intelligence/runs/archive` (bulk), JWT (non-admin).
- UI: pipeline editor gains the `filter` stage (allowed-types multiselect + `onUnmatched` + `minConfidence`, default template `classify→filter→extract→validate→export`, structural warnings); **BatchDetailPage** shows the funnel bar + type histogram with per-type "Skip N", status filter chips, and per-run Skip; BatchesPage shows the archived count.
- **All-user access** (re-confirmed): admin intelligence portal + these archive endpoints are JWT-guarded only (no `@Roles('admin')`); resolver `candidateKeys` works for org-less users via `ownerOrgId=null` templates. Re-lock notes remain in code.
- Verified: API+app `tsc`/`build`, eslint, `@org/doc-intelligence` lint all green; live-DB smoke (filter stage authorable + `archived`/`documentTypeKey`/`archivedReason` persist). **NOT browser-verified; the filter/extract path not run against a live classified doc (needs API key + files).** Migration + re-seed required on other envs; restart API.

### 2026-06-11 — Freeform convert keeps the source document's formatting

- `IntelligenceService.convert` freeform branch now reproduces the **original upload's formatting** instead of a flat field list (`buildSourceHtml`): DOCX → `mammoth.convertToHtml` (headings/bold/lists/tables preserved, sanitized: script/style/img/on*-handlers stripped); PDF/text/scan → escaped `<p>` paragraphs from the stored per-page `normalizedText` with `<div data-page-break>` between pages (PDFs carry no rich layout, so text structure only). Falls back to the existing `buildFreeformHtml` field summary when nothing is recoverable. So an uploaded NDA (a read-only commercial type → freeform) opens in the editor looking like the original, not a label/value dump. Reuses `PipelineService.buildSourceInput` for DOCX bytes + the freeform template's existing `dangerouslySetInnerHTML`/`data-page-break` rendering. API tsc/build/eslint green; **NOT browser-verified.**

### 2026-06-11 — Freeform convert emits `{{token}}` fields, not baked values

- `IntelligenceService.convert` freeform branch now produces an editable-field doc instead of literal values: extracted scalars become `{{field_key}}` placeholders backed by a populated `values` map (the freeform template's existing token mechanism — drives `PlaceholderForm` editable fields + the highlight extension's filled/empty dots; `fillPlaceholders` renders the values back at preview/export). Previously `data.values` was always `{}` and values sat inline as literal text.
- New `tokenizeFields(html, schema, fields)` rewrites the **reproduced-source** path (the common case — DOCX/PDF whose body `buildSourceHtml` recovers): conservative replacement of each scalar value's literal occurrences with its token. Tag-aware (splits on `/(<[^>]+>)/`, only rewrites text nodes — never markup/attrs), exact escaped-string match (no regex/fuzzy, immune to regex injection via split/join), scalars only (arrays/tables stay literal lists — no single-token mapping), longest values first (a short value can't clobber inside a longer one), values <2 chars skipped, and a value that never appears in the source is left untokenized.
- `buildFreeformHtml` (the summary fallback) likewise emits `{{key}}` for scalars + fills the map; arrays remain `<ul>` lists. Both paths now return `{ html, values }`. Added shared `escapeHtml` + `tokenKey` (sanitizes field keys to the placeholder regex charset `[a-zA-Z0-9_]`). Values stored RAW (unescaped) — `fillPlaceholders` escapes at render.
- No editor/Document/template changes — purely the convert assembly. API `nx build @org/api` (tsc) + `nx lint @org/api` green (only pre-existing warnings in mail/storage). **NOT browser-verified** — needs a live classified+extracted doc converted through the editor.

### 2026-06-11 — Review queue scoped per-batch (no more mixing across batches)

- The review queue was a single global list: `PipelineExecutorService.reviewQueue(userId)` queried every `needs_review` run for the user with no `batchId` filter, so docs from different batches (and standalone uploads) were intermingled. Now scopable to one batch.
- Backend: `reviewQueue(userId, batchId?)` adds `...(batchId ? { batchId } : {})` to the `where`; controller `GET /intelligence/review-queue` accepts `@Query('batch')`. Omitting `batch` keeps the old global behavior (everything).
- api-client: `getReviewQueue(batchId?)` passes `?batch=` when given.
- Frontend: `useReviewQueue(batchId?)` (scoped query key `[...reviewQueue, batchId ?? 'all']`); `useApproveRun(batchId?)` also invalidates `batch(batchId)` so the source batch's counts/funnel refresh after approve (review-queue invalidation is prefix-matched, so scoped keys clear too). `ReviewQueuePage` reads `?batch=` via `useSearchParams`, scopes the list, shows the batch name in the subtitle, and adds a "Back to batch" link. `BatchDetailPage`'s "Review queue" button now links to `/review-queue?batch=<id>` instead of the global `/review-queue`.
- The global queue (nav link, no `?batch=`) still shows all items — only the per-batch entry point is scoped. `build`+`lint` green for `@org/api`, `@org/app`, `@org/api-client` (only pre-existing warnings). **NOT browser-verified.**

### 2026-06-11 — Converted freeform docs carry TYPED fields (date/number/select), not just text

- Converted docs surfaced every `{{token}}` as a generic text input: `synthesizeTemplate` hardcoded `placeholders: []`, so all tokens fell through PlaceholderForm's "Custom Fields" → plain `<Input>`. PlaceholderForm already supports `text/textarea/number/date/select/email`; it was just never given defs. Now convert derives typed defs from the extraction schema's field types and carries them to the editor. **Scope = "auto only" (per user): no new config UI — field types come from the extraction schema, which is already per-doc-type editable in the admin Schemas tab.** (The field-map can't drive this — it's pure key→dot-path strings with no type info; types live on `ExtractionField`.)
- Type mapping (`IntelligenceService.fieldDef`): `date→date`, `number→number`, `boolean→select(Yes/No)`, `enum→select(enumValues)`, `currency→text`(+`format` hint), `string→textarea` if value >80 chars or multiline else `text`, `*email*` key→`email`. `table` fields never reach it (rendered as literal `<ul>` lists).
- Plumbing:
  - lib `FreeformData` gains optional `fields?: FreeformFieldDef[]` (new structurally-PlaceholderDef-mirroring type; no migration — Document `data` is permissive JSON). API keeps a local `FreeformFieldDef` mirror so it never imports the React template lib.
  - `convert` freeform branch: both `buildFreeformHtml` (summary) and `tokenizeFields` (reproduced-source) now return `{ html, values, fields }` and write `data.fields`. Defs emitted only for tokens that actually landed in the body (`tokenizeFields` filters to `values` keys).
  - app: `EditorPersistence.bound.initial` + `EditorDraftState` gain `fields?: PlaceholderDef[]`; `synthesizeTemplate` uses `init.fields ?? []` for `placeholders`; bound autosave snapshot persists `template.placeholders` (added to the effect dep array); `DraftEditorPage` reads/writes `data.fields`. Tokens without a def still fall through to custom text inputs (e.g. new tokens the user types).
- `build`+`lint` green for `@org/api`, `@org/app`, `@org/document-templates` (only pre-existing warnings; the one new dep-array warning I introduced was fixed). **NOT browser-verified** — needs a live extract→convert→editor round-trip; current seeded catalog only exercises `string`/`date` (no enum/number/boolean/currency fields yet), so select/number inputs are untested against real data.

### 2026-06-11 — Intelligence/docs control plane: manual type override, soft-disable, card actions (resumable task graph)

Large multi-part pass (config-driven, no hardcoded type/field lists). Tracked as Claude tasks #3–#15 with a dependency graph so it's resumable. **Backend `nx build @org/api` green; `nx build @org/ui` green; `@org/app` JS bundle (vite) + `nx lint @org/app|@org/api` green (0 errors).** Pre-existing `vite:dts` `--jsx` errors in untouched files (app.tsx, EditorToolbar, main.ts) — workspace dts-config issue, NOT from this work. **NOT browser-verified; API restart + (already-applied) migration required.**

**(1) Manual type override / re-process (the 'always manually process Other/Generic' ask).** The field-map can't carry types (it's key→path only) — types live on `ExtractionField`, already per-doc-type editable in the admin Schemas tab; that's the config surface.
- `SchemaResolverService.listSchemas(orgId)` — active schemas (org-over-system, latest version, generic excluded) → `IntelligenceService.listSchemas` → `GET /intelligence/schemas` (JWT). Config-driven picker source.
- `PipelineExecutorService.reprocess(userId, sourceDocumentId, schemaKey)` → `POST /intelligence/sources/:id/reprocess` (`ReprocessDto`). Validates schemaKey against the resolver (no silent generic fallback), re-extracts with the FORCED schema (no classification, reuses stored `normalizedText` or re-parses), writes a new (latest) Extraction, and re-parks the latest run at the pre-export stage so approve→export uses it. Clears prior archive/error.
- UI: `ReviewExtraction` gains a type Select (from `useSchemaOptions`) + 'Re-process as type', emphasized when generic/unclassified; re-seeds the field editor when the extraction swaps. `BatchDetailPage` per-run: inline Approve (needs_review) + a 'Process as…' dropdown of schemas (archived/failed/generic/misclassified). Hooks `useSchemaOptions`/`useReprocess`/`useReprocessRun`.

**(2) Soft-disable (proper toggles).** Pipeline.active / ExtractionSchemaDef.isActive / DocumentType+Template.isActive already existed + runtime-filtered; gaps filled:
- Migration `schema_field_is_active`: `SchemaField.isActive` (default true). Resolver `findSchemaDef` now `where:{isActive:true}` on fields → inactive fields aren't extracted/validated/reviewed/converted. Admin `getSchema` still returns all fields (so the editor can toggle); save round-trips `isActive` (DTO + `toFieldRow`/`toFieldDto`).
- Admin: `activateSchema`/`activatePipeline` + `setSchemaActive`/`setPipelineActive`; `listSchemas/listPipelines(includeInactive)` returning `isActive`; routes `POST /admin/intelligence/{schemas,pipelines}/:key/activate` + `?includeInactive=true`.
- UI: SchemaManager + PipelineManager now have a 'Show disabled' toggle, dim inactive rows with Enable/Disable (replacing the mislabeled one-way Delete), and SchemaManager has a per-field 'Enabled' checkbox.

**(3) Card actions + filters.** `POST /documents/:id/duplicate` (clone → 'Copy of …', user-owned draft, quota-checked) + `duplicate()`/`useDuplicateDocument`; `useRenameDocument`. Shared `Chip` extracted to `@org/ui` (BatchDetailPage now uses it). `DocumentsList`: per-card DropdownMenu (Open/Rename/Duplicate/Share/Version history/Delete via existing ShareDialog+VersionHistoryDialog+confirm) + status/type filter chips + title search + rename dialog. `BatchesPage`: status filter chips + search (no batch delete/rename endpoint exists — batches are processing artifacts; runs already have archive — so cards stay open-only; flagged as a possible follow-up).

**Resume pointer:** all of #3–#15 completed this session. Open follow-ups (not started): batch delete/rename endpoint+UI; doc-type/template active-toggle admin UI (endpoints not added — only schema/pipeline); seed a few enum/number/currency fields to exercise typed freeform inputs end-to-end; fix the pre-existing app `vite:dts` `--jsx` config error.

### 2026-06-11 — Admin: keep BOTH Disable + Delete; declutter rows into kebab menus (#16–#18)

- Wanted both soft-disable AND a real delete. Added **hard-delete** alongside the existing soft-disable: `IntelligenceAdminService.purgeSchema`/`purgePipeline` (deleteMany all versions) → `DELETE /admin/intelligence/{schemas,pipelines}/:key/purge`. Schema purge is FK-safe (Extraction.schemaKey is a string; SchemaField cascades). Pipeline purge is **refused with Conflict if any PipelineRun references a version** (pipelineId is Restrict) — disable instead to keep run history. api-client `purgeSchema/purgePipeline` + `usePurgeSchema/usePurgePipeline`.
- UI/UX cleanup: SchemaManager + PipelineManager list rows collapsed their inline buttons (Edit / Mapping / Enable-Disable) into a single **kebab `⋯` DropdownMenu** per row now containing Edit, Mapping (schemas with a drafting key), Enable/Disable (soft), and **Delete** (hard purge, destructive confirm). Inactive rows stay dimmed with a 'disabled' badge. Distinct confirm copy for Disable (reversible) vs Delete (permanent).
- `nx build @org/api` + `@org/app` green; `nx lint @org/app|@org/api` 0 errors. **NOT browser-verified.**

### 2026-06-11 — Admin rows: inline icon buttons (eye toggle) instead of kebab dropdown

- Per feedback (kebab looked off / centered). New `features/admin/intelligence/icons.tsx`: inline-SVG `EditIcon/MapIcon/EyeIcon/EyeOffIcon/TrashIcon` (repo convention — no icon lib) + a compact `IconButton` (title/aria, ghost hover, `danger` variant). SchemaManager + PipelineManager rows now show a right-aligned `flex items-center gap-0.5` group of icon buttons: Edit (pencil), Mapping (schemas w/ drafting key), **Eye = enabled→click disables / EyeOff = disabled→click enables**, Trash (delete, destructive confirm). Disable is now immediate (reversible, no confirm); only hard-delete confirms. `@org/app` build + lint green.

### 2026-06-11 — Batches + Review queue redesigned as a dashboard (matched Dashboard.tsx style)

Feedback was the batch/review UI felt rough. Rebuilt both to the app's existing house style (studied `features/dashboard/Dashboard.tsx`: `rounded-xl` cards, `size-9` icon chips, `text-lg` section headers, `space-y-8`, semantic tones).
- New `features/intelligence/icons.tsx`: inline-SVG `Layers/Inbox/CheckCircle/Clock/Archive/Alert/FileText/Upload/ArrowRight` (className-able).
- **BatchesPage**: KPI tile row (In progress/To review/Completed/Archived/Failed, aggregated across batches, each a tinted icon chip + number + label via `StatTile`); upload card with an icon header; a filter toolbar (search + status chips); and richer batch cards (`BatchCard`) — Layers chip, name+date, status badge, a 5-segment progress bar (done/review/in-progress/archived/failed), an icon-count breakdown, and a per-batch **Review {n}** button → `/review-queue?batch=:id` (batch-wise review entry).
- **ReviewQueuePage**: icon-chip header with a live count + batch context, skeleton loading, item rows as `rounded-xl` cards (FileText chip, filename, type, confidence badge, Review→ link with arrow, Approve), and a friendly "All caught up" empty state.
- **BatchDetailPage**: Review-queue button gains the Inbox icon + count.
- Tones use proven semantic utilities (`bg-info/15 text-info`, `bg-success/15 text-success`, `bg-warning/15`, `bg-error/15`, `bg-foreground/10`). `@org/app` build green; lint 0 errors (only pre-existing warnings). **NOT browser-verified — needs an eyeball.**

---

## 2026-06-12 — Strategic roadmap & market review (docs/08)

- Wrote [`docs/08-strategic-roadmap.md`](08-strategic-roadmap.md): market analysis (independently
  re-verified via web), honest code-vs-docs audit, and an **inverted roadmap** keyed to the one
  hard fact — ~95% code-complete, **runtime-unverified**, zero users.
- **Market verification (2026-06-12):** India legal-AI $29.5M→$106.3M / 23% CAGR confirmed (2.0%
  of global). Ecosystem grew **662→960 companies**, +781% YoY funding 2025. **SpotDraft now
  >$113M raised** ($54M Series B + $8M Qualcomm ext.), **FY25 rev ₹121 Cr vs loss ₹121 Cr** (1:1
  burn = monetization is brutal). Vakilsearch → **Zolvit**. **BharatLaw.ai** is an adjacent AI-
  drafting entrant. Honest 3-yr ceiling (₹15–80 Cr) stands / optimistic.
- **Code audit correction:** there are now **4 real `DocumentTypeBundle`s**, not 1 —
  `rent-agreement` (711 LOC), `legal-notice` (472), `rti` (373), `affidavit` (330), each with
  full schema/form-metadata/prompts/risks + a registered template. The bundle abstraction is
  **validated at code level**. (Docs/memory previously said "one doc type end-to-end.")
- **Roadmap thesis:** Phase 0 VERIFY (browser-walk rent + doc-intelligence flows, log bugs) →
  Phase 1 rent wedge + **server-side citation validator (the real moat; currently asserted, not
  enforced)** + Schedule-1 hard-gate + DOCX → Phase 2 **10 paying users** → Phase 3 notice/§138 →
  Phase 4 doc-intelligence monetized. All 3 wedges in scope but **sequenced, not parallel**
  (documented why parallel fails for a tiny team given SpotDraft's 1:1 burn).
- Frozen until paying users: marketplace, white-label, PWA/offline, configurable pipelines
  (docs/07 P4.2+), OCR benchmarking, 5th+ doc type.
- No code changed this session — analysis + docs only.

---

## 2026-06-12 — Preset upgrade + convert-to-document quality fix

**Freeform "Draft with AI" presets (`@org/legal-reference`)**
- Future-proofed `DocumentPreset`: added optional `applicableLaw` (display chip),
  `tags` (search synonyms), `popular`, `structuredTypeKey` (nudge toward a real bundle).
  Did NOT duplicate eSign-exclusion — that stays in `schedule1.ts` (`isESignExcluded`).
- Enriched all existing presets (richer sampleBriefs, applicableLaw, citationTopics) and
  added ~22 new Indian docs across a new **HR & Corporate** category plus Notices/
  Court Filings/Affidavits/Agreements/Personal/Information: eviction & termination & public
  notices; mutual-divorce, maintenance (BNSS §144), domestic-violence (PWDVA); name-change/
  income/gap affidavits, indemnity bond; service/loan/leave-licence/sale agreements,
  promissory note; offer/appointment/experience letters, board resolution; NOC; RTI first
  appeal. Added `presetsByCategory()` (popular-first).
- Added matching `COURT_SCAFFOLDS` (apps/api `legal-ai/court-scaffolds.ts`) for every new
  key so AI output is shaped (agreement/notice/affidavit/court-filing variants), and wired
  the new `HR & Corporate` category into `DraftWithAIPage`.

**Convert-from-extraction → freeform document quality (bug reported by user)**
- Symptom: converted docs rendered as a key/value dump and every scalar became an editable
  placeholder field. Root cause: `IntelligenceService.buildFreeformHtml` (the fallback used
  when the original text/layout can't be recovered, e.g. scanned PDF) emitted
  `<strong>Label:</strong> {{token}}` per field + registered each as a `FreeformFieldDef`.
- Fix: rewrote the fallback to compose a clean grouped document — values BAKED IN as text
  (no `{{tokens}}`), fields grouped into titled sections by key prefix, empties dropped,
  arrays as ordered lists, and **zero** placeholder fields registered (`values`/`fields`
  empty) so the editor opens prose, not a form. The "source recoverable" path
  (`buildSourceHtml`→`tokenizeFields`, which reads like the original upload) is unchanged and
  remains preferred. Updated the now-inaccurate `convert()` comment.
- Verified: `@org/app` typecheck ✓, `legal-reference` tsc ✓, `@org/api` build ✓, lint 0 errors
  (10 pre-existing warnings in untouched files). NOT browser-verified.
- DEFERRED (asked user): structured NDA + Promissory Note `DocumentTypeBundle`s (tasks open).

### 2026-06-12 (follow-up) — convert fallback now composes a sectioned document

- Two user screenshots (NDA + SOW, both "signed"/scanned PDFs, no text layer) showed the
  OLD `buildFreeformHtml` output: `<strong>{label}:</strong> {{camelCaseToken}}` per field +
  a 20–27 field panel (tokens are the generic extraction-schema keys in
  `tools/prisma/seed-data/extraction-types.ts`). Confirms (a) the running API predates the
  fix and existing docs are frozen with old HTML, and (b) snake_case-prefix grouping was
  useless for these camelCase schemas.
- Rewrote `IntelligenceService.buildFreeformHtml` to compose a real document: short scalars
  (title/dates/parties/refs) → a compact top "particulars" block (`Label: value`); long /
  sentence-ish values (scope, background, clauses — already prose) → `<h2>Label</h2>` +
  paragraph sections; arrays → headed ordered lists. Values BAKED as text, zero placeholder
  fields. Reads like the original SOW/NDA instead of a fill-in form.
- ⚠️ Requires API rebuild + restart to take effect; ALREADY-converted docs keep their old
  saved HTML — user must RE-CONVERT them. Deeper "looks exactly like original" path
  (`buildSourceHtml`→`tokenizeFields`) only fires when there's a recoverable text layer;
  scanned/signed PDFs need OCR (vision) to populate `normalizedText` for that path.
- Verified: `@org/api` build ✓, lint 0 errors (6 pre-existing warnings).

---

## 2026-06-12 (autonomous batch) — 4 new structured types, global+India presets, Templates UX

User directive: keep adding templates (India + global), more AI presets, and improve the
Templates page UX — "do not pause, I will not be around." Delivered in one verified batch.

**New structured DocumentTypeBundles (full: schema + form-metadata + prompts + risks + index +
page-faithful React template + _registry + seed):**
- `nda` — Non-Disclosure Agreement (mutual/one-way; Indian Contract Act 1872). Template
  branches obligations on `agreement.mutual`; numbered clauses (definition/exclusions/
  obligations/term+survival/return/remedies/governing law/general) + signature & witness blocks.
- `promissory_note` — NI Act 1881 §4. Classic single-paragraph instrument with amount-in-words,
  optional interest, demand/fixed-date term, revenue-stamp box. Added to `ESIGN_EXCLUDED_KEYS`.
- `employment_offer` — India + global (currency enum INR/USD/EUR/GBP/AED/SGD; optional at-will,
  with a risk flagging at-will+INR). Letter format with compensation + numbered terms + accept blocks.
- `power_of_attorney` — General/Special (Powers-of-Attorney Act 1882). Deed format, powers list,
  ratification + duration + witnesses + registration/eSign-exclusion note. Added to `ESIGN_EXCLUDED_KEYS`.
- Bundle draft schemas use shallow `Schema.partial()` (top-level sections optional) to satisfy the
  `DocumentTypeBundle<Partial<T>>` generic — matching the legal-notice pattern (deep-partial breaks it).

**Freeform AI presets — big expansion (`@org/legal-reference`):** added a `Business` category and
~30 presets (global-friendly + Indian): invoice, quotation, SOW, privacy policy, terms of service,
refund policy, DPA, term sheet, meeting minutes; consulting/MSA/SaaS/employment/non-compete (with
§27 caution)/shareholders/sale-of-goods agreements; internship/termination/resignation/
recommendation/warning letters; authorization letter, rent receipt, relinquishment deed. Each with
applicableLaw/tags and a matching `COURT_SCAFFOLDS` entry (AGREEMENT/LETTER/POLICY/specific).
Wired `Business` into `DraftWithAIPage`; linked offer-letter→employment_offer, gpa→power_of_attorney.

**Templates page UX (`TemplatesPage.tsx`):** added a search box (name/description/category) and
category-filter chips (derived from the catalog) with an empty state. Uses `@org/ui` Input.

- Verified: legal-reference tsc ✓ · @org/app typecheck+lint ✓ (0 errors) · @org/api build+lint ✓
  (0 errors) · document-schema/document-templates lint ✓. NOT browser-verified.
- ⚠️ The 4 new structured types appear in the Templates catalog only after a DB RE-SEED
  (`/documents/catalog` reads DB rows from `tools/prisma/seed-data/document-types.ts`). Run the
  project's prisma seed + restart API. Freeform presets need only an API restart (static import).

---

## 2026-06-12 (next phase) — Schedule-1 signing gate + NDA convert→structured

Closing roadmap gaps. (Note: server-side citation validation was already wired — legal-ai
generate/revise scan the AI HTML via `citationWarnings` and return them; the docs/08 "asserted
not enforced" line is now stale. Left as-is; it's enforced.)

**Schedule-1 eSign hard-gate (`apps/api/.../signers/signers.service.ts`):** `assertAccess` now
includes `documentType`; new `assertESignAllowed()` throws `ForbiddenException(SCHEDULE_1_NOTE)`
when `isESignExcluded(doc.documentType?.key)`. Gated in `add()` (adding signers) and `sign()`
(recording a signature). So wills, PoAs, trusts, promissory notes and immovable-property
conveyances can't be e-signed in-app (IT Act 2000 Schedule 1) — must be wet-signed. Read paths
(list) remain open.

**NDA extraction → structured convert (`libs/doc-intelligence/src/schemas/nda.ts`):** registered
`ndaExtractionSchema` (key `nda`, `documentTypeKey: 'nda'`, the 20 camelCase fields) + `ndaFieldMap`
mapping the clean scalars (effectiveDate→agreement.effectiveDate, purposeOfDisclosure→
agreement.purpose, disclosing/receivingParty[Address]→partyA/partyB.name/address, governingLaw→
governing.state). Prose clause fields (definition/obligations/remedies/etc.) and free-text
enum-ish fields (ndaType/disputeResolution) are intentionally UNMAPPED — the structured `nda`
template authors that clause language. Imported in doc-intelligence index for side-effect
registration. Removed the duplicate read-only `nda` from `tools/prisma/seed-data/extraction-types.ts`
(the catalog loop runs after the registry loop and would have reset documentTypeKey→null,
defeating the routing). Result: a reviewed NDA now converts via the structured path
(documentTypeKey + fieldMap + template) into a real templated NDA, not a freeform dump.

- Verified: @org/api build ✓, lint ✓ (0 errors, 6 pre-existing warnings); @org/doc-intelligence
  lint ✓. NOT browser/runtime-verified.
- ⚠️ Needs a DB RE-SEED for the NDA routing (extractionSchemaDef `nda` must carry documentTypeKey
  'nda' + the fieldMapDef) and an API restart for the signing gate.

---

## 2026-06-12 (next phase) — Invoice doc type + DB-lookup migration of all option-sets

**Invoice (full structured `DocumentTypeBundle`, key `invoice`):** schema (line items, GST/single/
none tax, inclusive/exclusive pricing, per-line + invoice-level discount, shipping, round-off,
amount-paid, multi-currency, seller/buyer with GSTIN/PAN/state, payment + notes) + form-metadata +
prompts (terms assist) + risks (GSTIN presence/format, place-of-supply inter-state, due<date,
reverse-charge, etc.) + index + a COMPUTING page-faithful template. The template derives every total
from the items so they can't drift: per-line taxable/tax (incl/excl), proportional invoice-level
discount, intra-state CGST+SGST vs inter-state IGST (seller state vs place-of-supply/buyer state),
round-off, balance due, a rate-wise GST tax-summary table, and amount-in-words (INR). Registered in
document-schema index + _registry + seed (sortOrder 90).

**LookupGroup/LookupValue migration (user request):** moved EVERY hardcoded `select` option-set in the
doc-type forms to DB lookups (the `lookup` widget + `lookupKey` were already fully wired:
GET /lookups → useLookupOptions() → BuilderForm resolves). 
- Seed (`tools/prisma/seed-data/lookups.ts`): FIXED `currency` to uppercase ISO codes (was lowercased
  by `toValues`) + added AED/SGD, built literally. Added 18 groups: party_relation (literal, S/o…C/o),
  paid_by, entity_type, employment_type, pay_frequency, dispute_resolution, invoice_tax_mode,
  rent_property_type, rent_furnishing, affidavit_id_type, affidavit_attestation, notice_type,
  notice_delivery_mode, poa_type, duration_type, payable_on, rti_info_format, rti_fee_mode. All values
  EXACTLY match the Zod enums.
- Forms: replaced `widget:'select', options:[…]` with `widget:'lookup', lookupKey:'…'` across invoice,
  nda, legal-notice, affidavit, employment-offer, promissory-note, power-of-attorney, rent-agreement,
  rti — removed all inline option arrays + the PARENT_RELATION/PAID_BY/ENTITY_OPTIONS/RELATION_OPTIONS/
  CURRENCY_OPTIONS consts + now-unused FieldOption imports. No `widget:'select'` remains in doc-schema.
- Widened the 3-value `parentRelation` enums (rent/affidavit/rti) to include 'C/o' so the shared
  `party_relation` lookup (4 values) is valid everywhere.
- Verified: @org/app typecheck ✓, @org/api build ✓, lint 0 errors. NOT runtime-verified.
- ⚠️ Needs DB RE-SEED (lookups + doc types). NOTE: lookup seeding is add-only — if a dev DB already
  has the OLD lowercase `currency` values, clear that group first or it will contain both cases.

---

## 2026-06-12 — Admin Lookup management UI

Full CRUD UI for the DB-backed lookups that drive form dropdowns.
- **API (`apps/api/.../lookup`)**: added the missing admin endpoints (inline body types, RolesGuard
  admin, matching existing style): `GET /lookups/admin` (all groups incl. non-public + inactive
  values; declared BEFORE `:key` so the literal wins), `PATCH /lookups/:groupId` (update group),
  `DELETE /lookups/:groupId` (deletes the group + its values in a transaction). Service gained
  `updateGroup`/`deleteGroup`. (create-group, add/update/delete-value already existed.)
- **api-client (`lookups.service.ts`)**: added `isPublic` to `LookupGroup`; new payload types
  (Create/UpdateLookupGroupPayload, Add/UpdateLookupValuePayload) and admin methods getAllAdmin,
  createGroup, updateGroup, deleteGroup, addValue, updateValue, deleteValue.
- **Frontend (`apps/app/.../admin/lookups`)**: `queries.ts` (useAdminLookups + create/update/delete
  group + add/update/delete value mutations; each invalidates the admin list AND the public
  ['lookups'] cache the builder uses). `LookupManager.tsx`: groups DataTable (name/key/value-count/
  visibility + manage/delete), RHF+zod create-group form (with applyServerFieldErrors), and a
  per-group editor — editable meta (name/description/isPublic) + a values table with inline
  label/value/order edit (save on blur), enable/disable toggle, delete, and an add-value row.
- **Wiring**: added a third "Lookups" tab to the Document-Intelligence `ConfigShell`
  (`LookupsPage`), route `/admin/intelligence/lookups` in app.tsx, and a sidebar NavItem (+ListIcon).
- Verified: @org/api build ✓, @org/app typecheck ✓, lint 0 errors across app/api/api-client. NOT
  runtime-verified. (Admin endpoints are role-gated server-side; the admin section is currently
  open to any authed user on the client, same as the other intelligence-config pages.)

---

## 2026-06-12 — Fix: API not hot-restarting in `pnpm dev`

Root cause: `apps/api` `serve` used `@nx/js:node`, which only restarts Node when its
**buildTarget runs in watch mode** — but `build` is a one-shot `nx:run-commands` `webpack-cli build`
(no watch). So `pnpm dev` built the API once, ran it, and never rebuilt on source edits.
(Also: `NxAppWebpackPlugin` requires Nx task env vars — it only loads when run THROUGH nx, not via a
bare `webpack-cli` call.)

Fix:
- `serve` → `nx:run-commands`, `parallel`, two long-running commands:
  `NX_TASK_TARGET_TARGET=build webpack-cli build --node-env=development --watch` (rebuilds the bundle
  on change) + `node --watch --enable-source-maps ../../dist/apps/api/main.js` (restarts Node when the
  bundle changes). `dependsOn: ["build"]` seeds an initial `main.js` so `node --watch` doesn't start
  before the file exists. The explicit `NX_TASK_TARGET_TARGET=build` makes the plugin resolve the
  build target (the serve task would otherwise set it to `serve`).
- `webpack.config.js`: `output.clean` is now `process.env.NODE_ENV === 'production'` only — so dev
  `--watch` rebuilds overwrite `main.js` in place rather than wiping the dir (which would make
  `node --watch` see the file vanish mid-rebuild). Prod build still cleans.
- Verified: `nx run @org/api:build:development` ✓; `nx run @org/api:serve` boots — webpack dev watch
  compiles, type-check passes, Nest app starts; webpack + node watchers run in parallel.

---

## 2026-06-12 — API hot-reload: canonical fix (supersedes the run-commands one above)

The earlier run-commands `serve` workaround was reverted in favour of the standard Nx setup (matching
another project's `server` target). Root cause restated: `@nx/js:node` serve only hot-restarts when
its `buildTarget` runs in WATCH mode, which it can only do for a watch-capable build executor. The
`build` target was `nx:run-commands` (`webpack-cli build`, one-shot) → not watchable → no restart.

Fix:
- `apps/api` `build` → `@nx/webpack:webpack` executor (target node, compiler tsc, outputPath
  dist/apps/api, main/tsConfig/assets/webpackConfig, optimization:false, outputHashing:none,
  generatePackageJson:false, sourceMap:true; `development` config sets skipTypeChecking).
- `apps/api/webpack.config.js` → `composePlugins(withNx(), cfg => …)` form (the executor applies the
  Node build from project.json options; replaces the standalone `NxAppWebpackPlugin` object).
- `serve` left as `@nx/js:node` + `buildTarget @org/api:build:development` — now watch-capable, so it
  rebuilds + restarts on source edits with no further change.
- Verified: `nx build @org/api` (prod) ✓ main.js emitted; `nx run @org/api:serve` boots, and touching
  a source file triggers a webpack recompile + Nest restart (observed live).

## 2026-06-13 — Fix: lookup admin endpoints 403

`GET /api/lookups/admin` (and the lookup write endpoints) used `@UseGuards(RolesGuard) @Roles('admin')`,
but users default to role `user`, so the Lookups admin UI got 403. The rest of the admin config UI
(Document types / Pipelines via `IntelligenceAdminController`) is intentionally open to any
AUTHENTICATED user (role-gate removed for now). Aligned `LookupController` to the same policy: class-
level `@UseGuards(JwtAuthGuard)`, removed per-method `RolesGuard`/`@Roles('admin')` (public GET / and
GET :key unchanged). Role system intact — re-add RolesGuard/@Roles to lock down. Build ✓.

---

## 2026-06-13 — Receipt doc type + template→freeform converter + lookup duplicate

**Lookup duplicate:** added `useDuplicateGroup` (client-side clone via existing createGroup +
addValue endpoints — no backend change) and a Duplicate (CopyIcon) action in `LookupManager`. Clones
a group as `{key}_copy` (uniquified) + `{name} (copy)` with all values copied in order. "Easier to
create a similar set."

**Receipt (structured + freeform):** full `DocumentTypeBundle` `receipt` — schema (payer/payee/
payment{amount,towards,mode,reference,part-payment+totalAmount}/notes, currency lookup) + form-metadata
(mode→new `payment_mode` lookup) + prompts + risks + index + computing template (`receipt.standard`:
"Received with thanks…", amount in words for INR via `formatMoney`+`formatINRWords`, optional balance,
signatory). Registered in document-schema index + _registry + seed (sortOrder 95). Added freeform
preset `payment-receipt` (Business) + scaffold; new `payment_mode` lookup group seeded. Extracted
reusable `formatMoney(amount,currency)` into `_internals/format.ts`.

**Template → free-form converter (one-way "eject"):** `BuilderShell` "Edit as free-form" button →
confirm → `renderToStaticMarkup` of the registered template with current `draft` data (no edit
provider, so values bake in) → take the Paginator hidden-mirror's innerHTML as the clean body → create
a `freeform` Document (`data.html`) → navigate to `/documents/:id/draft`. One-way by design (prose
can't be parsed back to typed fields); confirm dialog states it leaves the guided form/risks/recompute.
Reusable for every structured type.

- Verified: @org/app typecheck ✓, @org/api build ✓, lint 0 errors (10 pre-existing warnings). NOT
  runtime-verified. Needs DB re-seed for the `receipt` type + `payment_mode` lookup.

## 2026-06-13 — Financial-document family (Tier-1) + Payslip + Will

Implemented five new structured `DocumentTypeBundle`s (schema + form-metadata + prompts + risks + index)
plus a standard computing template for each, all registered in document-schema `index.ts`, the templates
`_registry.tsx`, the seed `document-types.ts`, and where relevant the freeform presets + court scaffolds.

Shared infra (extracted last session) reused by the invoice family: `_internals/invoice-compute.ts`
(`computeInvoice`, `makeMoney`, cell styles) and `_internals/invoice-parts.tsx` (`ItemsTable`,
`TotalsBlock`, `TaxSummary`). Added to invoice-parts: `PartyBlock` + `partyLines()` helper for
seller/buyer/vendor address blocks. Shared form fields via `_shared/commercial-fields.ts`.

- **quotation** (`quotation.standard`): priced proposal; invoice engine + `validUntil`, no payment/balance.
  Quote-terms AI assist (`quotation.terms`). Preset `quotation` got `structuredTypeKey`.
- **purchase_order** (`purchase-order.standard`): buyer→vendor order; `requiredBy`/`shipTo`; PO-terms
  assist. New preset `purchase-order` + scaffold.
- **credit_note** (`credit-note.standard`): credit/debit note vs an original invoice; `noteType` via new
  `credit_note_type` lookup; reason + original-invoice reference; figure-driven (no AI prompts). New
  preset `credit-note` + scaffold.
- **payslip** (`payslip.standard`): own compute (gross − deductions = net, INR in words); flexible
  earnings/deductions component arrays (India PF/ESI/PT/TDS or global); side-by-side table. New preset
  `payslip` + scaffold.
- **will** (`will.standard`): last will & testament; numbered declaration/revocation/executor/bequests/
  residue/guardian/funeral + two-witness attestation; risks enforce ≥2 witnesses (ISA 1925 §63) and
  flag Schedule-1 (not eSignable — already in `ESIGN_EXCLUDED_KEYS`). Bequest-phrasing AI assist only
  (never authors who-inherits or statutory text). Preset `will` got `structuredTypeKey`; `will` scaffold
  already existed. Also added `structuredTypeKey: 'invoice'` to the invoice preset.

Seed additions: 5 document types (sortOrder 96–99) + 1 lookup group (`credit_note_type`).

- Verified: @org/app typecheck ✓ (transitively typechecks templates + schema via the registry),
  @org/api build ✓, lint 0 errors on document-schema/document-templates/legal-reference/api/app
  (pre-existing warnings only). NOT runtime-verified. Needs DB re-seed for the 5 new types + the
  `credit_note_type` lookup.

## 2026-06-13 — Server-side pagination (documents + batches), config layout, page-size dropdown

User flagged that list tables paginate/sort/search CLIENT-side only (DataTable over a pre-fetched
array) — a real bug at scale for the unbounded, per-user tables.

- **DataTable** (`@org/ui`): added an opt-in `server` mode (`DataTableServer`: page/pageCount/total/
  onPageChange + sort/onSortChange + query/onQueryChange + pageSize/onPageSizeChange + loading). When
  set, internal filter/sort/slice is bypassed and `data` is the current page. Backward-compatible — the
  3 config tables (schemas/pipelines/lookups) stay client-side (small, system-owned). Added a **page-size
  dropdown** (`pageSizeOptions`) rendered in the footer via the @org/ui Select.
- **Documents** (THE per-user growth table; server cursor pagination existed but was unused): rewrote
  `documents.service.list` → offset pagination + `count`, title search (`q`), and sort
  (title/type/status/updated/created) → returns `{ items, total }`. DTO/api-client updated. New
  `useDocumentsPage` hook (keepPreviousData); `useDocumentList` kept (unwraps `.items`) for the dashboard
  "Recent". `DocumentsList` now fully server-driven: page/sort/search + status (static enum) & type
  (from catalog) facets all hit the server; default pageSize 50, options [10,25,50,100,200].
- **Batches**: was hard-capped at `take:50` (silent truncation). Found `Batch.status` is written once
  (`running`) and never updated — status is derived in `withCounts`. Per user's choice, **persisted real
  status**: extracted `batch-status.ts` (`deriveBatchCounts`/`deriveBatchStatus`/`bucketTotals`), made
  `withCounts` use it, and added `recomputeBatchStatus(batchId)` in the executor, called at every run
  lifecycle endpoint (run() terminal/park/fail/complete, approveRun success+fail, archiveRun, reprocess).
  `batch.service.list` → offset pagination + name search + sort(name/status/created) + `{ items, total,
  totals }` where `totals` is a `pipelineRun.groupBy` across ALL the user's runs (KPI tiles stay correct
  regardless of page). New `ListBatchesQueryDto`; controller `@Get('batches')` takes `@Query`. api-client
  `listBatches(q)` → `{items,total,totals}`; `useBatches(params)` (keepPreviousData, 5s refetch kept).
  `BatchesPage` server-driven; derived count-columns (docs/done) no longer sortable.
- **Doc-Intelligence config layout**: removed the in-page tab/sub-nav strip from `IntelligenceConfigPage`
  (`ConfigShell` now takes title/subtitle); the 3 pages (types/pipelines/lookups) stand alone, navigated
  from the sidebar (which already links them).
- Verified: @org/app typecheck ✓, @org/api build ✓, lint 0 errors (ui/api-client/api/app; pre-existing
  warnings only). NOT browser-verified. Existing batches created before this change keep status='running'
  until a run transitions (recompute is on-write); a one-off backfill could refresh them.

STILL OPEN (user asked, not yet done): (a) retain/expose the ORIGINAL uploaded file for batch runs (the
SourceDocument already stores `s3Key`; need to clarify exact ask — "keep original for review"); (b)
batch review flow with Prev/Next + easier UX (currently the queue is a list → "Review" jumps to
/analyze/:id with no sequential navigation).

## 2026-06-13 (cont.) — Original-file access + batch review stepper

- **View original file** (user: keep/expose the original for review): SourceDocument already retains
  `s3Key`. Added `GET /intelligence/sources/:id/original-url` → `IntelligenceService.getOriginalUrl`
  (access-checked, `storage.getPresignedDownloadUrl`). api-client `getOriginalUrl(sourceId)` →
  `{url,filename,contentType}`. New `<ViewOriginalButton>` (lazy presigned fetch on click → opens in new
  tab) placed in the review/analyze header AND in the document builder header. `convert()` now stashes
  `sourceDocumentId` in the freeform doc's `data`, so converted docs link back to their source (the
  builder shows "View original" when present). Structured-convert path unchanged (its `data` is schema-
  validated) — could add a real `Document.sourceDocumentId` column later for full coverage.
- **Batch review stepper** (user: Prev/Next + easier UX): rewrote `ReviewQueuePage` with two modes —
  LIST (click any item, or "Review all") and FOCUSED, a single-doc stepper that reuses `ReviewExtraction`
  + `ViewOriginalButton` with Prev / Next across the queue, a "{n} of {total}" progress, and "Approve &
  next" (approving removes the item so the index lands on the next automatically; an effect clamps/closes
  when the queue empties). No more bouncing to /analyze and back between docs.
- Verified: @org/app typecheck ✓, @org/api build ✓, lint 0 errors (api/api-client/app; pre-existing
  warnings only). NOT browser-verified.

## 2026-06-13 (cont.) — Batch review stepper: walk ALL batch docs

User: in a batch's review (`/review-queue?batch=`), Next/Prev wasn't usable because the queue only held
the parked (needs_review) runs — if a batch had several docs but one parked, there was nothing to step
to. Fix: when scoped to a batch, the stepper now walks ALL openable docs in the batch
(needs_review + completed + approved, needs_review first) so Prev/Next traverse the whole batch; Approve
shows only on still-parked runs and advances on success. Global `/review-queue` unchanged (parked only).
Added `?doc=<sourceId>` deep-link so the batch detail "Open" routes INTO the stepper (was → /analyze with
no nav). Verified: @org/app typecheck ✓, lint 0 errors.

## 2026-06-13 (cont.) — PLAN: powerful search + analyse/ask on any doc

Planned (NOT started). Full resume doc: **docs/09-search-analysis-RESUME.md**. Saved as Task list #1–#10.
Decisions: hybrid keyword (pg_trgm+tsvector) + semantic (pgvector) search from v1; unified `SearchIndex`
table over both Documents + SourceDocuments; server-side pagination only for growth-prone tables
(batch-detail runs + review queue). Biggest net-new piece: a server-side Document→text extractor
(freeform/structured/source) — none exists today. Generalize AnalysisRun+SourceChunk to a polymorphic
subject (source|document) + cache analysis (content hash). Open: confirm pgvector/pg_trgm available
(Task #10) + user's "…also" message was cut off.

## 2026-06-14 — AI usage tracking + scoped Settings registry

User: "add the proper AI usage tracking, can we add over all tracking … document level, user level,
org level … total usage per model+token … make it proper, do research, build like a product … also a
config so it can be enabled/disabled on any level, on UI, common way to set some config, could be
used in next phases or modules reused."

Net result: every LLM/vendor-AI call now writes one row to an append-only `AiUsage` ledger; rollups for
user / org / document / source / pipeline-run / batch / per-model / per-day come out of a single
indexed table. A generic `Setting` table powers system / org / user-scoped toggles for any future
module (first user = `ai.usage.tracking.enabled` and three siblings).

**Schema (`tools/prisma/schema.prisma`)** — three new models + one migration
`20260613193103_ai_usage_settings`:
- **`AiUsage`** (one row per call). Langfuse/Helicone/OpenLLMetry-inspired columns: who (userId, orgId,
  sessionId), trace hierarchy (traceId, parentSpanId), what (operation, featureCode, provider, model,
  modelVersion), related entity (documentId, sourceDocumentId, pipelineRunId, extractionId,
  analysisRunId, batchId), tokens (inputTokens, outputTokens, cachedInputTokens, cacheWriteTokens,
  reasoningTokens, totalTokens), alt billable units (unitsUsed/unitType for LlamaParse pages, TTS
  chars, STT seconds, vision images, flat per-call), cost (estimatedCostUsd Decimal + pricingId FK so
  finance reconciles against the exact rate-card row), latency (durationMs, latencyToFirstTokenMs,
  queuedMs), outcome (status, attempt, retryOfId, finishReason, errorCode, errorMessage), provider
  identity (requestId, idempotencyKey), sampling knobs (temperature, maxTokens, streamed), retention +
  filtering (tags[], retentionDays default 365), and free-form metadata Json. Composite indexes on every
  rollup axis (createdAt; userId; orgId; sessionId; traceId; documentId; sourceDocumentId;
  pipelineRunId; extractionId; analysisRunId; batchId; operation+createdAt; provider+model+createdAt;
  featureCode+createdAt; status+createdAt) so `GROUP BY model SUM(tokens)` is millisecond-fast on tens
  of millions of rows without rollup tables.
- **`AiModelPricing`** (editable rate-card; provider + model + unitType, with effectiveFrom/effectiveTo
  windows so prior `AiUsage` rows keep pointing at the rate that was active when they were written).
  Lanes: inputPer1M, outputPer1M, cachedInputPer1M, cacheWritePer1M, reasoningPer1M, perCallUsd.
- **`AiBudget`** (soft/hard per-user / per-org / per-feature, daily/weekly/monthly/lifetime, warnAt
  fraction, hardCap flag — hooks for `assertWithinBudget()` to return 402).
- **`Setting`** — generic scoped key/value (`scope` ∈ system|org|user, `scopeId` non-null with `''`
  sentinel for system, JSON `value`, optional `notes`). Compound unique `(scope, scopeId, key)`. Built
  to be reused for any future module toggle — storage shape never changes; new keys are registered in
  code, no migration needed.

**Settings module** (`apps/api/src/app/settings/`):
- `settings.keys.ts` — `SETTINGS` registry + `findSetting()`. Seeded with `AI_USAGE_TRACKING_ENABLED`
  (user-overridable, default on), `AI_USAGE_BUDGET_ENFORCED` (org, default on),
  `AI_USAGE_RETENTION_DAYS` (org, default 365), `AI_USAGE_REDACT_PROMPTS` (org, default on).
- `settings.service.ts` — `get<T>(def, ctx)` resolves narrowest-wins (user → org → system → in-code
  default), `set` / `clear` mutate per scope, `listForScope` returns every key + its override + the
  resolved effective value (admin UI). 30-second in-memory cache so hot paths (every AI call) don't
  thrash the DB; cache is invalidated on write.
- `settings.controller.ts` — `GET/PATCH/DELETE /admin/settings[/:key]` (admin-only).

**AI usage module** (`apps/api/src/app/ai-usage/`):
- `pricing.ts` — built-in `MODEL_PRICING` seed (per-1M-unit rates for openai, anthropic, google,
  llamaparse, reducto) used as fallback when no DB row matches. `computeCost(provider, model, usage)`
  is the single place to convert tokens → USD.
- `ai-usage.context.ts` — `AsyncLocalStorage`-based per-request attribution. Callers (controllers /
  engine / services) wrap work in `aiUsageContext.run({ userId, orgId, documentId, … }, …)`; the
  recorder picks those up automatically so no AI method signature has to change.
- `ai-usage.recorder.ts` — `AiUsageRecorderService.record({ … })`. Reads the active context,
  normalises tokens to `TokenUsage`, computes cost via the pricing engine, writes one row, never
  throws (a ledger failure must NEVER break the user's actual AI call). Checks
  `AI_USAGE_TRACKING_ENABLED` per-call to honour user/org opt-outs.
- `ai-usage.service.ts` — read side: `list()` (paginated + sortable + filterable on every dimension),
  `summary()` (totals + per-day series + perOperation/perModel/perProvider rollups + p50/p95/p99
  latency via Postgres `percentile_cont`).
- `ai-usage.controller.ts` — `/me/ai-usage[/summary]` (self-service), `/admin/ai-usage[/summary]`
  (workspace-wide), plus `/admin/ai-usage/by-{document,source,pipeline-run,batch,user,org}/:id`
  one-liners that delegate to `summary()` with a single filter.

**AiService instrumentation** (`apps/api/src/app/ai/ai.service.ts`): every `generate` / `stream` /
`extract` / `embed` call site is wrapped in start-time + try/catch — successful + failed attempts both
emit a `record()` row with provider, model, duration, token usage, finishReason, requestId,
temperature/maxTokens, prompt/output byte sizes, streamed flag, latencyToFirstTokenMs (streaming).
Fallback retries are recorded as separate rows with incrementing `attempt`. Embedding cost is
approximated via 1 token / 4 chars when the underlying LangChain wrapper doesn't return token counts.
`AiResponse` + `Structured<T>` now carry an optional granular `TokenUsage` block (inputTokens,
outputTokens, cachedInputTokens, cacheWriteTokens, reasoningTokens, totalTokens) + requestId +
finishReason so per-provider adapters can surface what they know without API changes.

**Admin UI**:
- `AdminDashboard.tsx` — added two new section cards linking to **AI usage & cost** and **Platform
  settings**.
- `apps/app/src/app/features/admin/ai-usage/AiUsagePage.tsx` (route `/admin/ai-usage`) — KPI strip
  (calls / cost / input / output / avg + p95/p99 latency / error rate), daily-volume sparkline with an
  error-rate overlay, per-provider/per-model/per-operation breakdown cards, and a server-paginated
  DataTable of recent calls with op/provider/model + free-text filters and a workspace ↔ "my calls
  only" scope toggle. Each row deep-links to the related document / source / batch.
- `apps/app/src/app/features/admin/settings/AdminSettingsPage.tsx` (route `/admin/settings`) —
  scope picker (system / org / user) + optional scopeId input, then one card per registered setting
  with: label, key, max-scope, override state, current effective value, default, and a per-type
  editor (Switch / number / string / JSON Textarea). "Save override" upserts; "Remove override" clears
  back to the next layer. Per-setting notes field for audit context.

**Verified**: `pnpm prisma migrate dev` applied `20260613193103_ai_usage_settings`; `nx run @org/api:build` ✓;
`@org/api:lint` 0 errors (6 pre-existing warnings); `nx run @org/app:build` ✓; `@org/app:lint` 0 errors
(11 pre-existing warnings). NOT browser-verified end-to-end yet.

**Reuse hooks for next phases**: any future module that needs a feature flag / toggle / threshold just
registers it in `settings.keys.ts` and calls `settings.get(SETTINGS.MY_KEY, { userId, orgId })` — no
new tables, no migration. Any future AI-adjacent code that wants per-document attribution wraps the
work in `aiUsageContext.run({ documentId, batchId, … }, …)` once; every nested LLM call is recorded
automatically without further plumbing.

## 2026-06-14 (cont.) — Citation auto-fill + section analyzer + public /law catalog

User: "do the citation-fill … also is there a way, in documents based on the section of law, it can improve enhance with some powerful analysis, and proper" + "for docs and all, with proper show me how it will manage and how it will work" + "yes, but for now do the citation not the law itself, later we will do the law for public+maintain all sections and docs, for india as well as other countries" + "enable the law things for public + admin, as well do not skip that" + "make use of indiacode.nic.in right, and suggest analyse or fill the drafts based on information."

What landed (all server + UI, api+app build ✓ / lint 0 errors / migration applied / 12 citations seeded; NOT browser-verified):

- **Prisma `LegalCitation`** model + migration `20260613204412_legal_citation_catalog`. Carries everything the analyzer + filler + public catalog need: act, actShort, section, title, summary, fullText (optional bare-act mirror), externalUrl, supersedes (soft FK), confidence, verifyNote, topics[], appliesTo[] (doc-type keys), commonlyPairedWith[] (related citation ids), draftingTips, jurisdiction ('IN' default), isActive, isPublic, ownerOrgId (null = global). Three indexes for the obvious axes.
- **In-code `@org/legal-reference` extension**: Citation type gained appliesTo / commonlyPairedWith / jurisdiction / draftingTips / externalUrl. Seeded 12 citations (added ni.141, ni.142). The seed script upserts every in-code CITATION into LegalCitation idempotently and leaves admin-edited fields (draftingTips, externalUrl) alone after the first sync.
- **`LegalReferenceService`** (apps/api/src/app/legal-ai/legal-reference.service.ts): DB+code merge by `id`, DB wins; 60-second in-memory cache invalidated on writes. `list()` / `get(id)` / `applicableFor(docTypeKey)` / `byTopic(topic)` / `successorOf(repealedId)` / `listPublic()` / admin `listAdmin()` (annotates each row with `source: 'db' | 'code'`) + `createOrUpdate` / `setActive` / `setPublic` / `remove`.
- **`CitationFillerService`**: two-pass rewriter on AI-drafted HTML. (1) `{{applicable_law}}` placeholders → hyperlinked `<a class="citation-ref" data-citation-id="ni.138" href="/law/ni-138">Section 138 of the NI Act, 1881</a>` spans, picked by an 80-char keyword-score window. (2) Bare IPC/CrPC/Evidence references with a curated successor (e.g. CrPC §200 → BNSS §223) get rewritten in place. Returns `{ filled, insertedCitations[], unresolvedPlaceholders, remainingWarnings }`. Wired into `LegalAiService.generateDocument` + `reviseDocument` (both responses now carry `insertedCitations` + `unresolvedPlaceholders`).
- **AI grounding**: `LegalAiService.generateDocument` now injects the applicable citations' titles + summaries as a "Applicable statutory context" block into the system prompt (capped at 5). The model still doesn't author section numbers — the filler does.
- **`CitationAnalyzerService`** + `GET /legal-ai/citations/document/:id/analyze` (also `POST /legal-ai/citations/analyze-text` for raw HTML). Stateless — reads doc.data.html, builds:
  - `present[]` from `data-citation-id` spans the filler stamped in,
  - `stale[]` from `validateCitations()` + successor lookup,
  - `missing[]` = `applicableFor(docTypeKey) - present[]`,
  - `suggestions[]` from `commonlyPairedWith` of present citations.
- **IndiaCode adapter** (apps/api/src/app/legal-ai/sources/): `LegalSourceAdapter` interface + `IndiaCodeSourceAdapter` (fetches indiacode.nic.in by curated act-handle map, htmlToText strip, best-effort section isolation, 15 s timeout, never on user hot path) + `LegalSourceRegistry`. **`CitationSyncService.syncFromSource(id)`**: fetch → AI cleanup (`AiService.generate` with `SUMMARISE_SYSTEM` returning strict JSON `{ summary, draftingTips, fullText }`) → persist on the LegalCitation row. Admin-only trigger via `POST /legal-ai/admin/citations/:id/sync`. Pluggable for UK/US later (one new adapter + registry entry).
- **Public catalog** (auth-free):
  - `PublicCitationsController` mounted at `/public/law` with the `@Public()` decorator. `GET /public/law` (topic/act/jurisdiction filters) + `GET /public/law/:id` (accepts both `bnss.223` and `bnss-223`; double-guards against private citations leaking).
  - `apps/app` SPA pages outside ProtectedRoute: `/law` (`PublicLawCatalog` — search + topic-chip + act-chip filters + card grid) and `/law/:id` (`PublicLawDetail` — summary + drafting-tips + applies-to-docs CTAs + external-source link + per-page document.title / meta-description set client-side). Future Next.js SSR port deferred per scope agreement.
- **Builder integration**: new `CitationHealth` component mounted in `BuilderShell` right pane as a collapsible "Legal references" section (open by default, between AI insights and AI usage). Lists present / stale + suggested successor / missing-expected / commonly-paired suggestions. Each entry deep-links to its `/law/<id>` public page.
- **Admin catalog UI**: `/admin/legal-reference` (AdminLegalReferencePage) — DataTable of every citation with source badge (db|code), confidence chip, supersedes badge, per-row Active/Public switches, "Sync" button (calls indiacode adapter + AI summariser), Edit/Delete. CitationEditor card with id / jurisdiction / act / actShort / section / confidence / effectiveFrom / supersedes / externalUrl / title / summary / verifyNote / draftingTips / topics[] / appliesTo[] / commonlyPairedWith[]. New sidebar entry "Legal references" with a BookIcon.
- **Admin CRUD endpoints** on `LegalAiController` (no `@Roles('admin')` per the current open-it-up rule): `GET /legal-ai/admin/citations`, `PATCH .../:id`, `PATCH .../:id/active`, `PATCH .../:id/public`, `DELETE .../:id`, `POST .../:id/sync`. User-facing read endpoints: `GET /legal-ai/citations`, `GET /legal-ai/citations/:id`.

**Module wiring**: `LegalAiModule` now imports `DatabaseModule` + registers `LegalReferenceService`, `CitationFillerService`, `CitationAnalyzerService`, `CitationSyncService`, `IndiaCodeSourceAdapter`, `LegalSourceRegistry`. Exports the first three for any future module that wants to lean on the catalog.

**End-to-end flow demonstration**:
1. User drafts a legal notice via Draft-with-AI. Brief: "Cheque ₹2L bounced from Acme Pvt Ltd."
2. `generateDocument` looks up `applicableFor('legal_notice')` → `[ni.138, ni.141, ni.142]`, injects their summaries into the system prompt as grounding context (no section numbers).
3. Claude/OpenAI returns HTML with `{{applicable_law}}` placeholders.
4. `CitationFillerService` walks every placeholder, picks the best applicable citation by keyword proximity, inserts hyperlinked spans. Bare "Section 200 of the CrPC" references get rewritten to BNSS §223 spans.
5. Response carries `insertedCitations: [{id:'ni.138', occurrences:3}, ...]` + `unresolvedPlaceholders: 0`.
6. Builder right pane "Legal references" calls `/legal-ai/citations/document/:id/analyze` → shows ✓ NI §138 (3×), ✓ NI §141 (1×), ✓ NI §142 (1×), and "Worth considering" suggestions from `commonlyPairedWith`.
7. Exported PDF carries citation `<a>` spans pointing at `/law/ni-138`. Recipient googles "Section 138 NI Act", lands on the public page, sees a CTA "Reply to a §138 notice → draft now". GTM loop closed.
8. Admin opens `/admin/legal-reference`, clicks Sync on ni.138 — adapter fetches indiacode HTML, AI cleans + summarises, externalUrl is updated. 60 s cache flushes; next draft uses the fresh summary.

**Not done / honest gaps**:
- Public pages live in apps/app SPA (no SSR yet) — fine for indexing but a Next.js port to apps/web later will improve crawl speed + sitemap + JSON-LD. Sitemap entries NOT yet generated.
- The IndiaCode adapter has a hand-curated act-handle map covering ~10 acts. Beyond those, sync falls back to "paste manually". Worth growing the map as new structured doc types ship.
- Multi-jurisdiction: schema + interface ready (`jurisdiction` field, `LegalSourceAdapter`). UK / US adapters not implemented.
- Citation one-click "Update CrPC §200 → BNSS §223" / "Insert §141" buttons in the builder pane are read-only links to `/law/<id>` today — actual HTML mutation in the editor not wired yet. Next iteration.
- `commonlyPairedWith` suggestions surface in the analyzer + the admin form. Per-bundle "required citations" beyond `appliesTo` not modelled separately (use appliesTo).
- Lint: 14 warnings total (3 new in `CitationHealth`'s useEffect dep + 11 pre-existing), 0 errors. Disabled the `react-hooks/exhaustive-deps` warning on the single-dep refresh effect intentionally.

## 2026-06-14 (cont.) — Citation: one-click fixes + section-grounded AI critique + sitemap

User: "continue" (after the citation-fill + public catalog landed). Picked up the gaps I logged: read-only suggestions → actual editor mutations, plus a section-grounded AI critique pass and a sitemap so the public `/law/*` pages are crawlable.

What landed (api + app build ✓ · lint 0 errors · NOT browser-verified):

- **`CitationApplyService`** (`apps/api/src/app/legal-ai/citation-apply.service.ts`): handles two action kinds.
  - `replace-stale`: regex-finds the matched repealed-code fragment ("Section 200 of the CrPC") and rewrites it in place with the successor's hyperlinked `<a data-citation-id>` span (BNSS §223). Whitespace-tolerant regex with literal-text fallback. Idempotent (no-op on already-fixed text returns a 400 so the user sees a clear error).
  - `insert-missing`: appends `<p data-citation-suggested="...">See also: <a class="citation-ref" ...>...</a></p>` before the closing wrapper tag (body/article/main/section) if present, else at the end. Rejects re-insert if the citation id is already in the doc.
  - Access-checked + lock-checked + only operates on freeform docs (`data.html` present); structured bundles get a clear error rather than silent corruption. Returns the updated HTML + refreshed analysis in one round-trip so the UI hot-swaps without a separate fetch.
- **`CitationCritiqueService`**: section-grounded AI critique. Loads the citations present in the doc (via `data-citation-id` spans) **plus** the doc-type's declared `appliesTo` citations even if not yet present, builds a prompt block with each section's curated summary + `draftingTips`, and asks the model to flag (high/medium/low severity) missing required clauses / inconsistencies with the cited section / limitation / jurisdiction traps. Strict-JSON output parsed defensively (drops malformed entries, never throws).
- **Controller endpoints** on `LegalAiController`:
  - `POST /legal-ai/citations/document/:id/apply-fix` (body = ApplyFixAction)
  - `POST /legal-ai/citations/document/:id/critique`
- **Sitemap**: `GET /public/law/sitemap.xml` (no auth, 1-hour cache) — one entry per `isPublic` citation + the index page. Honors `PUBLIC_APP_URL` / `APP_URL` env for absolute URLs.
- **`CitationHealth` UI upgrade**: stale rows now have an actionable "→ BNSS §223" button (was a passive link) that calls the apply-fix endpoint, swaps the analysis in-place, and toasts the result. Missing rows + commonly-paired suggestions both get "Insert" buttons that append a `See also: …` paragraph. A new "AI critique" button at the top of the panel runs the section-grounded critique and renders the issue list (severity badge + title + detail + optional proposedText pre-block) below the suggestions.
- **Module wiring**: `LegalAiModule` registers `CitationApplyService` + `CitationCritiqueService`; exports both for downstream reuse.

**End-to-end flow now**:
1. Draft a notice → builder right pane shows "stale: CrPC §200 → BNSS §223 [→ BNSS §223]" button.
2. Click the button → API rewrites the fragment → analysis refreshes → toast confirms.
3. Click "AI critique" → backend grounds the model on §138 + §141 + §142's curated summaries + drafting tips → returns issues like "missing 15-day demand window under §138 proviso (b)" (severity: high) with proposed text.
4. Public users land on `/law/ni-138` → see drafting tips + a CTA back into the authed app.
5. `GET /public/law/sitemap.xml` exposes one URL per citation for Google.

**Honest gaps still open**:
- Issue's `proposedText` is shown but NOT one-click-applied yet — the user has to copy-paste. Next iteration: an "Apply suggestion" button that inserts/replaces the marked clause.
- The AI critique is one-shot — no caching by `(documentId, content hash)`. Re-runs cost tokens. Cheap to add via the existing AnalysisRun pattern; deferred.
- Public catalog still SPA-rendered. Sitemap is correct content, but the pages don't have SSR for crawlers (Google handles SPA, but Bing/social previews don't). Next.js port to `apps/web` is the proper fix.
- IndiaCode adapter handle map is still ~10 acts. Grow it as new doc-type bundles ship.

## 2026-06-14 (cont.) — Filled four open citation gaps

User: "fill all gaps". Took the four open items from the previous entry and closed them.

What landed (api+app build ✓ / api+app+web lint 0 errors / migration applied / NOT browser-verified):

1. **Apply-suggestion** — `CitationApplyService` gained a third action kind `apply-suggestion` taking `proposedText` + optional `citationId` + optional `replaceMatch`. Sanitises the AI's text (strips `<script>`, `<style>`, `<iframe>`, inline event handlers, `javascript:` URLs) before letting it touch the doc HTML. When `replaceMatch` is set, swaps that literal substring in-place; otherwise wraps the proposal in `<p data-critique-applied="1" data-citation-id="…">…</p>` and inserts before the closing wrapper tag. UI: every critique issue with a `proposedText` now renders an inline `[Apply]` button that posts to `/legal-ai/citations/document/:id/apply-fix` and hot-swaps the analysis on success.

2. **Critique caching** — new `CitationCritique` Prisma model (migration `20260613211151_citation_critique_cache`): unique `(documentId, contentHash)` + `model` + `groundedOn Json` + `issues Json`. `CitationCritiqueService.critiqueDocument()` hashes the analyzed HTML with sha256, looks up the matching row first, and returns it (with `cached: true`) without touching the AI. Re-runs on identical content cost zero tokens. Content edits change the hash → next critique writes a fresh row, idempotent upsert. UI surfaces a "cached" pill and a `[Recompute]` ghost button that posts with `?force=1` to bust the cache.

3. **Public catalog SSR (apps/web)** — moved `/law` and `/law/:id` from the SPA into the Next.js marketing site:
   - `apps/web/src/lib/law.ts` — `fetchPublicCitations()` + `fetchPublicCitation(id)` server-side fetchers (5-minute Next ISR), `citationSlug()` + `slugToId()` helpers.
   - `apps/web/src/app/law/page.tsx` — server-rendered catalog grouped by act, with `generateMetadata()` for title/description/canonical/OG/Twitter, and a JSON-LD `CollectionPage` block listing every public citation as a `Legislation` entity.
   - `apps/web/src/app/law/[id]/page.tsx` — server-rendered detail page; per-citation OG + Twitter + canonical, a `Legislation` JSON-LD with `legislationIdentifier` / `legislationJurisdiction` / `legislationDate` / `sameAs`, summary + drafting-tips + applies-to-docs CTAs + bare-act link.
   - `apps/web/src/app/sitemap.ts` — Next-native sitemap covering `/`, `/law`, and one entry per public citation.
   - `apps/web/src/app/robots.ts` — allows `/`, `/law*`; disallows `/api/`, `/login`, `/dashboard`; references `/sitemap.xml`.
   - SPA's `/law` + `/law/:id` routes removed; `PublicLawCatalog.tsx` deleted. `apps/app/src/config.ts` gained `webUrl` + a `lawUrl(citationId)` helper. CitationHealth + the API's CitationFiller/CitationApply span renderers now emit absolute URLs (`{lawHost}/law/{slug}`) so links survive PDF export + email forwarding.
   - **Pre-existing build break:** `@org/web:build` fails during SSG of `/login` with a React-19 `useMemo` null error in `lib/providers.tsx`. UNRELATED to the citation work — it was breaking before. Worked around for the new pages with `export const dynamic = 'force-dynamic'` on `/law/*` so they're SSR-on-demand (bots still see fully-rendered HTML; build doesn't have to pre-warm). Revert to static + ISR once the Providers SSG bug is fixed upstream. Web lint stays at 0 errors.

4. **IndiaCode handle map grown** — `IndiaCodeSourceAdapter.ACT_HANDLE` expanded from ~10 to ~40 acts: BNS / BNSS / BSA + IPC / CrPC / Evidence (for repealed lookups) + Contract Act / Specific Relief / TPA / Sale of Goods / CPC / Limitation / Partnership / Easements / Registration / Stamp / NI Act / Arbitration / CPA 2019 / Companies Act 2013 / SEBI / FEMA / RBI / Banking Regulation / IBC / Income Tax / CGST / IGST / Industrial Disputes / Payment of Wages / Minimum Wages / Gratuity / EPF / IT Act / DPDP / RTI / Hindu Marriage / Hindu Succession / Special Marriage / Guardians & Wards / Land Acquisition (RFCTLARR) / Constitution. Resolver upgraded to longest-prefix match so "indian contract act" doesn't collide with "contract act" base. State-specific acts (rent control, shops & establishments) are placeholders (`'0'`) — admins paste those manually.

**Cross-cutting cleanup**:
- Citation `<a>` href generation centralised: `lawUrl()` in `apps/app/src/config.ts` for the SPA, `lawHost` getter (`PUBLIC_APP_URL` env) in CitationFiller + CitationApply for the server. Same shape: `{host}/law/{slug}` with `slug = id.replace(/\./g, '-')`.
- All four citation services (filler / analyzer / apply / critique / sync) registered + exported from `LegalAiModule`.

**End-to-end + caching demo**:
1. Draft a §138 notice. CitationFiller stamps `<a href="https://example.com/law/ni-138" data-citation-id="ni.138">…</a>` (absolute, survives email forwards).
2. Builder's "Legal references" pane → click **AI critique** → server hashes the HTML → no cache row → calls AI → persists. UI shows issues.
3. Click **Apply** on a high-severity "missing 15-day demand window" issue → server sanitises the `proposedText`, appends a `<p data-critique-applied data-citation-id="ni.138">` block → response carries refreshed analysis → UI hot-swaps.
4. Edit nothing else. Click **AI critique** again → hash unchanged → instant return (`cached: true`, $0 tokens) → UI shows "cached" pill + **Recompute** button.
5. Edit a clause → hash changes → next critique calls AI fresh and persists a new row (existing row gets upserted with the new analysis).
6. Public user lands on `https://example.com/law/ni-138` (Next.js SSR) → first paint includes the full citation summary + drafting tips + JSON-LD Legislation entity → indexed cleanly.

**Honest, still-open gaps**:
- `@org/web:build` /login SSG break is pre-existing — the React-19 + Next-16 + redux Providers combo crashes during static export. My /law pages dodge it via `dynamic = 'force-dynamic'`. The root fix is in `apps/web/src/lib/providers.tsx`, outside the citation scope.
- IndiaCode handle map handles are taken from public URL conventions; not every one is exhaustively re-verified. Treat as a bootstrap — admins should sync + spot-check before binding use.
- Public `/law/:id` "Documents that use this section" links assume the authed app lives at `app.<marketing-domain>`. The current heuristic in apps/web (`webUrl.replace('//','//app.')`) is a placeholder; once a real `NEXT_PUBLIC_APP_URL` env exists, swap to that.
- Schedule.org JSON-LD on `/law/:id` uses `Legislation` (not the looser `Article`) — Google indexes both, but the `Legislation` rich-result template is best-effort until verified in Search Console.

## 2026-06-15 — Document groups: in-group search + summary-from-summaries

Finished off the document-groups module the previous session left dangling, and wired the user-requested **search-first** intelligence pattern: full-text + semantic search **scoped to a single group**, and a group summary that is **synthesised from the documents' existing analysis summaries** rather than re-running summarisation against full document text.

**API**:

1. `apps/api/src/app/search/search.service.ts` — `SearchParams` gained `groupId?: string`. When set, the SearchService:
   - forces `kind = 'document'` (sources aren't in groups; `Document.groupId` only),
   - pushes an `EXISTS (SELECT 1 FROM "Document" d WHERE d.id = si."refId" AND d."groupId" = $X)` predicate into the same WHERE clause as the existing tsv + trgm + vector match, so pagination, `total`, and facets are correct in a single SQL round-trip (uses the existing `Document_groupId_idx`).
2. `apps/api/src/app/document-groups/group-intelligence.service.ts` — replaced the broken post-filter implementation:
   - `searchInGroup()` now delegates to `SearchService.search({ groupId, … })` — no document-id fetch, no client-side filter on a page slice (which had `total = filtered.length` and lost pages 2+).
   - `generateGroupSummary()` rewritten to fetch the latest `AnalysisRun.summary` per document via a single `DISTINCT ON ("subjectId")` raw query instead of N `findFirst` calls; returns `unanalyzedCount` so the UI can warn when some docs are excluded.
   - Added `getStoredSummary()` returning the last-generated summary from `DocumentGroup.metadata` (`{ summary, summaryGeneratedAt, summaryModel }`) so the UI can show prior output without re-generating.
3. `apps/api/src/app/document-groups/document-groups.service.ts` — tightened `assertAccess`: it was letting any caller past when `ownerOrgId` was set. Now async + verifies `OrgMember(orgId, userId)` for org-owned groups; all five call sites updated to `await`.
4. `document-groups.controller.ts` — new routes (JwtAuthGuard, same as the existing ones):
   - `POST /groups/:id/search` — body `{ q, sort?, page?, pageSize? }`, returns the standard `SearchResponse` (with highlight markers).
   - `GET  /groups/:id/summary` — returns the stored summary (or `null`).
   - `POST /groups/:id/summary` — generates a fresh group summary from the existing per-document analyses, persists it into `metadata`, and returns it.
5. `document-groups.module.ts` — registered `GroupIntelligenceService` (previously orphaned) + imported `AiModule` (SearchModule is global so it's already in scope).

**Client**:

6. `libs/shared/api-client/src/lib/document-groups.service.ts` — added `search()`, `getSummary()`, `generateSummary()` + the `GroupSearchPayload`, `GroupSummary`, `GenerateGroupSummaryResult` types. Imports `SearchResponse`/`SearchSort` from the existing search-service module so the hit shape stays unified.
7. `apps/app/src/app/features/groups/queries.ts` — `useGroupSearch()`, `useGroupSummary()`, `useGenerateGroupSummary()` hooks (react-query keys under `groupsKeys.search/summary`, generate-mutation invalidates summary + detail on success and surfaces server `message` in the toast).
8. `apps/app/src/app/features/search/index.ts` — barrelled `Highlighted` + `hrefForHit` so the groups feature can reuse the same `«hl»…«/hl»` renderer the global search uses.
9. `apps/app/src/app/features/groups/GroupIntelligencePanel.tsx` — new component, slotted above `<DocumentsList groupId>` in `GroupDetailPage`. Card with two sections:
   - **Search within group**: debounced (250 ms) input → `useGroupSearch`; renders up to 10 hits as title + body snippet (both `Highlighted`), each linking via `hrefForHit`. Empty/loading/no-match states all explicit.
   - **Group summary**: shows `useGroupSummary` result; `Generate` (or `Regenerate`) button runs the mutation; warns when `unanalyzedCount > 0`; shows `generatedAt` + model footer. Disabled when the group is empty.

**Verification**: `pnpm nx run-many -t build -p api app api-client` is green. `pnpm nx run-many -t lint -p api app api-client` is green (0 errors; warnings are pre-existing). Not runtime-verified — needs API running + a group with analyzed docs to exercise the summary path, and any group with kind='document' search-indexed rows for the search path.

**Honest open gaps**:
- `assertAccess` change is a small behaviour fix — any prior org-owned group that someone non-member touched would now correctly throw 403; verify no caller relies on the old laxity before deploying.
- `GroupIntelligencePanel` shows the summary `generatedAt` from `metadata`, which the generation endpoint stamps as `new Date().toISOString()`. If multiple users hit the button quickly, the last writer wins — no optimistic-concurrency guard. Fine for v1.
- Search facets card (the existing global-search chips) isn't surfaced in the group panel — the hits list is intentionally minimal. Power users still have the global `/search` page.
- No "ask the group" RAG endpoint yet (would need to chunk + embed per-doc, then top-k across the group). Out of scope here; can layer on top of the SourceChunk model when needed.

## 2026-06-15 (cont.) — Manual analyze from the documents list (single + bulk + status)

The previous session added analyse-document infrastructure (`POST /intelligence/documents/:id/analyze`, `useRunAnalysis`, the `DocumentInsights` panel on the editor) but exposed it only inside the editor. Drafting documents from the list had no first-class "Analyze" action. Added it now — single + bulk + a per-row analysis-presence indicator, all driven off the existing AnalysisService + the same content-hash cache.

**API**:

1. `analysis.service.ts` — `analyze` / `analyzeDocument` / `analyzeSubject` accept `{ force?: boolean }`. When `force=true`, the content-hash cache lookup is skipped so the AI is re-run even when the text is byte-identical (this is what "Re-analyze" means semantically; without force, the existing fingerprint-cached result was just being returned and the button felt broken). Added `getDocumentsAnalysisStatus(userId, documentIds[])` — access-checks via the existing user/org-member predicate, then one `DISTINCT ON ("subjectId")` query (uses `AnalysisRun_subjectType_subjectId_createdAt_idx`) to get the latest run per doc. Returns `Record<id, { hasAnalysis, lastAnalyzedAt, summary, runId }>` with every input id keyed (inaccessible/missing docs get the neutral `hasAnalysis=false` shape, no leakage).
2. `intelligence.controller.ts` — `POST /intelligence/sources/:id/analyze?force=` + `POST /intelligence/documents/:id/analyze?force=` accept the new flag. New `POST /intelligence/documents/analyze-status` takes `{ documentIds: string[] }` and returns the keyed status object. JwtAuthGuard, same as the rest of the controller.

**Client**:

3. `intelligence.service.ts` (api-client) — `analyze(id, { force })` + `analyzeDocument(id, { force })` send `?force=true` only when truthy (otherwise no param, keeping the query string clean). New `getDocumentsAnalysisStatus(documentIds)`. New exported type `DocumentAnalysisStatus`.
4. `apps/app/.../features/intelligence/queries.ts` — `useRunAnalysis` mutationFn now accepts an optional `{ force?: boolean }` (no breaking change for existing `runAnalysis.mutate()` callers in `DocumentInsights`). New `useDocumentsAnalysisStatus(documentIds)` hook — key is `['intelligence', 'analysis-status', sortedIds]` so two pages with the same set of ids hit the same cache, with 15s staleness + `keepPreviousData` so the badge doesn't flicker between pages.
5. `AnalyzeDocumentDialog.tsx` (new, in `features/documents/`) — single-doc dialog. Loads the cached analysis via `useAnalysis(id, 'document')`. If cached: shows "Last analyzed Xd ago", a clamped summary line, party chips (first 6), and counts; footer offers **Open full insights** (navigates to the document editor where `DocumentInsights` lives) + **Re-analyze (force)**. If not cached: shows a neutral empty state with an **Analyze now** CTA. While running, swaps the body for a spinner labeled "Running analysis…".
6. `BulkAnalyzeDialog.tsx` (new) — multi-doc runner. Iterates targets with a concurrency cap of 2 (worker pool over a shared cursor), per-row state (`pending → running → analyzed | cached | failed`), live `<Progress>` + finished/total counter + ✓/✗ tallies, a `Force re-analyze` checkbox (default off), and a `Stop after current` cancel control that flips a ref so workers exit between docs (mid-flight AI calls still complete cleanly). "Cached" vs "Analyzed" is distinguished by comparing the returned `run.id` to the latest analysis fetched before the call — so the user sees which docs were free vs which actually spent tokens. On completion, invalidates `['intelligence', 'analysis-status']` and `['intelligence', 'analysis']` so the list re-decorates immediately.
7. `DocumentsList.tsx`:
   - New **Analysis** column, hidden in external `selectable` mode (group add-docs flow), shown otherwise. Page-batched via `useDocumentsAnalysisStatus(rows.map(r => r.id))` — one HTTP round-trip per page, not N. Renders a `✓ <relative>` pill or a muted "Not analyzed" label; clicking opens the single-doc dialog.
   - **Analyze** item in the row's `⋯` dropdown — opens the same dialog. Label flips to "View / re-analyze" when the row is already analyzed (so the user knows which action they're taking).
   - **Select to analyze** toolbar button (toggle). Distinct from the prop-driven `selectable` mode used by the group add-docs flow — the new `internalSelect` state is local. When on: checkboxes appear (same column reused), actions/group columns hide, and the selection bar's primary action becomes **Analyze N**.
   - Bottom selection bar now branches by mode: `selectable` external mode keeps **Add N to group**; internal select mode shows **Analyze N**.
   - Wired the two new dialogs at the bottom alongside the existing share/history/rename/add-to-group dialogs.

**Verification**: `pnpm nx run-many -t build -p api app api-client` is green; `pnpm nx run-many -t lint -p api app api-client` is green (0 errors; warnings are pre-existing). Not runtime-verified — needs an API instance + a document with extractable text to exercise the actual AI call and the cache short-circuit.

**Honest open gaps**:
- Concurrency cap is hard-coded at 2. Fine for a handful, but for a bulk run on 50 docs against a slow provider this is a coarse setting. Could be a SearchConfig-style admin knob later.
- "Cached" detection compares run ids — if a `force=false` call somehow yields a fresh run that happens to dedupe to a *different* prior row (unlikely, but theoretically possible if multiple cache entries exist for the same contentHash across subject types), the label could mis-classify. The classification is cosmetic; the analysis itself is correct.
- The analyze endpoint is synchronous from the client's POV (the server awaits the AI call). With force=true on a long doc that's 10–30s of locked HTTP. The bulk dialog tolerates this (worker pool, progress, cancel), but a single-doc dialog can feel slow on a cold cache. Out-of-scope: switching analyze to a queued/job pattern with polling would be a bigger refactor (parallel to how upload jobs work) and worth doing if users actually complain.
- The new `Analyze` column adds an extra HTTP round-trip per page. Mitigated by `staleTime: 15s` + `keepPreviousData`, but on a fresh page load it's a small extra latency. Could be folded into the documents list endpoint if it becomes hot.

## 2026-06-15 (cont.) — Server-side analysis queue + editor Legal & AI split

Two related pieces of work: (1) the previous "bulk analyze in the browser via a 2-wide worker pool" was the wrong shape — closing the tab killed the run, refreshes lost progress, and a long doc pinned an HTTP request for minutes. Replaced it with a persistent server queue. (2) the structured (Builder) editor still showed the old single "Legal & AI" panel with internal tabs; the freeform editor was already split into three rail items. Mirrored the freeform layout into BuilderShell so both editors are consistent.

**Server queue**:

1. New Prisma model `AnalysisQueueItem` (`tools/prisma/schema.prisma` + migration `20260615120000_add_analysis_queue`): one row per requested analysis, grouped by `batchId`. Status machine `queued → running → done | cached | failed`. Stores `runId` (the resulting `AnalysisRun.id`), `error` (truncated to 500 chars), `force` (whether the caller asked to bypass the content-hash cache), `userId` (for the access-checked reads), and the usual timestamps. Indexed on `(userId, createdAt)`, `batchId`, and `status` — the three predicates the service uses.
2. `apps/api/src/app/intelligence/analysis-queue.service.ts` — new `AnalysisQueueService`:
   - `enqueueBatch(userId, documentIds[], { force })` → filters to docs the user can access (silently drops the rest), creates one row per accessible id with a fresh `randomUUID()` batchId, then dispatches. If BullMQ is up, pushes one job per item (`jobId = item.id` so retries dedupe); else fires a `void this.drainInline()`.
   - `processItem(itemId)` — the worker entrypoint; idempotent (re-fired retries that already succeeded are a no-op via the `status !== 'queued'` guard). Captures the latest `AnalysisRun.id` for the doc BEFORE calling `analysis.analyzeDocument()` so we can distinguish a fresh `done` from a `cached` (returned the same row).
   - `getBatch(userId, batchId)` and `getActive(userId)` — user-scoped reads with counts; `getActive` includes batches finished within the last 60s so the "just completed" state surfaces in the indicator before fading out.
   - Inline drainer is reentrancy-guarded (`inlineDraining` flag) so concurrent enqueues from one process don't spawn parallel loops; the loop re-checks `findFirst({ status: 'queued' })` after each item so a mid-run enqueue gets picked up.
3. `apps/api/src/app/intelligence/analysis-queue.processor.ts` — thin BullMQ `WorkerHost` that just delegates to `processItem(itemId)`. Same shape as `IntelligenceProcessor` so behaviour is identical inline vs queued (thrown errors surface to BullMQ, which retries per the `attempts: 2` + exponential backoff configured at enqueue).
4. `intelligence.module.ts` — second queue alongside `INTEL_QUEUE`. New `ANALYSIS_QUEUE` constant + `ANALYSIS_QUEUE_ENABLED` token + `BullModule.registerQueue` in the Redis branch + the inline `useValue: false` in the no-Redis branch.
5. `intelligence.controller.ts` — three new routes (JwtAuthGuard):
   - `POST /intelligence/analysis-queue` body `{ documentIds, force }` → returns `AnalysisQueueBatch` (batchId + items + counts + isComplete) immediately.
   - `GET /intelligence/analysis-queue/active` → list of in-flight (or just-completed) batches for the user.
   - `GET /intelligence/analysis-queue/:batchId` → single-batch poll.

**Client**:

6. `libs/shared/api-client/src/lib/intelligence.service.ts` — added `enqueueAnalysisBatch / getAnalysisQueueBatch / getActiveAnalysisQueue` plus the `AnalysisQueueBatch`, `AnalysisQueueItem`, `AnalysisQueueItemStatus` types so the UI doesn't redefine them.
7. `apps/app/.../features/intelligence/queries.ts` — `useEnqueueAnalysisBatch` (mutation, invalidates the `active` query on success), `useAnalysisQueueBatch(batchId)` (polls every 2s while `!isComplete`, then stops), `useActiveAnalysisQueue()` (polls every 2s while any batch is draining, then backs off to 15s).
8. `BulkAnalyzeDialog.tsx` rewritten: the in-browser worker pool is gone. The dialog now submits the batch once with a "Queue N" button, then polls the batch progress server-side. The footer changes shape mid-run: pre-submit shows Cancel + Queue; mid-run shows "Run in background" (closing the dialog DOES NOT cancel work); on completion shows Done. On `isComplete`, the dialog invalidates the per-doc `analysis-status` + `analysis` query keys so the document-list status pills update.
9. `AnalysisQueueIndicator.tsx` (new) — small pill rendered in the DocumentsList header. Shows a spinner + "Analyzing N documents…" while batches drain, then ✓ + "Recent analyses" for 60s after completion. Click opens a Popover listing each batch with its progress bar, finished/total, and per-status counts (done / cached / running / queued / failed). Hidden when there's no activity to surface.

**Editor parity (BuilderShell)**:

10. `apps/app/.../features/documents/builder/BuilderShell.tsx` — split the single `legal-ai` rail item into three (`legal-ai-citations` / `legal-ai-insights` / `legal-ai-usage`), grouped under a new "Legal & AI" header. Renders `CitationHealth` / `DocumentInsights` / `AiUsageSummary` directly instead of going through `DocumentSidePanel`. `SidebarTab` union + render switch + header label all updated. Reuses the rail icons added previously (`CitationsIcon` / `InsightsIcon` / `UsageIcon`).

**Verification**: `pnpm nx run-many -t build -p api app api-client` green; `pnpm nx run-many -t lint -p api app api-client` green (0 errors; the 13 warnings are pre-existing). No runtime test; needs the API running + Redis (or no Redis for the inline path) + a doc with extractable text to exercise the queue end-to-end.

**Honest open gaps**:
- Inline drainer (no-Redis mode) is single-process-only. A multi-instance deployment without Redis would have each instance drain its own enqueues independently — fine until two enqueue concurrently for the same item id, which can't happen because the items themselves are unique-per-row.
- No reconciler for the analysis queue yet. If a process dies mid-`running`, the row stays `running` forever. The existing `ReconcilerService` (for `IntelligenceJob`) is a model for adding this; out of scope here. Workaround: re-enqueue from the UI.
- `getActive` returns up to 200 recent items aggregated into batches; very large workloads (hundreds of concurrent batches) would need pagination. Not a real-world risk in v1.
- The queue indicator polls every 2s while active. Acceptable for a low-N use case but worth folding into a websocket/SSE channel if this becomes a primary surface.

## 2026-06-15 (cont.) — Generic multi-select + bulk actions on documents list

The previous "Select to analyze" mode was single-purpose; the same selection state can drive any bulk action. Generalised it: select toggle + leading checkbox column + a sticky multi-action toolbar. Also fixed the select column rendering on the right edge (a pinning bug), and replaced the standalone `/groups/:id/add` navigation with an inline dialog from the group detail page.

**DataTable**:

1. `libs/shared/ui/src/components/data-table.tsx` — extended `DataTableColumn.pinned` from `boolean` to `boolean | 'left' | 'right'`. `true` and `'right'` flush right (back-compat — that's where the actions column lives); `'left'` flushes left. Updated `effectiveOrder` to prepend left-pinned ids, then persistedNonPinned, then trailing (newly-added columns from this release), then right-pinned ids. All other touch points (`enableResizing`, drag-block, persisted-order writer) already used a truthy check on `pinned`, so they keep working without changes.

**DocumentsList**:

2. Select column moved to `pinned: 'left'` (was implicitly drifting to the right via `pinned: true`, which is what the user was seeing on `/groups/:id/add`). Visuals: `size-5` box with `border-2` for clarity. Column header now hosts a "toggle all visible" checkbox that selects/deselects every row on the current page.
3. Generic multi-action toolbar in the selection bar. Internal select mode (`!selectable` + `internalSelect`) exposes:
   - **Analyze** — opens the queue-backed `BulkAnalyzeDialog`.
   - **Add to group** — opens `AddDocToGroupDialog` (already accepts a `documentIds[]` array; just needed to be wired with the selection set).
   - **Delete** — confirm dialog, then iterates the existing single-delete mutation. No new server endpoint; if bulk delete ever becomes a hot path, the server-side equivalent is small.
   - Plus **Clear** to drop the selection.
   External select mode (`selectable` prop — group add-docs flow) keeps the single **Add N to group** confirm so the GroupAddDocsPage callback contract doesn't change.
4. Selection bar made sticky (`sticky top-0 z-10`, backdrop blur on the primary tint) so it stays visible while the user scrolls long lists.
5. Renamed the toolbar entry from "Select to analyze" → "Select" — the action set is now generic.

**Group add-docs flow**:

6. `apps/app/.../features/groups/GroupDetailPage.tsx` — the "+ Add documents" button no longer navigates to `/groups/:id/add`. It opens `AddDocsToCurrentGroupDialog` inline. The `/add` route + `GroupAddDocsPage` stay intact (useful for keyboard-driven flows + URL bookmarks).
7. `AddToGroupDialog.tsx` — polished `AddDocsToCurrentGroupDialog`:
   - Bigger leading checkbox (`size-5` + `border-2`); the whole row is the click target.
   - "Select all on this page" / "Clear selection on this page" toggle above the list.
   - Count pill (`X selected`) in the dialog title for immediate visibility while picking.
   - Result count next to the toolbar so users know whether they're at the end of the list.
   - Sticky footer status line ("Will add N to this group.") so the CTA outcome is obvious.

**Verification**: `pnpm nx build app` green; `pnpm nx lint app ui` green (0 errors; pre-existing warnings only).

**Honest open gaps**:
- Bulk delete iterates the single-delete mutation client-side, so the toast fires per-document. Fine for handfuls; if users routinely delete 50+ at a time, batch the toast + add a server-side `POST /documents/bulk-delete`.
- The add-docs dialog still fetches just the 50 most recent documents with no pagination. Search narrows the set. For users with thousands of docs, the legacy `/groups/:id/add` full-page experience is the safety net (it has pagination + status/type filters).
- Dialog and the in-list selection bar are independent; selection state doesn't survive a navigation away and back. Acceptable — selection is intentionally session-scoped.

## 2026-06-15 (cont.) — Select toggle visibility + single-group invariant

Two follow-ups: (1) the multi-select toggle was only in the standalone /documents header — it didn't appear when the same DocumentsList is rendered inside the group detail page Documents tab. (2) The "add documents to group" flow silently overwrote an existing group assignment, violating the one-doc-one-group rule.

**Select toggle moved into the DataTable toolbar**:

1. `DocumentsList.tsx` — the "Select" button is no longer in the page header. It now sits in the DataTable's `toolbar` slot, alongside the status/type filter chips on /documents and as the sole toolbar control on the group detail Documents tab. Renamed `Select to analyze` → `Select multiple` since the action set is generic. AnalysisQueueIndicator + "New document" stay in the page header (only shown on the standalone /documents view).

**Single-group invariant (server)**:

2. `document-groups.dto.ts` — `AddDocumentsSchema` gained `overwrite?: boolean` (default false).
3. `document-groups.service.ts` — `addDocuments` rewritten:
   - Fetches the candidate docs with their current `groupId` (single query, accessible-only).
   - Splits the input into `eligible` (ungrouped or already-in-target — idempotent), `moved` (in another group, only assigned when `overwrite=true`), `skipped` (in another group, no overwrite), and `inaccessible`.
   - Performs a single `updateMany` over `eligible ∪ moved`.
   - Returns `{ ok, added, moved, skipped, inaccessible, skippedIds, movedIds }` so the UI can render a precise outcome.
4. The previous behaviour (silently moving docs into the new group) is gone — callers must explicitly opt into a move.

**Client (api-client + hook)**:

5. `document-groups.service.ts` (api-client) — `addDocuments(id, ids, { overwrite })` + new `AddDocumentsResult` shape.
6. `useAddDocumentsToGroup` (`apps/app/.../features/groups/queries.ts`) — mutation accepts `overwrite`. Success toast now reports added/moved/skipped counts (`"Added 3 · Moved 1 · Skipped 2 (already in another group)"`).

**Picker UIs**:

7. `AddDocsToCurrentGroupDialog` (used from the group detail "+ Add documents" button) — picker filters out docs that already have a group. Subtitle explains why ("only ungrouped documents are shown — to move a doc, use Add to group from the documents list").
8. `AddDocToGroupDialog` (used from the documents list, single + bulk) — refactored to take full doc objects (`AddToGroupTarget[]` with `group: { id, name, kind } | null`) so it can segregate the selection into `eligible` / `alreadyHere` / `inOtherGroup`. Once a target group is chosen, the dialog shows a preview ("X will be added (ungrouped). Y already in this group (no-op). Z are in another group — won't be added unless you choose Move.") plus an explicit `Move the Z doc(s) out of their current group` checkbox that flips `overwrite=true`. The submit button label flips to `Add & move N` accordingly.
9. `DocumentsList.tsx` — single-row and bulk callsites map the selection (or single doc) through `filteredRows` to extract the full doc with its `group` before passing to the dialog.

**Verification**: `pnpm nx run-many -t build -p api app api-client` green; `pnpm nx run-many -t lint -p api app api-client` green (0 errors; 12 pre-existing warnings only). Not runtime-tested — needs an API + a doc already in another group to exercise the skip / move paths end-to-end.

**Honest open gaps**:
- The dialog assumes the caller passes the doc's CURRENT `group` snapshot. If the row is stale (someone else moved the doc just before the dialog opens), the preview can lie. The server is the source of truth and still enforces the invariant, so the worst-case is a confusing toast — never bad data.
- There's no `move` endpoint as such — moves go through `addDocuments` with `overwrite=true`. Equivalent in result; if a future flow needs "move WITHOUT picking a target" (i.e. just remove + reassign at once), it'd need a different shape.
- The "already in another group" hint in the bulk dialog shows the *count*, not the actual current group names. Could be added if the friction is real, but for a small selection the user usually knows.

### 2026-06-15 — UI consistency pass: filter Selects + row-action collapse + audit doc

Goal: every list page hits the canonical pattern (DataTable from `@org/ui`,
server-driven paging/sort/search, `Select` filters over chips, ≤ 3 inline row
icons + `⋯` for the rest, linkable name cell, `/foo/new` + `/foo/:id/edit`
routes). One-off pass — no standing audit doc.

What landed:

1. **Admin "Config" route rename** — `/admin/intelligence/lookups`, `/admin/legal-reference`, and friends now live under `/config/*` (per the tidy-sidebar memory). Legacy `AdminLookups` deleted; `LookupManager` is the survivor.
2. **GroupsPage** — kind chips → `Select`; name cell is now a `Link` to detail (no more reliance on the row's Open icon).
3. **BatchesPage** — status chips → `Select` in the DataTable toolbar slot.
4. **ReviewQueuePage** — type/status chips → `Select` (still fixed 500-row page on purpose: the stepper needs the full set; annotated in the audit).
5. **VaultPage** — 5 inline icons collapsed to 3 + `⋯` (`DropdownMenu`) so rows match the rest of the app's density.
6. **LegalReferenceManager** — three `Select` filters in the toolbar (Active / Public / Code) wired to the existing `active` / `public` / `act` query params; the Code dropdown is populated from `facets.acts` returned by `listAdmin`, so it tracks the visible corpus (matches the same pattern as the server-faceted toolbar elsewhere). Added a `Clear all` ghost button when any filter is non-default. Marked ✅ Keep in the audit table; removed from the prioritised fix list.
7. **`AdminSettingsPage` crash fix** — `/config/settings` was hitting the wrong path (the controller is mounted at `admin/settings`, not `config/settings`), so a 404 JSON envelope flowed into `setRows(...)` and the next render blew up on `rows.map`. Repointed all three callsites (GET/PATCH/DELETE) to `${apiUrl}/admin/settings`, and added an `Array.isArray` guard so any future shape drift renders an empty state instead of crashing the page.

**Verification**: `pnpm nx typecheck app` still shows four pre-existing errors in DocumentsList / GroupIntelligencePanel / DocumentInsights / data-table.tsx — none in any file touched by this pass. Not runtime-tested for the LegalReferenceManager filter combo or the settings-page fix; both want a quick browser pass before claiming green.

**Open follow-ups** (still on the audit's prioritised list):
- GroupsPage name cell → `Link` (done now).
- PipelineManager / DocTypesPage — move toolbar toggles into the DataTable `toolbar` slot + server-paginate before the catalog grows past ~50.
- Extract the `DocumentsToolbar` (Select + active-filter pills) into a shared util once a second list wants exactly the same shape — not pre-extracted today.
- Investigate / clean up the four pre-existing typecheck errors before they start drifting more files (`Button` variant union no longer admits `'default'`; `DocumentInsights` calls `useDocumentInsights()` with zero args; `data-table.tsx` `pinned: 'right' | 'left'` widened beyond the prop type).
