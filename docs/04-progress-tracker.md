# Progress Tracker

> **⚠️ This file is no longer the burn-down.** The single durable source of truth for remaining
> work is [`TASKS.md`](TASKS.md) (checked-in ledger), and the dated journal of what shipped is
> [`BUILD_LOG.md`](BUILD_LOG.md). This page is now just a **high-level capability snapshot** so a
> newcomer can see what exists at a glance — flip nothing here; update `TASKS.md` + `BUILD_LOG.md`.
>
> Legend: ✅ done · 🟡 partial · ⬜ not started · Last verified against the codebase: **2026-06-19**.

## Platform foundation — ✅ built

Auth (email + Google/GitHub/LinkedIn OAuth + WebAuthn passkeys) · Payments + metering (Razorpay,
plans, wallet, usage) · S3 storage (+ local fallback) · BullMQ/Redis queue (+ in-memory fallback) ·
Mail (SMTP) · Admin lookups · full Prisma domain model · schema-driven doc registry
(`@org/document-schema`) · page-faithful stamp-paper-aware template engine (`@org/document-templates`) ·
Puppeteer artboard renderer · PDF export pipeline · TipTap rich-text editor · transliteration (13
languages) · AI provider abstraction with fallback chain.

## AI — ✅ three providers (the stale doc claimed "OpenAI + Gemini only")

- **Claude provider** `apps/api/src/app/ai/providers/claude.provider.ts` — default `claude-opus-4-8`,
  reads PDFs natively; config keys `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / `ANTHROPIC_VISION_MODEL`
  (`config/schema.ts`). Plus OpenAI + Gemini providers.
- **`legal-ai` generate + revise** wired (`POST /legal-ai/generate`, `/revise`, `/clause-rewrite`,
  `/rule-suggest`) with quota + cache + the criminal-code-reform guardrail; the AI never authors
  statute citations — `{{applicable_law}}` is filled deterministically from `@org/legal-reference`.
- Builder "Draft with AI" + **per-change accept/reject diff UI** (block-level LCS over HTML) shipped.

## Document-type bundles — ✅ 18 structured `DocumentTypeBundle`s (the stale doc claimed "none built")

`libs/document-schema/src/`: rent-agreement, rti, legal-notice, **cheque-bounce-notice (§138)**,
**consumer-complaint (CPA 2019)**, **anticipatory-bail (§482 BNSS)**, affidavit, nda, promissory-note,
employment-offer, power-of-attorney, invoice, receipt, quotation, purchase-order, credit-note, payslip,
will. Each = Zod schema + form-metadata + deterministic risks + versioned prompts + template(s). Plus
~66 freeform AI presets in `@org/legal-reference` `DOCUMENT_PRESETS` for the long tail.

## Correctness moat (Tier 1) — ✅ done (see `TASKS.md` Tier 1)

Server-side citation validation (`citationWarnings`) + citation-fill engine (`CitationFillerService`,
fills `{{applicable_law}}`, rewrites repealed IPC/CrPC/Evidence → BNS/BNSS/BSA) wired into
generate+revise · Schedule-1 eSign hard-gate by doc type · "Updated for 1 Jul 2024" currentness badge +
CrPC→BNSS reform lookup · PII log-stripping · legal-reference admin (add-to-masters + indiacode sync).

## Court documents (Tier 2) — ✅ bundles done

§138 cheque-bounce, consumer complaint (District/State/National), anticipatory bail (§482 BNSS), and the
writ-petition scaffold all shipped as structured bundles. Per-state risk libraries deferred (central
acts — no verifiable per-state variation; see `TASKS.md` Tier 2 for rationale).

## Export & output (Tier 3) — ⬜ the real next gap

DOCX is client-side `.doc` HTML only (no true OOXML) · PNG export ⬜ · branded `BrandingProfile`
header/footer not wired to renderer ⬜ · calibration ruler PDF ⬜.

## Sharing / signing / collaboration — 🟡

Share links (view/comment/edit) + public `/s/:token` view ✅ · section-anchored comments (REST ✅,
SSE live-refresh ⬜) · version history ✅ · multi-signer capture ✅ (rendering signature onto exported
PDF ⬜, reorder UI ⬜) · Digio eSign 🔒 (needs creds) · audit-trail page ⬜.

## Bigger streams shipped since this doc was last real

Document Intelligence (docs/05+07: classify→extract→validate→review→approve→export pipeline) ·
hybrid keyword+semantic Search (docs/09) · Document Vault (docs/10) · Estate & Wealth Vault (docs/13:
asset inventory, net worth, nominees/release, envelope encryption, CAS import, portfolio analysis).
See `BUILD_LOG.md` for the dated detail of each.

## Multi-persona / platform (Tier 6) — 🟡 / ⬜

Org multi-tenancy models exist (UI ⬜) · advocate verification ⬜ · Hindi UI partial · template
marketplace ⬜ (conflicts with the `06` cut-list — unresolved strategy item, see `TASKS.md` Tier 0) ·
white-label subdomains ⬜ · eStamp aggregator 🔒 · PWA/offline ⬜.
