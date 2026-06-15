# 11 — Statute-Aware Drafting Suite (modernise · lint · bundle · reconcile · ask) — PLAN (revised)

**Status:** PLAN, revised after review. Replaces the original "Case Workspaces + matter-scoped RAG"
draft (kept in §A for reference). No code shipped yet.
**Last updated:** 2026-06-15.
**Goal:** ship five tightly-scoped features that **directly weaponise the existing citation
validator + DocumentTypeBundle architecture** and need no new infrastructure. Together they
form a coherent product story unique to the India SMB legal market — "your IPC templates are
now wrong; we modernise them, lint your new drafts, generate consistent multi-doc bundles, flag
cross-document conflicts, and answer questions about any doc." Each feature ships independently;
each rides on code that already exists.

The original `docs/11` proposed a generic `Workspace` primitive + matter-scoped RAG over
pg_vector + chat threads + a 9-model schema. Internal review concluded:

1. The plan contradicted itself (§1 said "no RAG", §5/§7 shipped RAG). See §A.1.
2. RAG is the wrong architecture at the corpus sizes we'll actually see (≤300k tokens).
3. The matter-management surface is a graveyard against Clio/Provakil/CaseFox; we'd lose 18+
   months chasing feature parity in a category we don't differentiate in.
4. The 6-7 week schedule was 2-3× optimistic for the planned scope.
5. The genuinely differentiated levers — citation validator + DocumentTypeBundle — were
   under-prioritised under chat / RAG / type-system schema-as-data plumbing.

This revision **deletes** the workspace primitive (as planned), the RAG path, the chat thread
model, the embedding worker, the pg_vector dependency, and the org-configurable type/label
systems. It **keeps** a trivial `DocumentGroup` wrapper as the container, and centres the
roadmap on five high-leverage features that ride existing infrastructure.

---

## 0. Reasons NOT to build this (read first)

1. **The drafting + intelligence + Vault product already works.** Adding five new feature
   surfaces invites scope creep and slows runway. Do these five only if they deepen the moat
   we've already established. **(Confidence: high.)** **Mitigation:** every feature in §1
   must visibly use the citation validator OR the DocumentTypeBundle. If a feature doesn't, cut it.
2. **The BNS/BNSS/BSA modernisation window is closing.** The transition happened 2024-07-01.
   For ~12-24 months the "your old templates reference repealed sections" pitch is sharp;
   after that the market settles. We either ship the Repeal Modernizer in this quarter or
   the differentiation decays. **(Confidence: high.)**
3. **None of these features are individually impressive in a demo.** Each is useful; none is
   a "wow" by itself. The product story works *combined*. Plan for that — sell the suite,
   not the individual features. **(Confidence: moderate.)**
4. **The intelligence pipeline (`docs/05`, `docs/07`) is not runtime-verified end-to-end yet.**
   Features 4 and 5 below depend on the extraction output being reliable. Verify
   end-to-end before committing to Feature 4 schedule. **(Confidence: high — flagged in memory.)**

If those don't kill it, the opportunity is below.

---

## 1. What we're building

Five features, ranked by **unique × useful × cheap-given-existing-code**, plus a deliberately
trivial container primitive (`DocumentGroup`). No workspace primitive. No chat threads. No RAG.

| # | Feature | Backend module | Frontend page(s) | Wedge | Effort |
|---|---|---|---|---|---|
| 1 | **Repeal Modernizer** | `apps/api/src/app/modernizer/` | `/modernise`, `/modernise/:documentId` | "Update an IPC/CrPC/Evidence draft to BNS/BNSS/BSA in one click." | ~1-2w |
| 2 | **Citation Linter (real-time)** | `apps/api/src/app/citation-linter/` | `/lint` (org overview), in-editor inline marks | "Lint every draft against current Indian statutes as you type." | ~1-2w |
| 3 | **Bundle Generator** | `apps/api/src/app/bundles/` | `/bundles`, `/bundles/new`, `/bundles/:bundleId` | "Generate N internally-consistent docs from one shared-metadata form." | ~2-3w |
| 4 | **Cross-Doc Consistency Checker** | `apps/api/src/app/consistency/` | `/groups/:groupId/conflicts` | "Flag when your sale deed and your agreement disagree about the buyer's name." | ~1-2w |
| 5 | **Per-doc Ask + Auto-Summary** | `apps/api/src/app/document-ask/` | `/ask` (history), modal on any doc page | "Ask any document a question; get an answer with statute warnings." | ~1w |
| — | **`DocumentGroup` primitive** | `apps/api/src/app/document-groups/` | `/groups`, `/groups/:groupId` | Container substrate for #3 / #4. | ~3-5d |

Total: **~6-8 weeks** for one focused engineer. Each feature ships independently to paying
customers; no big-bang release. Detail on each below in §3.

