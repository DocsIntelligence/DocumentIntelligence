# Design Document

## Overview

This document describes the architecture for a template-based legal-document SaaS built on top of the existing Nx starter (NestJS + React Vite SPA + Next.js landing, Prisma/Postgres, BullMQ, S3, Razorpay, LangChain). The platform enables users to fill structured forms, see a live page-faithful preview, get AI-assisted clause writing, share via link, and sign documents electronically.

Reference: full plan in `/LEGAL_DOCS_PLAN.md`.

## Architecture

### High-level diagram

```
apps/app  (existing React/Vite SPA)
  /documents/:id/edit
    ├── SectionsTree   (left)
    ├── BuilderForm    (RHF + Zod, middle)
    └── ArtboardIframe (right) ───┐ postMessage({templateKey, data, pageSize})
                                  ▼
                          apps/artboard (NEW Vite app)
                            renders @org/document-templates
                            exposes /render/:key for server-side PDF

apps/api (existing NestJS)
  + documents/      CRUD, versions, locks
  + shares/         token issue, password, expiry
  + signers/        eSign adapter (Digio first)
  + exports/        BullMQ enqueue → pdf-render worker
  + legal-ai/       wraps ai/ providers
  + organisations/  org + branding
  workers/
    + pdf-render    Puppeteer → artboard /render → S3 → DocumentExport
    + esign-poll    provider webhook + status sync

apps/web (existing Next.js)
  + /share/[token]  public preview / comment / sign

libs/
  + document-schema    Zod schemas per type + risk rules + prompt manifests
  + document-templates React components per template (consumed by app + artboard + Puppeteer)
```

### Schema-driven everything

Every `DocumentType` carries:

- a Zod schema (form values)
- a form-metadata map (label, helperText, aiPromptKey, showIf, widget hint)
- a list of compatible `DocumentTemplate` entries (componentKey selects the React component)
- a prompts manifest (AI prompt id → versioned template)
- a risks module (deterministic functions that take `data` and return `Warning[]`)
- a print profile per `PageSize` (top reserved zone, footer behavior)

The same Zod schema is the source of truth for:

- API DTO validation (via `nestjs-zod`)
- React Hook Form resolver
- TypeScript types consumed by templates

### Artboard contract

`apps/artboard` is a Vite React app served as a route or static bundle. Two consumption modes:

1. **Live preview** — embedded as `<iframe>` in the builder. Listens for `postMessage({ type: 'doc:update', payload: { templateKey, data, pageSize, jurisdiction, language } })` and rerenders.
2. **Server render** — Puppeteer worker navigates to `http://artboard-host/render/:templateKey?docId=...&token=...`. The route fetches the doc by id (server-to-server via API with internal token), then renders. Puppeteer `page.pdf({ printBackground: true, preferCSSPageSize: true })` produces the PDF.

Template components in `libs/document-templates` are pure: `(data, options) => ReactNode`. They must use the shared `Page` and `Paginator` primitives so pagination is consistent.

### Pagination strategy

`Paginator` measures children height via `ResizeObserver`, walks descendants in document order, and splits into `.page` containers sized via CSS `mm`. Stamp-paper variants prepend a fixed-height spacer matching the denomination's printed-stamp height.

### AI module

`apps/api/src/app/legal-ai/`:

```
legal-ai.module.ts
legal-ai.service.ts          // public API
prompts/
  rent-agreement.prompts.ts  // versioned id → { system, user, model, temperature }
  rti.prompts.ts
  legal-notice.prompts.ts
risks/
  rent-agreement.risks.ts    // pure functions: (data) => Warning[]
cache.ts                     // Redis key = sha256(promptId|input)
guard.ts                     // PII strip, refusal rules, disclaimer append
```

Calls go through `WalletUsageService.checkQuota` then `trackUsage` after success.

### PDF render worker

