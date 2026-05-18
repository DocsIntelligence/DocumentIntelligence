# Requirements Document

## Introduction

Build a template-based legal-document SaaS on top of the existing Nx starter (NestJS + React Vite SPA + Next.js landing, Prisma/Postgres, BullMQ, S3, Razorpay, LangChain). Users fill structured forms, see a live page-faithful preview (A4 / Legal / Indian stamp paper sizes), get AI-assisted clause writing, share via link, and sign (drawn → Aadhaar eSign).

Full plan and market analysis live in `/LEGAL_DOCS_PLAN.md` at the repo root.

### Personas

1. **Individual user (B2C)** — wants one rent agreement, one RTI, one notice. Pays per-doc or starter subscription.
2. **Lawyer / advocate** — verified via Bar Council number. Drafts for clients; may publish templates to a marketplace.
3. **Agency / firm (org)** — multiple seats, shared template library, white-label branding on PDFs and share links.

## Glossary

| Term             | Definition                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| DocumentType     | A category of legal document (rent_agreement, rti, legal_notice, etc.) with an associated Zod schema |
| DocumentTemplate | A style/variant/language/jurisdiction rendering of a DocumentType                                    |
| Artboard         | A standalone Vite React app that renders templates for live preview and server-side PDF generation   |
| Paginator        | A component that measures children height and splits content across page containers sized in mm      |
| Stamp paper      | Indian legal paper with denomination-specific top reserved zone for government stamps                |
| BCI              | Bar Council of India — regulatory body for lawyers                                                   |
| eSign            | Electronic signature, specifically Aadhaar-based eSign via aggregators like Digio                    |
| WalletUsage      | Existing quota/usage tracking system in the starter for metered features                             |

## Requirements

### REQ-1: Document types & templates

- **ID**: REQ-1
- **Description**: The system maintains a registry of `DocumentType` (rent_agreement, rti, legal_notice, …) each with a Zod schema describing form fields. Each `DocumentType` has one or more `DocumentTemplate` entries (style/variant/language/jurisdiction). Templates render the same data differently and may carry premium gating. Templates may be system-owned or user/org-owned (marketplace).
- **Acceptance Criteria**:
  - GIVEN a DocumentType exists WHEN a user selects it THEN the system loads the corresponding Zod schema and available templates
  - GIVEN a DocumentTemplate is premium-gated WHEN a free-tier user selects it THEN the system blocks usage and shows upgrade prompt
  - GIVEN a user/org owns a template WHEN they publish it THEN it appears in the marketplace for other users

### REQ-2: Document builder (live preview)

- **ID**: REQ-2
- **Description**: Three-pane builder UI: sections tree (left), form (middle), iframe preview (right). Form is driven by React Hook Form + Zod resolver from the schema lib. Preview iframe loads `apps/artboard` and receives postMessage on every change (debounced 250ms). The preview paginates content with mm-precision; for stamp paper variants the top zone (default 95mm, configurable per PageSize) is reserved. Autosave persists Document.data and creates DocumentVersion snapshots at meaningful intervals.
- **Acceptance Criteria**:
  - GIVEN a user is editing a document WHEN they change a form field THEN the iframe preview updates within 250ms
  - GIVEN stamp paper page size is selected WHEN the preview renders THEN the top zone is reserved per denomination
  - GIVEN a user is editing WHEN 30 seconds pass or N edits occur THEN a DocumentVersion snapshot is created
  - GIVEN the builder loads WHEN the document has existing data THEN the form and preview restore from the last saved state

### REQ-3: Print / export

- **ID**: REQ-3
- **Description**: Server-side PDF render via Puppeteer/BullMQ hitting artboard's render route with an internal token. Supported page sizes: A4 (210×297mm), Legal/Foolscap (215×330mm), stamp paper denominations (₹10/20/50/100/500) at 215×330mm with denomination-dependent top offset. Each export writes a DocumentExport row referencing the S3 object.
- **Acceptance Criteria**:
  - GIVEN a user requests PDF export WHEN the job completes THEN a DocumentExport row exists with a valid S3 URL
  - GIVEN A4 page size WHEN PDF is generated THEN dimensions are exactly 210×297mm
  - GIVEN stamp paper ₹100 WHEN PDF is generated THEN the top offset matches the denomination's stamp height
  - GIVEN the artboard render route is hit without a valid internal token THEN it returns 401

### REQ-4: Sharing & comments

- **ID**: REQ-4
- **Description**: POST /documents/:id/shares issues a token-based link, optional password (bcrypt), optional expiry, mode = view | comment | edit. Public share page lives in apps/web at /share/[token]. Comments are anchored to { sectionKey, fieldPath } and visible to all share viewers.
- **Acceptance Criteria**:
  - GIVEN a share link is created with password WHEN accessed without password THEN access is denied
  - GIVEN a share link has expired WHEN accessed THEN a 410 Gone response is returned
  - GIVEN mode is "view" WHEN a viewer tries to comment THEN the action is blocked
  - GIVEN a comment is anchored to a field WHEN viewing the document THEN the comment appears next to that field