### Architecture constraint (binding)

Each feature is a **first-class NestJS module** on the backend (own `*.module.ts`, controller,
service, DTOs, tests) and has at least one **dedicated UI page** on the frontend with its own
route + sidebar entry. We do not extend the existing `legal-ai` module, we do not pile new
side-panels into `TemplateEditor`, and we do not gate features behind buried buttons. In-editor
entry points (e.g. a "Modernise" button on the editor toolbar) **deep-link to the feature's
own page** rather than rendering inline. This keeps every feature shippable, removable, and
demo-able on its own.

### 1.1 The container primitive — `DocumentGroup` (minimal)

Bundle generator output, cross-doc consistency, and shared "modernise all" actions need
*something* to group documents under. We use a deliberately tiny model — not the 9-model
workspace from the original plan.

- One row = a group of related documents (a generated bundle, an uploaded folder, a
  user-curated set).
- `Document.groupId` nullable FK — backwards compatible; existing drafts keep `groupId = null`.
- No members, no roles, no timeline, no chat, no admin type system, no per-org label
  customisation. Three group `kind` values hardcoded in TS: `bundle | folder | matter`. Promote
  to data if and only if a paying customer asks.

Full schema in §4.

---

## 2. Scenarios this enables

1. **Modernise a precedent library** — senior advocate uploads 200 old precedent drafts; the
   Repeal Modernizer runs over each, generating modernised copies; partner reviews + accepts.
   This is *the* immediate-pain pitch in India right now.
2. **Lint a fresh draft** — junior associate types up a bail application referencing "Section
   437 CrPC"; the linter immediately flags it: *"CrPC was repealed 2024-07-01 — use BNSS §480"*.
   Click → replace.
3. **Generate a property-purchase bundle** — buyer fills 6 fields (buyer name, seller name,
   property ID, sale amount, date, jurisdiction). System generates the agreement to sell, the
   sale deed, the encumbrance certificate draft, the possession letter, the stamp-paper
   schedule — all 5 docs with the same buyer/seller/property names spelt identically, the same
   amount in words and figures, the same dates. Bundle lands in one `DocumentGroup`. User
   reviews, edits, exports as zip.
4. **Reconcile an uploaded bundle** — paralegal uploads 8 documents that were drafted by
   different counsel for one transaction. Consistency checker flags: *"Buyer name varies:
   'Ramesh Kumar' (3 docs), 'Ramesh K.' (2 docs), 'R. Kumar' (3 docs). Property area: 1200
   sq.ft. in 5 docs, 1250 sq.ft. in 3 docs. Date of agreement: 12-Mar-2026 vs 21-Mar-2026."*
5. **Ask a specific document** — user opens `sale-deed.pdf`, clicks **Ask**, types *"who is
   the registered owner?"* — server drops the deed's plaintext into the LLM context, answers
   verbatim with a page locator, and the citation validator runs on the answer.

That's the entire product surface. No chat threads, no matter management, no calendar, no
billing.

---

## 3. The five features — detail

### 3.1 Repeal Modernizer

**What.** User opens any draft (their own, or an uploaded template). Clicks "Modernise to BNS/BNSS/BSA".
Server runs the existing citation validator over the document's plaintext. For every detected
IPC/CrPC/Evidence Act reference, the validator returns the mapped replacement (already in
`libs/shared/legal-reference/*`). Output: a side-by-side diff in the editor, with each citation
annotated. User accepts all or per-citation, then saves as a new revision (or overwrites with
audit trail).

**Why unique.** Every Indian advocate's template library is post-2024 broken. No tool ships an
automated bulk-modernisation pass. Provakil tracks cases; CaseFox bills hours; Clio doesn't
even know what BNS is. This is timely (transition was July 2024; window before settled ≈ 18
months) and dead easy to demo.

**Reuse:**
- `libs/shared/legal-reference/*` — IPC↔BNS, CrPC↔BNSS, Evidence↔BSA section maps already exist.
- `apps/api/src/app/legal-ai/*` — validator already returns `{ act, section, status: 'repealed', replacement: { act, section } }` per the existing shape.
- `apps/app/src/app/features/editor/*` — TemplateEditor's decoration/mark system handles inline diff overlays.

**Net new:**
- `POST /documents/:id/modernise` — runs the validator, returns `{ changes: [{ range, original, suggested, source }] }`.
- `POST /documents/:id/modernise/apply` — applies the accepted changes, persists a revision.
- `ModernisePanel.tsx` — side panel in the editor showing the diff list, per-row Accept/Reject, Accept All.

