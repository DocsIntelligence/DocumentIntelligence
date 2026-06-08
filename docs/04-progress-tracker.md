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
| Court structural scaffolds (cause title, prayer, verification, memo of parties) | 🟡 | Shipped as **server-side prompt scaffolds** (`apps/api/.../legal-ai/court-scaffolds.ts`) that structure AI-drafted court docs in the freeform editor. A reusable React `_internals` set for *structured* court templates is still future. |
| Citation library with effective dates (IPC→BNS, CrPC→BNSS, Evidence→BSA) | 🟡 | **correctness-critical** — `@org/legal-reference` (act-level reforms authoritative; section maps confidence-annotated + "verify against bare act"). Wired into legal-ai generate/revise as a guardrail. Expand section coverage + a server-side citation-fill step next. |
| Court & legal **document presets** (notice §138, general notice, consumer, bail ×2, plaint, WS, vakalatnama, affidavit, RTI) | ✅ | `DOCUMENT_PRESETS` in `@org/legal-reference` → New-document picker "Court & legal" section → AI draft (with `presetKey` scaffold + criminal-code guardrail) → freeform editor. |
| Legal notice family (consumer/employment/civil/§138) | 🟡 | Available as AI presets (notice-138, general). Dedicated structured templates not built. |
| Consumer complaint (CP Act 2019) | 🟡 | AI preset (`consumer-complaint`). |
| Affidavits (name-change/address/lost-doc/general) | 🟡 | AI preset (`affidavit-general`); specific variants via the brief. |
| Bail application (regular + anticipatory, **BNSS**) | 🟡 | AI presets (`bail-regular`, `bail-anticipatory`) with BNSS guardrail. |
| Plaint / Written Statement + Vakalatnama + Memo of Parties | 🟡 | AI presets (`plaint`, `written-statement`, `vakalatnama`). |
| Writ petition scaffold (Art. 226/32) | ⬜ | advocate-gated; add as a preset + scaffold next. |

## Phase D — Sharing, signing, collaboration

| Item | Status | Notes |
|---|---|---|
| Share links (view/comment/edit) | ✅ | Backend `shares` module + **frontend**: api-client + `ShareDialog` (mode/password/expiry → copyable link) in BuilderShell + freeform editor; public `/s/:token` view (`SharedDocumentView`) renders freeform read-only. (Public view lives in `apps/app`, not `apps/web`.) |
| Section-anchored comments (REST + SSE) | 🟡 | REST done: `comments/` module (list/add/resolve, owner+org access) + api-client + `useComments`/`useAddComment`/`useResolveComment` + `CommentsDialog` in both builders + guest comments via share token (`SharedDocumentView`). **SSE live-refresh not done** (react-query refetch only); `anchor` stored but UI is document-level. |
| Document version history (snapshot / list / restore) | ✅ | `GET/POST` version endpoints + `VersionHistoryDialog` wired into both builders (reversible restore). |
| Multi-signer drawn/typed signatures | 🟡 | Capture done: `signers/` module (list/add/update/remove + `:signerId/sign` recording drawn-PNG/typed signature into `DocumentSigner.evidence` with IP/UA, auto-flips doc to `signed` when all sign) + api-client + `useSigners`/`useAddSigner`/`useUpdateSigner`/`useRemoveSigner`/`useSignSigner` + `SignaturesDialog` (draw pad + image upload + typed) in builder + freeform editor. **Not done:** rendering the captured signature onto the exported PDF/artboard, and reorder UI. |
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
| Long-tail consumer docs (NDA/MoU/will/RTI/…) | 🟡 | Available as AI presets in `@org/legal-reference` `DOCUMENT_PRESETS` (NDA, MoU, partnership deed, offer letter, gift deed, will, GPA, RTI). Structured templates optional later. |
| Hindi UI on `apps/app` | 🟡 | App **shell + dashboard** now translated (MainLayout nav/CTA/logout + in-shell `LanguageSwitcher`, Dashboard greeting/cards/recent/status) with real Hindi in `hi/translation.json`. **Remaining:** DocumentsList, NewDocumentPicker, editors+dialogs, auth, Settings finish, toasts — plus native-speaker QA of the (AI-authored) Hindi. Pattern is `t('key','English default')`. |
| eStamp aggregator integration | ⬜ | manual stamped-paper upload first |
| PWA + offline drafting | ⬜ | redux-persist already wires storage |

## How to use this file
- Flip status emojis as PRs merge; cite the file/module in the Notes column.
- When you finish a Phase A–C item, also update the relevant success metric in
  [`02-product-roadmap.md`](02-product-roadmap.md).
- If a new doc type required code *outside* its `DocumentTypeBundle`, note it here as tech debt —
  it means the abstraction needs fixing (see [`README.md`](README.md) "single most important fact").