### REQ-5: Signing

- **ID**: REQ-5
- **Description**: v1: drawn or typed signature stored as SVG/PNG. v2: Aadhaar eSign via Digio. Multiple signers with optional ordering. Once all required signers sign, Document.status becomes signed and lockedAt is set; further data edits are blocked.
- **Acceptance Criteria**:
  - GIVEN a user draws a signature WHEN they submit THEN the SVG is stored in DocumentSigner.evidence
  - GIVEN all required signers have signed WHEN the last signature is recorded THEN Document.status = signed and lockedAt is set
  - GIVEN a document is signed WHEN a user attempts to edit data THEN the edit is rejected
  - GIVEN Aadhaar eSign is initiated WHEN Digio webhook confirms signing THEN the signed PDF is persisted in S3

### REQ-6: AI assistance

- **ID**: REQ-6
- **Description**: legal-ai module wraps existing ai/ providers (OpenAI + Gemini). Capabilities: clause rewrite (tone variants), section translate (en ↔ hi), document-level risk scan, upload-to-fill (vision OCR of Aadhaar/PAN/property card → field pre-fill). Every call decrements WalletUsage.ai_attempts. Identical inputs cached in Redis 24h. All AI output carries disclaimer.
- **Acceptance Criteria**:
  - GIVEN a user requests clause rewrite WHEN AI quota is exhausted THEN the request is rejected with quota error
  - GIVEN identical input is submitted within 24h WHEN processed THEN the cached result is returned without LLM call
  - GIVEN AI generates a clause WHEN displayed to user THEN it includes "AI-suggested, review with an advocate" disclaimer
  - GIVEN a user uploads Aadhaar image WHEN OCR runs THEN relevant fields are pre-filled in the form

### REQ-7: Pricing & quotas

- **ID**: REQ-7
- **Description**: Reuse Plan/PlanFeature/UserWallet/WalletUsage from existing payment module. Plans: Free (2 docs lifetime, 5 AI/day, A4 only, no eSign), Starter ₹199/mo (10 docs, 100 AI, 200MB), Pro ₹499/mo (50 docs, 500 AI, 500MB), Agency ₹2499/mo (unlimited docs, 5000 AI, 5GB).
- **Acceptance Criteria**:
  - GIVEN a free user has 2 documents WHEN they try to create a third THEN creation is blocked
  - GIVEN a free user WHEN they attempt stamp-paper export THEN it is blocked
  - GIVEN a Starter user WHEN they create their 11th document THEN creation is blocked until upgrade
  - GIVEN an Agency user WHEN they create documents THEN there is no limit

### REQ-8: Organisations & branding

- **ID**: REQ-8
- **Description**: Organisation model with members (owner/admin/member roles), branding profile (logo, primary color, footer, letterhead, BCI number). Lawyer verification flow: admin reviews BCI registration evidence. Documents may be owned by a user or by an organisation.
- **Acceptance Criteria**:
  - GIVEN an org member with "member" role WHEN they try to delete an org document THEN the action is denied
  - GIVEN an org has a branding profile WHEN a PDF is exported THEN the branding is applied
  - GIVEN a lawyer submits BCI evidence WHEN admin approves THEN the user is marked as verified
  - GIVEN a white-label subdomain WHEN accessed THEN the org's branding context is applied

### REQ-9: Jurisdictional correctness

- **ID**: REQ-9
- **Description**: Each DocumentType declares supported jurisdictions (e.g., ["IN-MH", "IN-KA", "IN-DL"]). Schema-driven showIf rules surface or hide fields by jurisdiction. Risk rules are deterministic TypeScript modules with effective-date annotations.
- **Acceptance Criteria**:
  - GIVEN jurisdiction IN-MH is selected WHEN rent+deposit exceeds MH threshold THEN a registration warning is shown
  - GIVEN a jurisdiction-specific field WHEN a different jurisdiction is selected THEN the field is hidden
  - GIVEN a new template is added WHEN CI runs THEN it renders successfully for every supported jurisdiction

### Non-functional requirements

- **Print fidelity**: Server-side Puppeteer is the only source of truth for production PDF output. Browser print is preview-only.
- **i18n**: Hindi UI for apps/app once Phase 5 lands. Marathi/Kannada/Tamil/Telugu/Bengali/Gujarati for template headings only.
- **Performance**: Builder live-preview round-trip ≤ 250ms p95 on a 2019 MacBook over local network.
- **Security**: Share-link tokens are 24+ char random; password-protected shares hash via bcrypt; anonymous endpoints rate-limited via existing @nestjs/throttler.
- **Compliance posture**: Product is positioned as DIY tool; AI is an assistant; verified lawyers are independent contractors via the marketplace, never employees.

### Out of scope (year one)

Court e-filing, lawyer chat marketplace, DSC issuance, native mobile apps, online notary, enterprise CLM features (redlining, approval workflows).