**Out of scope for v1:**
- Modernising scanned/OCR'd PDFs (only works on docs whose plaintext is already available — true for any draft + any parsed upload).
- Cross-language modernisation (Hindi/Marathi precedent libraries) — v2.
- Bulk modernisation across an entire library in one job — v1.1 (the single-doc endpoint is the building block).

**Confidence:** high. The validator + replacement map already exists; this is wiring + UI.

### 3.2 Citation Linter (real-time)

**What.** In TemplateEditor and BuilderShell, a debounced (500ms) save-side hook runs the
validator on the current draft. Returns a list of issues `{ range, severity, message, suggestedFix }`.
The editor renders these inline (red squiggle = repealed; amber = ambiguous; blue info = confirmed
current). Hovering a squiggle shows the message + a one-click "Apply fix" affordance.

**Why unique.** The citation validator is the moat. Making it visible *while drafting* is the
demo screenshot. No other India-jurisdictional tool ships a real-time statute linter inside the
editor. Harvey doesn't know BNS. CoCounsel doesn't know India. Spellbook is US contracts.
Provakil and CaseFox don't draft.

**Reuse:**
- Validator (same as 3.1).
- TemplateEditor decoration API — already used for AI-suggestion overlays.
- The Legal & AI side panel exists per CLAUDE.md; this becomes a tab inside it.

**Net new:**
- Debounced lint endpoint `POST /documents/:id/lint`.
- "Lint" tab in the Legal & AI panel with the issue list, jump-to-range, dismiss, apply-fix.
- Editor decoration renderer for citation marks.

**Out of scope for v1:**
- Multi-language linting.
- Linting custom in-house references (firm-specific authority lists) — v2 if a customer asks.

**Confidence:** high.

### 3.3 Bundle Generator

**What.** User picks a bundle template from a small hardcoded list. Initial set:

1. **Property Purchase Kit** — agreement to sell + sale deed + possession letter + encumbrance check + stamp schedule.
2. **Founder Onboarding Kit** — offer letter + NDA + IP assignment + employment agreement + vesting schedule.
3. **Bail Application Filing Kit** — bail application + supporting affidavit + vakalatnama + index of documents.

(Add more as customer demand surfaces; do not build an admin UI for v1.)

One form collects the *shared metadata* for the bundle (parties, dates, key amounts, addresses).
On submit, the server fans out to the existing AI-draft flow once per template, passing the
shared metadata pre-filled. Vault entity autofill applies. All resulting drafts land in a new
`DocumentGroup` (`kind = 'bundle'`). User reviews each in the editor, tweaks, exports as zip
or merged PDF.

**Why unique.** Multi-document generation with *shared metadata* so the docs are internally
consistent — same buyer name across the agreement, the deed, the possession letter — is
genuinely novel. I have not found a competitor (Indian or global) shipping this. Maps directly
to the DocumentTypeBundle architecture (one source of truth per doc type, per CLAUDE.md), so
the substrate already exists.

**Reuse:**
- `DocumentTypeBundle` (one per doc type — CLAUDE.md non-negotiable).
- Existing AI-draft flow + AI provider abstraction.
- Vault autofill.
- Batch progress UI from `docs/07` P4.4 (the fan-out takes 30-90s; this UI is already shipped).

**Net new:**
- `BundleTemplate` — hardcoded TS module, not a DB table for v1. Each entry:
  ```ts
  {
    key: 'property_purchase',
    label: 'Property Purchase Kit',
    componentTemplateKeys: ['agreement_to_sell', 'sale_deed', 'possession_letter', ...],
    sharedFieldSchema: ZodSchema,        // buyer, seller, property_id, sale_amount, ...
    fieldToComponentMap: Record<string, string[]>  // which shared fields feed which template
  }
  ```
- `BundleGenerationService.run(bundleKey, sharedFields, userId)` — orchestrator. Reuses the
  existing AI-draft path; collects N drafts; creates a `DocumentGroup`; returns groupId.
- `/bundles/new` page — picker → shared-metadata form (driven by `sharedFieldSchema` via the
  shared `@org/dto` Zod + react-hook-form pattern per CLAUDE.md §4).
- Progress UI (reused from `docs/07` P4.4).
- Group detail page Documents tab (reused for both 3.3 output and 3.4 input).

**Out of scope for v1:**
- Admin UI for editing bundle templates (hardcode 3; promote to DB on customer demand).
- Per-org overrides.
- Conditional templates (e.g. "include encumbrance check only if jurisdiction = MH") — v2.
- Re-running a partial bundle ("re-generate just the sale deed with corrected dates") — v2;
  for v1 user re-runs the whole bundle.

**Confidence:** high on architecture; **moderate** on effort because the orchestrator needs
careful error handling when one component-template draft fails partway through a 5-doc fan-out.

### 3.4 Cross-Doc Consistency Checker

