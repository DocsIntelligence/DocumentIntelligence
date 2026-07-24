# Legal Document Platform — Documentation Index

> **Status as of 2026-06-07.** This `docs/` set supersedes and extends the original
> [`../LEGAL_DOCS_PLAN.md`](../LEGAL_DOCS_PLAN.md). That plan is now ~70% implemented;
> these documents describe the _current_ state, the Indian market as of mid-2026, and the
> roadmap for the next phase: **AI-driven document drafting/updating, court documents, and
> multi-format output.**

## What this product is

A jurisdiction-aware (India-first) legal-document drafting platform: schema-driven forms →
live page-faithful preview (A4 + stamp paper) → server-rendered PDF/DOCX → share, sign,
collaborate. The differentiators are **stamp-paper-aware live preview**, **Indian-language
transliteration**, a **deterministic per-state risk-rule library**, and now an **AI drafting
copilot** that can generate and edit whole documents from natural language.

## Document map

| File                                                         | Purpose                                                                                                          | Read if you want…                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`01-market-analysis-india.md`](01-market-analysis-india.md) | Indian legal-tech market, sizing, competitors, regulatory constraints (eSign/eStamp/DPDP/BCI/new criminal codes) | The "should we build this, and where's the wedge" answer  |
| [`02-product-roadmap.md`](02-product-roadmap.md)             | Phased product roadmap, document-type rollout order, pricing, success metrics                                    | The "what ships when" answer                              |
| [`03-technical-design.md`](03-technical-design.md)           | Architecture of the AI drafting engine, Claude integration, court-document support, multi-format export          | The "how we build it" answer                              |
| [`04-progress-tracker.md`](04-progress-tracker.md)           | Living checklist of what is built / partial / not-started, by component                                          | The "where are we" answer — **update this as work lands** |
| [`DEPLOYMENT.md`](DEPLOYMENT.md)                             | Single-VPS Docker + Caddy production deployment (subdomains, env, backups)                                       | The "how do we put this live" answer                      |

## The codebase in one paragraph

Nx monorepo. `apps/api` (NestJS 11, Prisma 6 + Postgres, BullMQ + Redis, S3 storage, Razorpay,
LangChain → OpenAI + Gemini). `apps/app` (React 19 + Vite, Redux Toolkit, TanStack Query,
Tailwind 4, shadcn/Radix). `apps/artboard` (isolated React renderer Puppeteer drives for PDF).
`apps/web` (Next.js 16 landing/share pages). Shared libs: `document-schema` (Zod registry: schema +
form metadata + risk rules + AI prompt manifest per doc type), `document-templates` (React
components per template, with `Page`/`Paginator`/`StampPaperFrame` internals), `shared/ui`
(TipTap rich-text editor with transliteration + page-break + placeholder-highlight extensions),
`shared/transliteration` (13 Indian/regional languages via Google Input Tools).

## The single most important architectural fact

Everything for a document type derives from **one source of truth**: a
`DocumentTypeBundle` in `libs/document-schema` (`schema` + `formMetadata` + `risks` + `prompts` +
`knownTemplates`). Get a new doc type's bundle right and the form, validation, AI prompts, risk
panel, and template all follow. **Do not** add per-template HTML hacks or ad-hoc AI prompts
outside this contract — that is how the abstraction rots and every doc type starts costing a
rewrite. This rule governs the entire roadmap.
