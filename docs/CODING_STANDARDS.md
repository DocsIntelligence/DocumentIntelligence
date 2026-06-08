# Coding standards

How code is written here so the repo stays maintainable across many contributors — human and AI.
Start with [`../CONTRIBUTING.md`](../CONTRIBUTING.md) (setup + golden rules); this is the detail.

## 1. Language & tooling

- **TypeScript everywhere**, `strict`. No `any` in committed code — prefer `unknown` + narrowing.
  Don't redefine types the SDK/lib already exports (use Prisma's generated types, Anthropic SDK
  types, `@org/*` lib types).
- **Zod** is the validation boundary. API request bodies are Zod DTOs (`createZodDto`); the
  document-schema registry is Zod. Validate at the edge, trust types inside.
- **Lint/format:** ESLint + Prettier. `pnpm lint`, `pnpm format:write`. Don't add
  `// eslint-disable` for rules that aren't registered (it errors); fix the code instead.
- **Verify** (see CONTRIBUTING golden rule 3). Typecheck is the source of truth, not the IDE —
  the IDE can show false positives until its TS server reloads.

## 2. Monorepo boundaries

- `apps/*` compose features; `libs/*` provide reusable capability. **Libs never import from apps.**
- Cross-cutting code lives in a lib under `@org/*` (mapped in `tsconfig.base.json` `paths`), never
  duplicated across apps.
- Library tags in `project.json` (`scope:shared`, `type:util|ui|feature`) document intent — keep
  them accurate.
- **Every app must have `apps/<app>/tsconfig.json`** (solution-style) in addition to
  `tsconfig.app.json`:
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "files": [],
    "references": [{ "path": "./tsconfig.app.json" }]
  }
  ```
  VS Code discovers files via `tsconfig.json` only; without it, new files land in an inferred
  project with no `@org/*` paths → spurious "Cannot find module". The CLI build is unaffected
  (it runs `tsc -p tsconfig.app.json`), which is why this bug is invisible until someone opens a file.

## 3. Backend (NestJS) conventions

- One folder per module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`. Controllers
  are thin (auth guard + delegate); services hold logic.
- DTOs are Zod schemas via `createZodDto`. Keep field constraints honest (lengths, enums).
- **Errors:** never `String(err)` a thrown value (it yields `"[object Object]"` for non-Errors).
  Use `errorMessage(e)` / `errorDetail(e)` from `apps/api/src/app/common/error.util.ts` for any
  stored or logged error.
- **AI provider abstraction:** add providers under `ai/providers/` implementing `AiProvider`;
  register in the fallback chain (`ai.service.ts`) and module. Claude is the default
  (`claude-opus-4-8`) via the official `@anthropic-ai/sdk` — **no `temperature`/`top_p`/
  `budget_tokens`** (Opus 4.8 rejects them). Domain prompts live in `legal-ai` + the doc-type's
  `prompts.ts`, never inline in providers.
- **Quotas/metering:** AI/document actions decrement `WalletUsage` via `wallet-usage.service.ts`.

## 4. Frontend (React) conventions

- Feature folders under `apps/app/src/app/features/<feature>`. Routes wired in `app.tsx`.
- **Data:** TanStack Query hooks in `features/*/queries.ts`; HTTP via `@org/api-client` services
  exposed through `services-context`. Don't call `fetch`/axios directly in components.
- **State:** Redux Toolkit for auth/session/global; local `useState` for component state.
- Components: function components + hooks. Keep effects' dependency arrays correct; when you must
  read latest state inside a stable listener, use a ref (see `PaginatedPreview`, `TemplateEditor`).
- **Styling:** Tailwind 4 + design tokens (`bg-background`, `text-foreground`, `border-border`,
  `text-primary`, `bg-error`…). No hard-coded hex except inside isolated print/preview surfaces.
- **Shared UI** comes from `@org/ui` (shadcn/Radix). Inline SVG icons follow the existing pattern.
- **Mobile-first / responsive:** the app shell is a sidebar on `md+` and a drawer below; builders
  collapse multi-pane layouts (segmented toggles) on small screens. New full-screen tools render
  full-bleed (outside `MainLayout`) and offer a back link.

## 5. Internationalisation & translations

Two distinct mechanisms — don't confuse them:

1. **UI i18n** — `i18next` / `react-i18next` (plumbed in `apps/app` and `apps/web`). User-facing UI
   strings should go through translation keys, not be hard-coded, as Hindi/regional UI lands.
2. **Document content language** — the _document body_ can be generated in any language by the AI
   (`/legal-ai/generate` + `/legal-ai/revise` take a `language`). Language options + the
   `<LanguageSelect>` live in `apps/app/src/app/lib/languages.tsx`.
3. **Transliteration** — type Latin, get Indic script in the editor, via `@org/transliteration`
   (13 languages) + the TipTap `TransliterationExtension`.

When adding UI text, prefer an i18n key. When adding a language to the AI flows, extend
`LANGUAGE_OPTIONS` (the model can write any language; the list is convenience).

## 6. Documents domain — the contract

- A document type = a `DocumentTypeBundle` (`libs/document-schema`): `schema` (Zod), `formMetadata`,
  `sectionOrder`, `risks` (deterministic, dated), `prompts`, `knownTemplates`.
- Templates (`libs/document-templates`) render a type; `freeform` renders arbitrary editor HTML.
  Page sizing comes from `pageProfiles` (shared by preview + export) — never hard-code A4.
- Risk rules are **deterministic code**, not LLM output. Statute references come from
  `@org/legal-reference`, not the model.

## 7. Recipes

**Add a document type:** create `libs/document-schema/src/<type>/` (`schema.ts`, `form-metadata.ts`,
`risks.ts`, `prompts.ts`, `index.ts`), register it in `_registry`, add a template in
`libs/document-templates`, seed `DocumentType`/`DocumentTemplate` in `tools/prisma/seed-data`.

**Add a shared lib:** mirror `libs/shared/transliteration` — `project.json` (name, sourceRoot,
projectType, tags), `tsconfig.json` (extends base), `src/index.ts`, `src/lib/*`. Add the
`@org/<name>` path to `tsconfig.base.json` `paths`. (Prefer `pnpm nx g @nx/js:lib` when available.)

**Add an API module:** `nest`-style folder; register in `app.module.ts`; DTOs as Zod; guard with
`JwtAuthGuard`; meter with `WalletUsage` if it consumes quota.

**Add a frontend route:** component under `features/<f>/`; add `<Route>` in `app.tsx` (inside
`MainLayout` for shell pages, full-bleed for editors); data via a `queries.ts` hook.

**Add a paper size / language:** extend `apps/app/src/app/lib/page-sizes.tsx` /
`languages.tsx` and (paper) `pageProfiles` + the Prisma `PageSize` enum.

## 8. For AI agents specifically

- Read `CONTRIBUTING.md`, this file, and `docs/BUILD_LOG.md` before changing code.
- Make the smallest change that satisfies the request; match surrounding style.
- After editing: run the relevant **typecheck + eslint** (and `build` if deps changed). Quote real
  output. If you couldn't run something (no DB/keys/browser), state that — don't fake success.
- Don't delete or rewrite code you didn't author unless the task requires it; if something looks
  wrong, surface it rather than silently "fixing" it.
- Append a dated entry to `docs/BUILD_LOG.md` when you complete a unit of work, with files touched
  and what's verified vs pending. This is the cross-session/cross-agent memory.