**What.** Given a `DocumentGroup`, run a server-side comparison of extracted entities/dates/amounts
across every document in the group. Surface a **Conflicts** panel on the group page with rows
like *"Buyer name: 'Ramesh Kumar' (in `agreement.pdf`, `sale-deed.pdf`) vs 'Ramesh K.' (in
`possession.pdf`)"*. Each conflict is dismissible (false positive) or resolvable by clicking
into the docs that disagree.

**Why unique.** Cross-document fact reconciliation is the single most error-prone part of
real legal work, and no consumer-facing tool does it proactively. Lawyers manually eyeball
this today. It's distinct from Q&A (no question being asked) and from search (not retrieval).
It's "AI catches what humans miss" — the demo writes itself.

**Reuse:**
- Intelligence pipeline extraction (`docs/05` Phase 0-3 code-complete per memory).
- Vault entity matcher (handles aliasing/normalisation already — `Ramesh K.` ≈ `Ramesh Kumar`).
- Review Queue UI shape from `docs/07` P4.3 (issue list → click to resolve).

**Net new:**
- `ConsistencyService.check(groupId)` — iterate every document's extracted fields, group by
  canonical field name (Vault matcher does the alias collapse), flag mismatches, severity-rank
  (critical for parties/amounts/identifiers; warning for dates; info for stylistic variance).
- `POST /groups/:id/consistency/run` and `GET /groups/:id/consistency`.
- Conflicts tab on the group detail page.

**Out of scope for v1:**
- Auto-fix ("normalise buyer name across all 5 docs") — v2. v1 surfaces the conflict only.
- Semantic conflict detection ("clause 4 in doc A says X, clause 7 in doc B says NOT X") —
  v3 at earliest; needs LLM reasoning across pairs, expensive.

**Confidence:** moderate-to-high. Hinges on extraction reliability (see §0 risk #4).

### 3.5 Per-doc Ask + Auto-Summary

**What.**
- **Auto-Summary.** After upload + parse, a low-cost LLM call (Claude Haiku 4.5 default)
  generates a 1-3 sentence summary + key-entities-and-dates dump. Persisted on `Document.summary`
  + `Document.extractedKeyFacts` (small JSON). Shown in document list views so the user doesn't
  need to open 30 PDFs to know what's in a folder.
- **Per-doc Ask.** Every document page gets an "Ask" button → opens a modal → user types a
  question → server drops the document's full plaintext into the LLM context (direct context,
  no retrieval) → returns answer with citation-validator warnings overlaid → persisted as a
  `DocumentQA` row for audit.

**Why ship this.** Commodity feature, but table-stakes — without it, the suite feels behind
Harvey/CoCounsel even though the unique stuff above is better. Cheap given what exists.

**Reuse:**
- AI provider abstraction (`apps/api/src/app/ai/*`).
- Citation validator runs over the LLM's response.
- `Document.plaintext` already populated by the intelligence pipeline.

**Net new:**
- `Document.summary: String?`, `Document.extractedKeyFacts: Json?` columns.
- Post-parse hook that fires the summary call.
- `POST /documents/:id/ask` — `{ question }` → `{ answer, citations, warnings, tokensIn, tokensOut, modelUsed }`.
- `DocumentQA` model — small audit trail.
- Ask modal in the document UI.

**Out of scope for v1:**
- Multi-document Ask ("ask across these 5 docs") — v2. For v1, multi-doc reasoning is the
  Consistency Checker's job, not Ask's.
- Streaming responses (SSE) — v1.1 (single-doc Ask is fast enough non-streaming).
- Chat threads — never. We are not building a chat product.

**Confidence:** high.

---

## 4. Data model (Prisma)

Total new schema: **3 small models + 3 columns on `Document`**. No `Workspace`, no `WorkspaceChunk`,
no `WorkspaceChatThread`, no `WorkspaceMember`, no `WorkspaceEvent`, no `WorkspaceType`,
no `WorkspaceBundleTemplate`, no `WorkspaceEntity`.

