# Contributing & working in this repo

This is the entry point for **anyone — human or AI agent — changing this codebase.**
Read this once; it is short on purpose. Deep conventions live in
[`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md). Product context lives in
[`docs/`](docs/) (`README.md`, roadmap, technical design, progress tracker, build log).

> If you are an AI agent: also read `CLAUDE.md` (Nx rules) and skim
> [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) to see what changed recently and why.

## What this project is

An India-first **legal-document drafting platform** with an AI copilot. Nx monorepo:

| Path                      | What                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/api`                | NestJS backend (Prisma + Postgres, BullMQ + Redis, S3, Razorpay, AI: Claude/OpenAI/Gemini) |
| `apps/app`                | React 19 + Vite SPA — the authenticated product (dashboard, builders, **editors**)         |
| `apps/web`                | Next.js marketing/landing + public share pages                                             |
| `apps/artboard`           | Isolated React renderer Puppeteer drives for **PDF export**                                |
| `libs/document-schema`    | Per-doc-type **source of truth**: Zod schema + form metadata + risk rules + AI prompts     |
| `libs/document-templates` | React templates (page-faithful, stamp-paper aware) + the `freeform` renderer               |
| `libs/shared/*`           | `ui`, `utils`, `hooks`, `store`, `dto`, `api-client`, `transliteration`, `legal-reference` |
| `tools/prisma`            | schema, migrations, seed                                                                   |

There are **two document surfaces, by design** (don't merge them):

- **Structured builder** (`/documents/:id/edit`, `features/documents/builder`) — form → artboard preview → PDF. For schema-driven types.
- **Freeform editor** (`/editor`, `/documents/:id/draft`, `features/editor`) — TipTap WYSIWYG with transliteration, placeholders, page breaks, AI draft/revise. For AI-drafted / court / "any" documents.

## Setup & run

```bash
pnpm install
cp .env.example .env            # fill in DATABASE_URL, ANTHROPIC_API_KEY, etc.
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm prisma:seed
pnpm dev                        # api + app + web + artboard
# or individually: pnpm dev:api | pnpm dev:app | pnpm dev:web
```

## The golden rules (non-negotiable)

1. **One source of truth per document type** — its `DocumentTypeBundle` in `libs/document-schema`
   (schema + form metadata + risks + prompts + template keys). The form, validation, AI prompts,
   risk panel, and template all derive from it. **Never** add per-template HTML hacks or ad-hoc
   prompts outside this contract.
2. **AI never authors statute citations.** Generation prompts must keep `{{applicable_law}}`
   placeholders; the curated `@org/legal-reference` library is the source of truth for citations
   (incl. the 2024 IPC→BNS / CrPC→BNSS / Evidence→BSA reform). A model trained pre-2024 will emit
   repealed sections — guard against it.
3. **Verify every change** before claiming it works:
   ```bash
   pnpm nx run app:typecheck
   pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit
   pnpm exec eslint <changed files or dirs>
   pnpm nx run app:build        # when touching deps / bundling
   ```
   If something needs live services (Postgres/Redis/Anthropic/Puppeteer/S3) you can't run, say so
   explicitly — never imply runtime success you didn't observe.
4. **Every app needs a `tsconfig.json`** (solution-style, referencing `tsconfig.app.json`).
   Without it, VS Code drops new files into an inferred project and `@org/*` imports show as
   "Cannot find module" even though the build passes. (See `docs/CODING_STANDARDS.md`.)
5. **Respect module boundaries.** `apps` depend on `libs`; `libs` never import from `apps`.
   Shared code goes in a lib, not copied between apps.
6. **PDF export is server-side (Puppeteer/artboard); Word is client-side HTML.** Don't reintroduce
   `window.print()` as the PDF path — it's unreliable.

## How to add things (recipes)

See [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) → "Recipes": new document type, new
shared lib, new API module, new frontend route, new language, new paper size.

## Commits / PRs

- Keep changes scoped; update [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) journal when you finish a
  meaningful unit of work (it's how the next human/agent resumes).
- Run lint + the relevant typecheck before committing.
- Don't commit secrets; `.env` is gitignored, `.env.example` documents the keys.
