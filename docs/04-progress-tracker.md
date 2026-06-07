# Progress Tracker

> **Living document — update this as work lands.** Legend: ✅ done · 🟡 partial · ⬜ not started.
> Last verified against the codebase: **2026-06-07**.

## Foundation (from original LEGAL_DOCS_PLAN.md — mostly built)

| Component | Status | Evidence / Notes |
|---|---|---|
| Auth (email, Google/GitHub/LinkedIn OAuth, WebAuthn passkeys) | ✅ | `apps/api/src/app/auth/*`, `Passkey`/`Challenge` models |
| Payments + metering (Razorpay, plans, wallet, usage) | ✅ | `payment/` module; `Plan`/`PlanFeature`/`UserWallet`/`WalletUsage`/`Payment` |
| S3 storage (+ local fallback) | ✅ | `storage/` module |
| BullMQ + Redis job queue (+ in-memory fallback) | ✅ | used by exports + mail |
| Mail (SMTP, MailLog) | ✅ | `mail/` module |
| Admin lookups | ✅ | `admin/` + `LookupGroup`/`LookupValue` |
| Prisma domain model (all doc/org models) | ✅ | `tools/prisma/schema.prisma` — `DocumentType`, `DocumentTemplate`, `Document`, `DocumentVersion`, `DocumentShare`, `DocumentSigner`, `DocumentExport`, `DocumentComment`, `Organisation`, `OrgMember`, `BrandingProfile`; enums incl. `PageSize` (stamp paper sizes), `SignerStatus`, `ShareMode`, `OrgRole` |
| Schema-driven doc registry | ✅ | `libs/document-schema` — `DocumentTypeBundle`, `_registry.ts`, types |
| Template engine (page-faithful, stamp-paper aware) | ✅ | `libs/document-templates` — `Page`, `Paginator`, `StampPaperFrame`, `page-sizes`, `EditableField` |
| Artboard renderer (Puppeteer target) | ✅ | `apps/artboard/RenderRoute.tsx`, `__ARTBOARD_READY__` signal |
| PDF export pipeline | ✅ | `exports/` — `ExportsService`, `PdfRendererService`, `PdfRenderProcessor` |
| Rich-text editor (TipTap) + extensions | ✅ | `shared/ui/.../rich-text-editor` — transliteration, page-break, placeholder-highlight, suggestion-popover |
| Transliteration (13 Indian/regional languages) | ✅ | `libs/shared/transliteration` (Google Input Tools) |
| AI module (provider abstraction, fallback chain) | ✅ | `ai/` — `AiProvider` interface, OpenAI + Gemini providers |
| `legal-ai` clause-rewrite + rule-suggest | ✅ | `legal-ai/` — `POST /legal-ai/clause-rewrite`, `/rule-suggest`; quota + 24h cache + disclaimer |

## Document types & templates

| Item | Status | Notes |
|---|---|---|
| `rent_agreement` bundle (schema/formMetadata/risks/prompts) | ✅ | `libs/document-schema/src/rent-agreement/*` |
| `rent_agreement` / `classic` template | ✅ | `libs/document-templates/src/rent-agreement/classic` |
| `rent_agreement` bilingual template | ⬜ | planned (Marathi/Hindi heading + English body) |
| Any other document type | ⬜ | RTI, legal notice, court docs, NDA, will, etc. — none built |

## Phase A — AI drafting copilot

| Item | Status | Notes |
|---|---|---|
| Claude provider (`@anthropic-ai/sdk`, `claude-opus-4-8`) | ⬜ | only OpenAI + Gemini today; no `anthropic`/`claude` anywhere in repo |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` in config schema | ⬜ | |
| `zodToJsonSchema` helper | ⬜ | |
| `POST /legal-ai/generate` (NL brief → schema-valid `data`) | ⬜ | the headline feature |
| `POST /legal-ai/revise` (data + instruction → patched data + diff) | ⬜ | |
| `document.generate` / `document.revise` prompt-manifest entries | ⬜ | per doc type |
| Conversational intake (tool-use ask_user loop) | ⬜ | optional / flagged |
| Builder UI: "Draft with AI" + accept/reject diff | ⬜ | |
| Generation metering + cache extension | ⬜ | reuse `wallet-usage.service` + existing 24h cache |

## Phase B — Multi-format export

| Item | Status | Notes |
|---|---|---|
| DOCX export worker | ⬜ | advocate requirement; `docx` lib vs LibreOffice — see tech design §7 |
| PNG/preview-image export | ⬜ | enum already supports `png` |
| Calibration ruler PDF | ⬜ | |
| Branded output (`BrandingProfile` on PDF/DOCX) | ⬜ | model exists, not wired to renderer |

## Phase C — Court documents

| Item | Status | Notes |
|---|---|---|
| Court `_internals` scaffolding (cause title, prayer, verification, memo of parties) | ⬜ | |
| `citations.ts` library with effective dates (IPC→BNS, CrPC→BNSS, Evidence→BSA) | ⬜ | **correctness-critical** |
| Legal notice family (consumer/employment/civil/§138) | ⬜ | |
| Consumer complaint (CP Act 2019) | ⬜ | |
| Affidavits (name-change/address/lost-doc/general) | ⬜ | |
| Bail application (regular + anticipatory, **BNSS**) | ⬜ | |
| Plaint / Written Statement + Vakalatnama + Memo of Parties | ⬜ | |
| Writ petition scaffold (Art. 226/32) | ⬜ | advocate-gated |

## Phase D — Sharing, signing, collaboration

| Item | Status | Notes |
|---|---|---|
| Share links (view/comment/edit) on `apps/web` | ⬜ | `DocumentShare` model exists |
| Section-anchored comments (REST + SSE) | ⬜ | `DocumentComment` model exists |
| Multi-signer drawn/typed signatures | ⬜ | `DocumentSigner` model exists |
| One eSign provider (Digio) integration | ⬜ | webhook flow |
| eSign hard-gate for Schedule-1-excluded doc types | ⬜ | **legal requirement** |
| Audit-trail page on signed PDF | ⬜ | |

## Phase E — Multi-persona, marketplace, long tail

| Item | Status | Notes |
|---|---|---|
| Organisation/agency multi-tenancy live | 🟡 | models exist (`Organisation`/`OrgMember`/`OrgRole`); UI/flows not built |
| Advocate verification (BCI number) | ⬜ | |
| Template marketplace (revenue share) | ⬜ | `DocumentTemplate.ownerType` supports it |
| White-label share subdomains | ⬜ | |
| Long-tail consumer docs (NDA/MoU/will/RTI/…) | ⬜ | |
| Hindi UI on `apps/app` | 🟡 | i18next plumbed; content/QA pending |
| eStamp aggregator integration | ⬜ | manual stamped-paper upload first |
| PWA + offline drafting | ⬜ | redux-persist already wires storage |

## How to use this file
- Flip status emojis as PRs merge; cite the file/module in the Notes column.
- When you finish a Phase A–C item, also update the relevant success metric in
  [`02-product-roadmap.md`](02-product-roadmap.md).
- If a new doc type required code *outside* its `DocumentTypeBundle`, note it here as tech debt —
  it means the abstraction needs fixing (see [`README.md`](README.md) "single most important fact").