```
apps/api/src/app/documents/workers/pdf-render.processor.ts
  - BullMQ processor for queue 'doc-pdf'
  - Job payload: { documentId, format, pageSize }
  - Spawns puppeteer with @sparticuz/chromium (prod) / system chrome (dev)
  - GET ${ARTBOARD_URL}/render/${templateKey}?docId=${documentId}&token=${INTERNAL_RENDER_TOKEN}
  - page.pdf() → upload to S3 via existing StorageService → write DocumentExport
```

`ARTBOARD_URL` and `INTERNAL_RENDER_TOKEN` are env vars. Artboard verifies the token on the `/render/...` route to prevent public exposure.

### Sharing

Token = `crypto.randomUUID().replace(/-/g, '')` × 2 (48 chars). Routes:

- `apps/web/src/app/share/[token]/page.tsx` — Next.js server component fetches doc by token from API, renders read-only via `@org/document-templates`.
- `POST /share/:token/comments` — public, throttled to 5/min/IP.
- `POST /share/:token/sign` — initiates signer flow.

### Organisations

`Document.ownerOrgId` orthogonal to `ownerUserId`; service guards check membership. `BrandingProfile` resolves to the document's owning org if any; else falls back to the lawyer's user-attached branding; else system default.

White-label subdomain: `apps/web` middleware reads `host`, looks up org by slug, applies branding context.

## Components and Interfaces

### libs/document-schema

Shared TypeScript library providing:

- `DocumentTypeRegistry` — map of type key → { schema, formMetadata, risks, prompts, printProfiles }
- `schemaFor(typeKey)` — returns the Zod schema for a document type
- `risksFor(typeKey)` — returns risk evaluation functions
- `promptsFor(typeKey)` — returns versioned prompt manifests

### libs/document-templates

Shared React library providing:

- `Page` component — mm-sized container with `@page` CSS rules
- `Paginator` component — measures and splits children across pages
- `StampPaperFrame` — wraps Page with denomination-specific top reserved zone
- Template components per document type/variant — pure `(data, options) => ReactNode`
- `TemplateRegistry` — map of templateKey → React component

### apps/artboard

Vite React app with two routes:

- `/` — postMessage listener for live preview (iframe mode)
- `/render/:templateKey` — server-render entry for Puppeteer PDF generation

### apps/api modules

| Module          | Responsibility                                                   |
| --------------- | ---------------------------------------------------------------- |
| `documents`     | CRUD, versioning, autosave, quota enforcement                    |
| `shares`        | Token issuance, password hashing, expiry, mode enforcement       |
| `signers`       | Signer management, drawn/typed signature, eSign provider adapter |
| `exports`       | BullMQ job enqueue, status polling, S3 upload                    |
| `legal-ai`      | Prompt execution, caching, PII guard, quota decrement            |
| `organisations` | Org CRUD, membership, branding profile                           |

### apps/web pages

| Route                 | Responsibility                             |
| --------------------- | ------------------------------------------ |
| `/share/[token]`      | Public document preview with password gate |
| `/share/[token]/sign` | Signer flow (drawn/typed/eSign)            |

## Data Models

Added to `tools/prisma/schema.prisma`:

### Enums

- `DocumentStatus`: draft, review, signed, expired, revoked
- `DocumentOwnerType`: user, organisation
- `SignerRole`: party, witness, notary
- `SignerStatus`: pending, invited, signed, declined
- `PageSize`: a4, legal, stamp_10, stamp_20, stamp_50, stamp_100, stamp_500
- `ShareMode`: view, comment, edit

### Models