```prisma
/// A simple container for related documents. Used by:
/// - Bundle Generator output (kind='bundle')
/// - Uploaded folders the user curates manually (kind='folder')
/// - Optional matter-style grouping (kind='matter') — UI labelling only, no behaviour difference.
model DocumentGroup {
  id           String   @id @default(cuid())
  ownerUserId  String?
  ownerOrgId   String?
  name         String
  /// Hardcoded enum in TS: 'bundle' | 'folder' | 'matter'. Drives only labelling + the
  /// generator that produced it. No admin type system in v1.
  kind         String   @default("folder")
  /// Free-form metadata bag. For 'bundle' groups, stores the shared-fields snapshot
  /// (used by the consistency checker as ground truth and for "regenerate bundle" later).
  metadata     Json     @default("{}")
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  documents    Document[]
  conflicts    DocumentGroupConflict[]

  @@index([ownerOrgId, updatedAt])
  @@index([ownerUserId, updatedAt])
}

/// One detected cross-doc inconsistency. Populated by ConsistencyService.check().
/// Cheap to recompute — full table can be wiped + repopulated per run.
model DocumentGroupConflict {
  id            String   @id @default(cuid())
  groupId       String
  /// Canonical field name (e.g. 'buyer.name', 'property.area_sqft', 'agreement.date').
  field         String
  /// JSON array: [{ documentId, value, locator? }, ...] showing every distinct value seen.
  observations  Json
  /// 'critical' | 'warning' | 'info'.
  severity      String   @default("warning")
  status        String   @default("open")    // 'open' | 'dismissed' | 'resolved'
  resolvedBy    String?
  resolvedAt    DateTime?
  createdAt     DateTime @default(now())

  group DocumentGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId, status])
}

/// Per-doc Ask audit trail. One row per Q+A pair.
model DocumentQA {
  id          String   @id @default(cuid())
  documentId  String
  userId      String
  question    String
  answer      String
  /// JSON array of citation-validator output: [{ act, section, status, replacement? }, ...]
  citations   Json?
  /// JSON array of warnings (repealed-code, ambiguous, etc).
  warnings    Json?
  tokensIn    Int      @default(0)
  tokensOut   Int      @default(0)
  modelUsed   String?
  createdAt   DateTime @default(now())

  @@index([documentId, createdAt])
  @@index([userId, createdAt])
}

/// On existing Document model — three additive nullable fields, backwards compatible:
model Document {
  // ... existing fields
  groupId           String?
  group             DocumentGroup? @relation(fields: [groupId], references: [id])
  summary           String?
  extractedKeyFacts Json?

  @@index([groupId])
}
```

**Note on `BundleTemplate`.** Deliberately *not* a Prisma model in v1. Hardcoded in a TS module
(`apps/api/src/app/bundles/templates/*.ts`) — one file per bundle. Each file exports `key`,
`label`, `componentTemplateKeys`, a Zod schema for shared fields (per CLAUDE.md `@org/dto`
convention), and a field-to-component mapping. Promote to a DB model only when ≥2 customers
have asked for org-custom bundles.

**Confidence on the model:** high. Validated against all 5 scenarios in §2.

---

## 5. API surface

All under `JwtAuthGuard`, owner/org-scoped, audited via existing activity-log patterns.

### Modernizer
- `POST /documents/:id/modernise` — returns diff (no mutation).
- `POST /documents/:id/modernise/apply` — body: `{ changes: [{ rangeId, action: 'accept' | 'reject' }] }`. Persists a revision.

### Linter
- `POST /documents/:id/lint` — body: `{ content?: string }` (optional; defaults to current persisted content). Returns `{ issues: [{ range, severity, message, suggestedFix? }] }`. Cached server-side keyed by content hash.

### Bundles
- `GET /bundles/templates` — lists available bundle templates (hardcoded).
- `POST /bundles/generate` — body: `{ templateKey, sharedFields, groupName? }`. Returns `{ groupId, jobId }`. Long-running; client polls or watches the existing batch-progress channel.
- `GET /bundles/jobs/:jobId` — job state.

### Groups
- `GET /groups` — paginated list (filter by kind, search by name).
- `POST /groups` — create empty group (for manual folder curation).
- `GET /groups/:id` — group detail (counts, conflict count).
- `PATCH /groups/:id` — rename / change kind.
- `DELETE /groups/:id` — soft delete.
- `POST /groups/:id/documents` — add existing documents to a group.
- `DELETE /groups/:id/documents/:documentId` — remove from group (does not delete the document).

### Consistency
- `POST /groups/:id/consistency/run` — kicks off (or re-runs) the consistency check.
- `GET /groups/:id/consistency` — list conflicts (filter by status/severity).
- `PATCH /groups/:id/consistency/:conflictId` — mark dismissed / resolved.

### Ask
- `POST /documents/:id/ask` — `{ question }` → `{ answer, citations, warnings, qaId }`.
- `GET /documents/:id/qa` — list prior Q&A for this document.

### Auto-summary
- Triggered internally by the intelligence pipeline. No public endpoint.
- `POST /documents/:id/resummarise` — admin/owner re-run (after model change).

**Total new endpoints:** ~15. Most are thin wrappers over existing services.

---

## 6. Reuse map