| Model              | Key fields                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `DocumentType`     | id, key, name, description, schema (Json), supportedJurisdictions, supportedPageSizes                                    |
| `DocumentTemplate` | id, documentTypeId, key, name, language, jurisdiction, isPremium, componentKey                                           |
| `Document`         | id, typeId, templateId, ownerUserId, ownerOrgId, ownerType, title, data (Json), status, jurisdiction, pageSize, lockedAt |
| `DocumentVersion`  | id, documentId, data (Json), version, createdAt                                                                          |
| `DocumentShare`    | id, documentId, token, passwordHash, expiresAt, mode                                                                     |
| `DocumentSigner`   | id, documentId, name, email, role, status, order, evidence (Json)                                                        |
| `DocumentExport`   | id, documentId, format, pageSize, s3Key, s3Url, createdAt                                                                |
| `DocumentComment`  | id, documentId, shareId, sectionKey, fieldPath, body, resolvedAt                                                         |
| `Organisation`     | id, name, slug, ownerId                                                                                                  |
| `OrgMember`        | id, orgId, userId, role                                                                                                  |
| `BrandingProfile`  | id, orgId, logo, primaryColor, footer, letterhead, bciNumber                                                             |

### Relations on User

- `ownedDocuments Document[]`
- `orgMemberships OrgMember[]`

`Document.data` is `Json`; runtime validation against `DocumentType.schema` happens in the service layer using a registry in `libs/document-schema`. The DB does not enforce schema shape — keep migrations cheap when types evolve.

## Correctness Properties

### Property 1: Document immutability after signing

A document with `status = signed` and `lockedAt` set must reject all data mutations.

**Validates: Requirements 5**

### Property 2: Share token security

Share tokens must be cryptographically random (48+ chars) and hashed if password-protected.

**Validates: Requirements 4**

### Property 3: PDF dimensional accuracy

PDF output dimensions must exactly match the declared PageSize (verified via Puppeteer preferCSSPageSize).

**Validates: Requirements 3**

### Property 4: Risk rule determinism

Risk rules are deterministic pure functions — same input always produces same warnings.

**Validates: Requirements 9**

### Property 5: AI quota atomicity

AI quota must be decremented atomically; cached results must not decrement quota.

**Validates: Requirements 6**

### Property 6: Signer ordering enforcement

Signer ordering must be enforced — signer N cannot sign until signer N-1 has signed.

**Validates: Requirements 5**

### Property 7: Template jurisdiction coverage

Every template must render for every supported jurisdiction (enforced via CI snapshot tests).

**Validates: Requirements 9**

## Error Handling

| Scenario                                | Handling                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| PDF render fails (Puppeteer crash)      | BullMQ retries 3x with exponential backoff; DocumentExport.status = failed after exhaustion |
| AI provider timeout                     | Return cached result if available; else return error with retry suggestion                  |
| Share token not found                   | 404 with generic "link not found" (no information leakage)                                  |
| Share token expired                     | 410 Gone                                                                                    |
| Quota exceeded                          | 402 with plan upgrade CTA                                                                   |
| eSign webhook failure                   | esign-poll worker retries; signer status remains pending until confirmed                    |
| Invalid document data (schema mismatch) | 422 with Zod error details; data not persisted                                              |
| Artboard render token invalid           | 401 Unauthorized                                                                            |

## Testing Strategy

- **Unit tests**: Zod schemas, risk rules, prompt manifests — all pure functions tested via Vitest
- **Integration tests**: API endpoints (documents CRUD, shares, exports) via supertest with test DB
- **Snapshot tests**: Every template × every supported jurisdiction rendered and snapshot-compared
- **E2E tests**: Builder form → preview → export flow via Playwright (Phase 1 complete)
- **PDF fidelity**: Puppeteer-generated PDFs checked for correct page dimensions via pdf-parse
- **CI gate**: `pnpm nx run-many -t lint typecheck test` must pass before merge

## Open questions

- Should `Document.data` versions be stored as full snapshots or as JSON diffs? Default to full snapshots in v1 (Postgres JSONB compresses; storage is cheap). Re-evaluate at 100k docs.
- Should template components be lazy-loaded via dynamic import? Yes, once we have >5 templates per type — code-split per `documentTypeId`.
- Server-side rendering of preview (Next.js streaming) instead of iframe? Not yet — iframe isolates CSS bleed and lets us share one codebase with the Puppeteer renderer.