| Capability | Existing | Used by |
|---|---|---|
| Citation validator (BNS/BNSS/BSA + repeal map) | `libs/shared/legal-reference/*`, `apps/api/src/app/legal-ai/*` | Features 1, 2, 5 |
| TemplateEditor + decoration/marks | `apps/app/src/app/features/editor/*` | Features 1, 2 |
| BuilderShell structured editor | `apps/app/src/app/features/documents/builder/*` | Feature 2 |
| Intelligence pipeline (parse → classify → extract) | `apps/api/src/app/intelligence/*` per `docs/05`, `docs/07` | Features 4, 5 |
| AI provider abstraction | `apps/api/src/app/ai/*` | Features 1 (replacement-validate), 3 (draft fan-out), 5 (summary, ask) |
| Vault entity matcher (alias collapse) | `apps/api/src/app/vault/*` | Feature 4 |
| Vault autofill | `apps/app/.../features/vault/*` | Feature 3 |
| DocumentTypeBundle (one per doc type) | per CLAUDE.md, existing 4 bundles | Feature 3 |
| AI-draft flow | existing per `docs/05` | Feature 3 |
| Batch / progress UI | `docs/07` P4.4 | Feature 3 |
| Review Queue list pattern | `docs/07` P4.3 | Feature 4 conflicts UI |
| Form: react-hook-form + `@org/dto` Zod | CLAUDE.md §4 non-negotiable | Feature 3 shared-metadata form |
| `applyServerFieldErrors` | existing | All form submissions |
| `@org/ui` components (DataTable, Select, DatePicker, etc.) | per memory `feedback_use_ui_components` | All UI |
| Lookup groups | `apps/api/src/app/lookup/*` | Group `kind` (if we ever promote to data) |

**What's genuinely new:** the 3 models + 3 columns above, ~15 endpoints, 5 UI surfaces
(Modernise panel; Lint tab; Bundle picker + form + progress; Group detail + Conflicts tab;
Ask modal). ~25-30% of total LOC; the rest is wiring.

---

## 7. UI / UX

**Sidebar:** one new top-level entry — "Bundles" (label settled; not customisable in v1).

### Pages

- `/bundles` — DataTable of all `DocumentGroup` rows owned by the user/org. Filters: kind, date.
  Stat tiles: total / bundles / folders / matters. "+ New" → opens a small menu: Generate Bundle | New Folder | New Matter.
- `/bundles/new` — Bundle template picker (3 cards initially). Click → shared-metadata form
  (react-hook-form + `@org/dto` Zod). Submit → progress page → redirect to `/bundles/:id`.
- `/bundles/:id` — group detail. Two tabs:
  - **Documents** (`/bundles/:id`) — list of docs in the group with summary + state.
    Per-row "Open" / "Ask" / "Modernise" actions. Drop-zone for adding files. "+ Add existing doc" picker.
  - **Conflicts** (`/bundles/:id/conflicts`) — list of `DocumentGroupConflict` rows.
    Severity badge, observation list (with click-to-open), Dismiss / Resolve.
- **Editor (existing pages)** — gains:
  - **Lint** tab inside the Legal & AI panel (issue list, inline marks).
  - **Modernise** button that opens the diff panel.
  - **Ask** button (lives on any document view — uploads or drafts).

**No** chat thread page. **No** matter overview with timeline / people / activity. **No**
per-group settings (just rename + delete on the detail page header).

### Editor integration nuance

- When a draft is created from a Bundle Generator run, it carries `groupId` set on the
  `Document` row. The breadcrumb shows `Bundle: Property Purchase — Sharma×Mehta / Draft: Sale Deed`.
- Vault autofill in the editor is pre-scoped to the bundle's shared metadata so dropdowns
  surface "Buyer: Ramesh Kumar" first, not every Person row.

**Confidence:** high on UI shape — every component maps cleanly to existing patterns.

---

## 8. Phasing

Eight weeks for one focused engineer. Each phase ships independently.

| Week | Deliverable | Verification |
|---|---|---|
| 1-2 | **Repeal Modernizer.** Endpoint + diff panel + apply. Add `DocumentQA` model (used in week 8 too) early so migrations don't pile up. | Manual: take 5 known IPC-era drafts, run modernise, verify mappings. Typecheck + eslint + build per CLAUDE.md. |
| 3-4 | **Citation Linter.** Lint endpoint + decoration renderer + Legal & AI panel tab. Add `DocumentGroup` model + `groupId` FK migration in week 3 (1 day inside the week). | Manual: type IPC references → squiggle appears within 1s. |
| 5-6 | **Bundle Generator.** 3 hardcoded templates (Property Purchase, Founder Onboarding, Bail Filing). Orchestrator + shared-metadata form + progress UI + group detail page Documents tab. | E2E: generate each of the 3 bundles end-to-end; verify all docs have consistent shared fields. |
| 7 | **Cross-Doc Consistency Checker.** Service + endpoints + Conflicts tab. Run automatically after bundle generation + on user request for uploaded folders. | E2E: generate a bundle, manually edit one doc to introduce a name mismatch, run check, verify it's flagged. |
| 8 | **Per-doc Ask + Auto-Summary.** Summary added to post-parse pipeline hook. Ask modal + endpoint. `DocumentQA` audit (model exists from week 1). Hardening / telemetry / BUILD_LOG pass. | E2E: upload a sale deed, verify summary appears, ask "who is the buyer?", verify answer cites the doc. |

**Out of scope explicitly (do not build in v1):**
- Bulk modernisation of an entire library in one job (v1.1).
- Admin UI for editing bundle templates (v1.2 only on customer demand).
- Multi-language linting / Ask (v2).
- Streaming Ask responses (v1.1).
- Multi-doc Ask (handled by Consistency Checker instead — never as a chat thread).
- Group members / sharing / per-role permissions (v1.2 only on customer demand).
- Group timeline / events (no plan to build; matter management = trap per §A.2).
- Org-level label customisation ("Cases" vs "Matters") — settled as "Bundles" + "Matters" + "Folders" hardcoded.

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Intelligence pipeline extraction not runtime-verified yet (per memory) | High | High | Spend 2-3 days verifying end-to-end on real Indian docs before committing to Feature 4 schedule. Feature 4 is the most extraction-dependent. |
| Repeal mapping coverage incomplete | Med | Med | Audit `legal-reference` for IPC/CrPC/Evidence coverage; fill gaps before shipping Feature 1. |
| BundleGenerator fan-out partial failure (one of N drafts fails) | Med | Med | Orchestrator returns per-component status; UI shows partial success with per-row retry. Don't roll back successful drafts. |
| Citation validator hallucinated *facts* (not citations) in Ask | Med | High | Direct-context architecture mitigates (full doc in context). Validator catches citation hallucination, not name hallucination. Add a UX disclaimer + "see source" links on every Ask response. |
| LLM provider data retention (privileged docs) | Med | High | Use ZDR endpoints on Anthropic / OpenAI for paid plans. Document the policy. Indian in-house procurement will ask. |
| Embedding cost / context cost spirals | Low | Low | No embeddings (we dropped RAG). Per-Q context cost is bounded by `plaintext` size; add per-org daily token caps. |
| Scope creep into matter management | High | High | This document. Reread §A.2. No timeline, no members, no chat. |
| Bundle templates too rigid for real customers | Med | Med | Hardcode 3 in v1; promote to DB + admin UI only after ≥2 customer asks. Watch which templates get edited heavily after generation — that's the signal. |
| Linter latency hurts editor responsiveness | Med | Low | Debounce 500ms; cache by content hash; lint runs server-side async with UI showing "linting…" indicator. Acceptable per existing AI-suggestion patterns. |
| Existing AI-draft flow doesn't accept shared-metadata pre-fill cleanly | Low | Med | Verify in week 5 day 1; the DocumentTypeBundle architecture should support this trivially. |

---

## 10. Open questions

Cut hard from the original 11. Most former questions are answered by the new scope.

1. **Bundle template selection for v1.** Confirm the 3 above (Property Purchase, Founder Onboarding, Bail Filing) — or substitute. **Recommendation: ship these three; they map to the existing 4 DocumentTypeBundles.**
2. **Modernizer scope: drafts only, or uploaded PDFs too?** Uploaded PDFs need `plaintext` from the pipeline. Drafts have plaintext natively. **Recommendation: ship drafts-only in v1; add uploaded-doc modernise as v1.1 once the intelligence pipeline is runtime-verified.**
3. **Ask default model.** Claude Haiku 4.5 for speed + cost; toggle for Sonnet on hard questions? **Recommendation: Haiku default, Sonnet on user toggle, log which question types users escalate.**
4. **Auto-summary trigger.** Synchronous on parse complete (delays the upload UX by ~3-5s) vs async (summary appears later)? **Recommendation: async; fire-and-forget after parse; UI shows "summarising…" placeholder.**
5. **Conflict severity tuning.** Critical / warning / info thresholds need empirical tuning. **Recommendation: ship with conservative defaults; expose admin tunable later if needed.**
6. **Migration of existing un-grouped docs.** Today's drafts have `groupId = null`. **Recommendation: ship "Add to group" affordance from the document list in v1; no auto-migration.**

(Court integrations, conflict-of-interest checks across matters, billing, calendar — out of
the entire product roadmap, not just v1. See §A.2.)

---

## 11. Where this lands in the existing roadmap

- Updates `docs/02-product-roadmap.md` — replaces the "Case Workspaces + RAG" line with "Statute-Aware Drafting Suite (5 features)".
- Updates `docs/08-strategic-roadmap.md` — strengthens the "moat = server-side citation validator" thesis. Features 1 and 2 *are* the moat made user-visible. Feature 3 is the DocumentTypeBundle moat made user-visible.
- Adds a sibling `docs/11-statute-suite-RESUME.md` once Phase 1 (Repeal Modernizer) lands, following the `docs/05a` / `docs/10` resume-doc convention. Append a BUILD_LOG entry per CLAUDE.md after every weekly milestone.
- Reorders `docs/TASKS.md` — the durable task ledger — to put these five features above any matter-management work.

---

## 12. TL;DR for the reviewer

- **Five features, ~6-8 weeks, all riding existing code:** Repeal Modernizer · Citation Linter · Bundle Generator · Cross-Doc Consistency Checker · Per-doc Ask + Auto-Summary.
- **One trivial container primitive (`DocumentGroup`)** instead of the 9-model workspace originally planned. Three new models + three nullable columns on `Document`. Backwards compatible.
- **No RAG, no chat threads, no pg_vector, no embedding worker, no type-system admin UI.** Direct-context only.
- **The differentiator:** citation validator + DocumentTypeBundle, both already shipped, made user-visible through five tight features that no Indian SMB competitor (Provakil / CaseFox / PracticeLeague / LegalDesk Pro) and no global incumbent (Clio / Harvey / CoCounsel / Spellbook) ships together.
- **Timing pressure:** the BNS/BNSS/BSA modernisation window is open *now*. Repeal Modernizer is the lead feature for that reason — fastest demo, sharpest pitch, narrowest expiry.
- **Risk:** intelligence pipeline not yet runtime-verified end-to-end (per memory). Verify before committing to Feature 4 schedule.

**Action requested:** confirm the 5-feature scope, pick the first bundle templates (§10 Q1), confirm drafts-only modernise for v1 (§10 Q2). After that, implement Phase 1 (Repeal Modernizer) in a single tight branch and append to `docs/BUILD_LOG.md`.

---

## A. Appendix — what changed from the original plan

### A.1 The §1↔§7 contradiction (resolved)

The original plan said in §1: *"Direct-context AI (NOT RAG)… no embeddings, no vector DB."* Then §5/§6/§7/§9/§10 shipped RAG: `WorkspaceChunk`, pg_vector, embedding worker, `/index` endpoints, top-k similarity floor, embedding-cost rough-cut, pg_vector ops risk row. §13 TL;DR said the differentiator was "matter-scoped RAG."

**Resolution:** §1 was right. Direct-context only. Corpus sizes (typical 50k-300k tokens per group, occasionally up to 750k) fit comfortably in modern context windows (Sonnet 4.6: 200k; Sonnet 4.7 1M). RAG introduces failure modes (wrong-chunk retrieval, embedding-model lock-in, re-embedding on model upgrade, pg_vector ops) for zero corpus-size benefit. All RAG references deleted from the revised plan.

### A.2 The matter-management trap (avoided)

The original plan's §0 explicitly warned about scope creep into matter management (billing,
time tracking, calendar, court integrations, conflict checks). It then proposed `WorkspaceMember`,
`WorkspaceEvent`, `WorkspaceActivity`, per-role permissions, sharing, types-as-data, label
customisation — i.e. exactly the matter-management substrate it warned against.

**Resolution:** removed the workspace primitive entirely. `DocumentGroup` is a trivial 4-column
wrapper. No members, no timeline, no role-based sharing, no type admin. If a future customer
asks for matter management specifically, we revisit — with evidence, not speculation.

### A.3 The bundle generator (promoted)

The original plan's §1.1 mode #2 (bundle generator with shared-metadata fan-out) was buried
under chat / RAG / matter-management text. It is the single most differentiated feature in
the entire roadmap and now leads §3 as Feature 3.

### A.4 The per-doc Ask (promoted, replaces chat)

The original plan's chat thread model (`WorkspaceChatThread`, `WorkspaceChatMessage`) was a
generic ChatGPT-style surface. The actual user mental model from §2 example 2 — *"open the
sale deed, click Ask, get an answer"* — is per-doc Ask, not thread-based chat. Threads add cost
without value at typical corpus sizes (5-30 docs, often 1 doc at a time). Replaced by Feature 5.

### A.5 The schedule (re-honesty'd)

Original: 6-7 weeks for a 9-model schema + RAG pipeline + embedding worker + chat UI + 7 tabs.
That was 2-3× optimistic.

Revised: 6-8 weeks for 3 small models + 5 tightly-scoped features riding existing code. Realistic
given the reuse picture in §6, *if* the intelligence pipeline holds up (see §9 risk #1).

### A.6 Open questions (cut)

Original had 11 open questions covering pg_vector vs external vector DB, embedding providers,
embedding cost, retention semantics for embeddings, pricing tier confusion, label customisation,
multi-language Q&A. Most are moot under the revised scope. The remaining 6 are in §10.
