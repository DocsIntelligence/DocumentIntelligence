# Legal Documents Platform — Plan & Market Analysis

> ⚠️ **Superseded / extended by [`docs/`](docs/) as of 2026-06-07.** This original plan is now
> ~70% implemented. For the _current_ state, refreshed market analysis, and the next-phase roadmap
> (AI document **generation/update**, **court documents**, **multi-format export**, **Claude
> integration**), start at [`docs/README.md`](docs/README.md) and
> [`docs/04-progress-tracker.md`](docs/04-progress-tracker.md). This file is kept as the founding
> strategy record.

Reference: MyLiveCV (`/Users/anu/Desktop/PersonalProjects/ResumeBuilder/MyLiveCV`)
Target codebase: this Nx workspace (`apps/api` NestJS, `apps/app` React/Vite SPA, `apps/web` Next.js landing, Prisma/Postgres, BullMQ, S3, Razorpay, LangChain OpenAI + Gemini).

---

## Part 1 — Market analysis (lead with what's wrong with this idea)

### 1.1 The strongest counterarguments first

Before getting excited about templates and AI, three things should give you pause:

1. **"Online legal doc builder" is a crowded, low-trust category in India.** LegalDesk, Vakilsearch, NoBroker Legal, eDrafter, LegalKart, OnlineLegalIndia, LawRato, MyAdvo, VakilNo1 already occupy this turf. None are loved, all are SEO-funnelled, and the user retention curve is brutal — almost everyone is a one-doc-and-leave customer. You will not win by being "yet another template site."
2. **AI is no longer a differentiator.** Every incumbent shipped a "Draft with AI" button in 2023–2024. The bar has moved: the differentiator is **jurisdictional correctness** (rent registration thresholds differ between Maharashtra, Karnataka, Delhi; Model Tenancy Act 2021 was adopted only by a few states), **language coverage** (Hindi/regional for RTI, FIR, consumer forum), and **execution flow** (stamp paper + eSign + e-stamp). Generic LLM-on-template is table stakes.
3. **Bar Council of India regulatory risk.** BCI rules prohibit non-lawyers from "practising" law and restrict advertising for legal services. A pure self-serve DIY template generator is fine. The moment you offer "our lawyer will review your document" or "draft for you" as a productized service, you wade into the same grey zone Vakilsearch, MyAdvo etc. live in — which is survivable but a real compliance cost (Bombay HC has periodically signalled discomfort with these platforms). Build the product so the user is always the author and the AI/lawyer is an assistant; route paid review through verified independent advocates, not employees.

If those don't kill the idea, the real opportunity is below.

### 1.2 Where the real gap is (and where MyLiveCV's pattern actually wins)

Almost every Indian legal-doc site renders a form, then gives you a "Download PDF" button. There is no live, page-faithful preview as you type. **That is the wedge.** A few specific gaps the MyLiveCV-style architecture lets you attack:

| Gap                                                                 | Existing tools                                                                       | What you can build                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Live A4/Stamp-paper preview as you fill                             | Absent. Form first, PDF later.                                                       | MyLiveCV-style iframe artboard, real-time render.                       |
| Stamp-paper-aware layout (top zone reserved)                        | Nobody does this; users print on A4 and re-print on stamp paper hoping it fits       | Render the body with mm-precise top offset; print profile per page size |
| State/jurisdiction toggles inside templates                         | Vakilsearch has 2–3 state variants; mostly silent on the rest                        | Schema-driven: state field flips clauses/registration text              |
| Multi-persona (user / agency / advocate) on the same product        | Vakilsearch is B2C; CLM tools (Spotdraft, Sirion) are enterprise; nothing in between | White-label + branding + marketplace templates                          |
| Real-time co-editing with the counterparty                          | None                                                                                 | Share link → comment/suggest mode (Google Docs analog)                  |
| AI grounded in actual statutory references, not just LLM completion | Generic "rewrite this clause" buttons                                                | Rule library + RAG over Bare Acts + per-state overrides                 |
| Print fidelity                                                      | Browser print kills margins                                                          | Server-side Puppeteer with calibrated CSS                               |

### 1.3 Competitive landscape (confidence: high on existence, moderate on internals)

- **LegalDesk** — strongest in rent agreement + e-stamp + courier. Old UI. Per-doc pricing ₹599–₹2,500 (verify current). Weak preview. They own a lot of organic search.
- **Vakilsearch** — full-stack legal services, document drafting is a feeder for higher-ARPU services (GST, incorporation). They will not let you outspend them on Google Ads.
- **NoBroker Legal** — narrow (rent), but they own the broker-side distribution.
- **eDrafter / LegalKart / OnlineLegalIndia / LawRato** — fragmented commodity layer.
- **Government channels** — `rtionline.gov.in` (central RTI, 3000-char limit, free), state e-Stamp portals (SHCIL via Stock Holding), eCourts (CIS, partial filing in pilot). Free but UX-hostile; users still need drafting help.
- **Enterprise / B2B**: Spotdraft, Sirion, JustAct, Lawyered, Provakil. Different market entirely; ignore.
- **International analogues**: LegalZoom, Rocket Lawyer (US); Farewill (UK wills); irrelevant for Indian forms but informative on packaging.

### 1.4 TAM/SAM (confidence: moderate — derived, do not quote in pitches without primary sources)

- New urban tenancies in India: ~10–15 M/year (Census + CREDAI-style derivations). Even capturing 1% at ₹200 average = ₹2–3 Cr/year just on rent agreements.
- RTI applications: ~6 M/year (CIC annual reports). Bulk are free direct-to-portal; monetizable as guided drafting + tracking, ARPU ₹49–₹199.
- Affidavits, legal notices, consumer complaint forum: low millions per category.
- Registered advocates: ~1.5 M (BCI). Addressable SaaS subset (solo + small firms with SaaS appetite): ~50–150 K. ARPU ₹6,000–₹24,000/yr → ₹30–360 Cr ARR ceiling on B2B alone.

**Realistic 3-year top-line ceiling: ₹15–80 Cr.** This is a "good lifestyle business or Series A bridge" sized opportunity, not a unicorn opportunity. If you went in expecting unicorn outcomes, downgrade those expectations now.

### 1.5 Wedge strategy

Don't launch with 30 documents. Pick a **narrow, deep wedge** and dominate it:

1. **Rent agreement** — highest-volume, highest urgency, stamp-paper + registration creates a natural premium tier. Win on live stamp-paper preview + state-aware clauses + eSign.
2. **RTI** — high volume, low willingness-to-pay individually, but viral B2C acquisition. Use as **funnel** (free or ₹49) to onboard for higher-ARPU docs later.
3. **Legal notice (consumer / employment / civil)** — high willingness-to-pay (₹499–₹1,499), AI value is highest here (tone, citations, structure).

These three carry ~70% of the urgent-personal-legal-doc demand. **Add the long tail (will, partnership, MoU, NDA, gift deed, FIR, divorce-mutual, name-change affidavit, consumer forum complaint, employment grievance, RERA complaint, MACT, GPA, sale agreement) over months 6–18.** Don't promise breadth on day one.

---

## Part 2 — Product architecture (reusing what the starter already gives you)

### 2.1 What the starter already provides — leverage, don't rebuild

From `apps/api`, `apps/app`, `apps/web`, `tools/prisma/schema.prisma`:

- **Auth**: email/Google/GitHub/LinkedIn + WebAuthn passkeys — done.
- **Payments**: Razorpay (INR) — done. `Plan` / `PlanFeature` / `UserWallet` / `WalletUsage` already model metered features (`documents`, `ai_tokens`, `ai_attempts`, `storage_mb`, `api_calls`). **Reuse `documents` Feature for doc creation quota and `ai_tokens`/`ai_attempts` for AI usage** — schema is already shaped for this.
- **AI**: NestJS `ai` module with OpenAI + Gemini providers (`apps/api/src/app/ai/providers/`). Add a `legal-prompt` service layer on top.
- **Storage**: S3 module ready for PDF artifacts.
- **Jobs**: BullMQ + Redis ready for PDF rendering jobs.
- **Mail**: `MailLog` for share-link notifications.
- **UI**: shadcn/Radix + Tailwind 4, React Hook Form + Zod, TanStack Query + Redux Toolkit + redux-persist (the persist matters — autosave drafts client-side cheaply).
- **i18n**: i18next on both `app` and `web`. Hindi/regional support is plumbed.

**What's missing** that you must add:

- Document/Template domain model (Prisma).
- Template render engine (HTML/React component per template + server-side PDF).
- Builder shell (drag-drop sections, live preview iframe).
- Share-link, comment, signature flows.
- Organisation/agency multi-tenancy.
- eStamp / eSign integrations (third-party).

### 2.2 Domain model — Prisma additions

```prisma
enum DocumentStatus { draft in_review ready signed archived }
enum DocumentOwnerType { user organisation }
enum SignerRole { party_a party_b witness lawyer custom }
enum SignerStatus { pending invited viewed signed declined }
enum PageSize { a4 legal foolscap stamp_paper_in_10 stamp_paper_in_20 stamp_paper_in_50 stamp_paper_in_100 stamp_paper_in_500 }
enum ShareMode { view comment edit }

model DocumentType {
  id            String   @id @default(cuid())
  key           String   @unique   // "rent_agreement", "rti", "legal_notice"
  name          String
  category      String              // "tenancy" | "info_rights" | "notices" | …
  description   String?
  schema        Json                // Zod schema serialized; drives forms + validation
  defaultPageSize PageSize @default(a4)
  jurisdictions String[]            // ["IN-MH", "IN-KA", "IN-DL", "IN-*"]
  isActive      Boolean  @default(true)
  iconKey       String?
  sortOrder     Int      @default(0)
  templates     DocumentTemplate[]
  documents     Document[]
}

model DocumentTemplate {
  id             String   @id @default(cuid())
  documentTypeId String
  key            String                          // "rent-classic", "rent-modern"
  name           String
  thumbnailKey   String?                         // S3 key for preview image
  componentKey   String                          // identifier consumed by artboard renderer
  jurisdictions  String[]                        // narrows by state
  language       String   @default("en")
  styleTokens    Json                            // colors/fonts/margins
  isPremium      Boolean  @default(false)
  ownerType      DocumentOwnerType?              // null = system, user/org = marketplace
  ownerId        String?
  createdAt      DateTime @default(now())

  documentType DocumentType @relation(fields: [documentTypeId], references: [id], onDelete: Cascade)
  documents    Document[]

  @@unique([documentTypeId, key])
  @@index([ownerType, ownerId])
}

model Document {
  id             String   @id @default(cuid())
  title          String
  status         DocumentStatus @default(draft)
  documentTypeId String
  templateId     String
  ownerType      DocumentOwnerType @default(user)
  ownerUserId    String?
  ownerOrgId     String?
  data           Json                // form values (validated against type.schema)
  pageSize       PageSize @default(a4)
  language       String   @default("en")
  jurisdiction   String?             // "IN-MH"
  lockedAt       DateTime?           // freeze when signed
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  documentType DocumentType @relation(fields: [documentTypeId], references: [id])
  template     DocumentTemplate @relation(fields: [templateId], references: [id])
  versions     DocumentVersion[]
  shares       DocumentShare[]
  signers      DocumentSigner[]
  exports      DocumentExport[]
  comments     DocumentComment[]

  @@index([ownerUserId, updatedAt])
  @@index([ownerOrgId, updatedAt])
}

model DocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  data        Json
  templateId  String
  pageSize    PageSize
  createdById String
  createdAt   DateTime @default(now())
  label       String?
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  @@index([documentId, createdAt])
}

model DocumentShare {
  id         String     @id @default(cuid())
  documentId String
  token      String     @unique
  mode       ShareMode  @default(view)
  passwordHash String?
  expiresAt  DateTime?
  createdById String
  createdAt  DateTime   @default(now())
  document   Document   @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model DocumentSigner {
  id           String       @id @default(cuid())
  documentId   String
  email        String?
  name         String
  role         SignerRole
  status       SignerStatus @default(pending)
  signedAt     DateTime?
  provider     String?      // "aadhaar_esign" | "draw" | "typed" | "dsc"
  evidence     Json?        // OTP txn id, certificate, IP, geolocation
  order        Int          @default(0)
  document     Document     @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model DocumentExport {
  id         String   @id @default(cuid())
  documentId String
  format     String   // "pdf" | "docx" | "png"
  pageSize   PageSize
  s3Key      String
  byteSize   Int
  checksum   String
  createdAt  DateTime @default(now())
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model DocumentComment {
  id         String   @id @default(cuid())
  documentId String
  authorId   String?            // null = guest via share link
  authorName String
  anchor     Json               // {sectionKey, fieldPath, range?}
  body       String
  resolved   Boolean @default(false)
  createdAt  DateTime @default(now())
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

model Organisation {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  type      String   // "agency" | "law_firm" | "individual_lawyer"
  brandingId String? @unique
  createdAt DateTime @default(now())
  members   OrgMember[]
  branding  BrandingProfile? @relation(fields: [brandingId], references: [id])
}

model OrgMember {
  id     String @id @default(cuid())
  orgId  String
  userId String
  role   String // "owner" | "admin" | "member"
  org    Organisation @relation(fields: [orgId], references: [id], onDelete: Cascade)
  @@unique([orgId, userId])
}

model BrandingProfile {
  id           String  @id @default(cuid())
  logoS3Key    String?
  primaryColor String?
  footerText   String?
  letterheadS3Key String?
  barCouncilNumber String?
  organisation Organisation?
}
```

Notes:

- `Feature` enum already has `documents` — reuse for per-plan doc quota. No schema change needed for billing.
- `Document.data` as JSON keeps you fast; validate against the template type's Zod schema in the service layer, not the database.
- Add `documents` and `ai_*` Plan defaults at seed time.

### 2.3 Architecture — three-pane builder + iframe artboard (MyLiveCV pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│ apps/app  (existing React 19 / Vite SPA)                            │
│                                                                     │
│  /documents/:id/edit                                                │
│  ┌─────────────┬─────────────────────┬───────────────────────────┐  │
│  │ Sections    │ Form (RHF + Zod)    │ Artboard iframe           │  │
│  │ tree        │ + AI assist popover │ (live preview, paged)     │  │
│  │             │                     │                           │  │
│  └─────────────┴─────────────────────┴───────────────────────────┘  │
│                                                                     │
│  state: Redux Toolkit slice 'document' + redux-persist for offline  │
│  autosave: debounce → POST /documents/:id  → DocumentVersion        │
│  preview channel: postMessage(doc, template, pageSize) → iframe     │
└─────────────────────────────────────────────────────────────────────┘
                              │ postMessage
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ apps/artboard  (NEW — Vite app, mounted as iframe)                  │
│  - loads template component by key                                  │
│  - renders at exact mm via CSS @page + transform: scale             │
│  - reserves stamp-paper top zone when pageSize is stamp_*           │
│  - exposes a Print API for client-side print and a hydrate route    │
│    /render/:templateKey?data=...  for server-side Puppeteer         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ apps/api  (existing NestJS)                                         │
│                                                                     │
│  modules/                                                           │
│    documents/        CRUD, version, lock, schema-validate           │
│    document-types/   load type registry from DB + code              │
│    templates/        list, marketplace                              │
│    shares/           token issue, password, expiry, view counts     │
│    signers/          invite, status, eSign provider adapters        │
│    exports/          enqueue PDF render job (BullMQ)                │
│    legal-ai/         wraps existing ai/ providers; legal prompts    │
│    organisations/    org + members + branding                       │
│    estamp/           adapter to SHCIL/eMudhra/Digio/Leegality       │
│                                                                     │
│  workers/                                                           │
│    pdf-render        Puppeteer headless → hits artboard /render → S3│
│    share-mailer      reuses MailLog                                 │
│    esign-poll        webhook + poll for signer status               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ apps/web  (existing Next.js landing)                                │
│  /share/:token   public read-only preview, comment, sign flow       │
│  /templates      SEO: one page per (type, state, language)          │
│  /sample/:id     SEO: indexed sample completed docs (anonymized)    │
└─────────────────────────────────────────────────────────────────────┘
```

Add two new libs:

- `libs/document-schema` — Zod schemas per `DocumentType` (rent_agreement, rti, legal_notice, …). Source of truth for both API validation and React Hook Form resolvers. Mirror of MyLiveCV's `libs/schema`.
- `libs/document-templates` — one React component per template (rent-classic, rent-modern, rti-hindi-default, …), each consumes a typed schema and renders to print-fidelity HTML. Mirror of MyLiveCV's `libs/templates`. Shared between `apps/app` (preview-in-iframe) and `apps/artboard` (render target) and consumed server-side via SSR for PDF.

### 2.4 Print & page-size handling — the actually hard part

Browser print is unreliable. Build a real engine:

- **CSS layer**: every template uses `@page { size: 210mm 297mm; margin: 0; }` plus a `.page` container with explicit mm dimensions. For stamp paper, `padding-top: 95mm` (calibrated) leaves the pre-printed stamp zone untouched.
- **Page sizes supported**: A4 (210×297mm), Legal/Foolscap (215×330mm), Stamp paper sizes vary by state (typically 215×330mm, but the printed-stamp height varies by denomination — store an offset per `PageSize` enum value).
- **Pagination**: implement a `Paginator` component that measures content height with `ResizeObserver` and inserts `.page` breaks. This is what MyLiveCV does for resumes; lift it directly. Don't use the browser's natural pagination — it produces orphans and inconsistent margins.
- **Server-side render**: `apps/artboard` exposes `/render/:templateKey?docId=...` that requires an internal token. A BullMQ worker spawns headless Chrome (Puppeteer), hits that URL, prints to PDF using `page.pdf({ printBackground: true, preferCSSPageSize: true })`, uploads to S3, writes `DocumentExport`.
- **Calibration print**: ship a one-page "calibration ruler" PDF so agencies/lawyers can verify their printer alignment for stamp paper. This is small and earns trust.

### 2.5 Sharing & collaboration

- `POST /documents/:id/shares` → returns `https://app.../s/:token`. `apps/web` renders the share page (Next.js, good for SEO-on-noindex + faster first paint).
- Share modes: `view` (read), `comment` (add notes anchored to sections), `edit` (token-bearer becomes co-author; debounced PATCH like the owner).
- Password protection: bcrypt'd, stored in `DocumentShare.passwordHash`. Add a Throttler rule (the starter already has `@nestjs/throttler`).
- Comment realtime: server-sent events from API (lighter than websockets, easier through CDN). If you need true presence (cursors), upgrade to WebSocket later — don't over-engineer day one.

### 2.6 Signatures

Three tiers, gated by document risk:

1. **Drawn / typed signature** (no legal weight as eSign, but visually present). Done in-browser, stored as SVG/PNG in `DocumentSigner.evidence`.
2. **Aadhaar eSign** (IT Act §3A, legally valid). Use an aggregator — Digio, Leegality, SignDesk, SureCert, eMudhra, Zoop — don't integrate directly with UIDAI. Implementation is webhook-based: redirect signer → provider OTP → callback to your API → mark signer signed, save signed PDF in S3.
3. **DSC (Digital Signature Certificate)** for high-value docs (sale deeds, corporate). Most aggregators support this; price is higher.

Pick **one** provider for v1. Digio and Leegality have the most mature APIs; Leegality is more enterprise-priced. Don't build a multi-provider abstraction until you have a second integration to justify it.

### 2.7 eStamping

This is the most contested integration. SHCIL (Stock Holding Corp of India) is the central authority; states have their own portals (Karnataka via Khazane2, Maharashtra IGR, etc.). Direct integration with SHCIL is gated and slow. **Path**: integrate via a stamp-paper aggregator (StampIt, Leegality, NoBroker — some offer API access). For v1, support **manual upload of the user's own stamped paper** (they upload a photo/PDF of the stamped paper, you overlay the document content with mm-precision, render the combined PDF). Add live aggregator integration in v2.

### 2.8 AI features — designed for _trust_, not just _features_

Reuse `apps/api/src/app/ai/` (OpenAI + Gemini providers). Add a new module `legal-ai` on top with strict guard-rails:

- **Prompt registry**: a TypeScript file `libs/document-schema/src/<type>/prompts.ts` per doc type. Each prompt is versioned, tested with golden inputs, and routed to a model (`gpt-4o-mini` for cheap rewrites, `gpt-4o`/`gemini-1.5-pro` for clause generation, vision model for OCR).
- **Capabilities**:
  - Field-level: "suggest a fair late-payment clause for Mumbai rent agreement"
  - Section-level: "rewrite this clause to be tenant-friendly / landlord-friendly / shorter / more formal"
  - Document-level: "scan for missing clauses" — uses a checklist per template, not raw LLM
  - Translate: en ↔ hi, plus state-language (mr, kn, ta, te, bn, gu) for headings only
  - Upload-to-fill: PDF/image of Aadhaar/PAN/property card → vision model extracts → pre-fills party/premises fields (gated behind explicit consent — KYC-tier data)
  - Q&A copilot: "What does Section 17 of Registration Act mean for me?" — RAG over Bare Acts (Indian Kanoon scrape ≠ legal; use Ministry of Law published texts)
- **Risk scoring**: deterministic rules, not LLM. Store a `risks.ts` per template: `if data.rent > 5000 && data.state === 'IN-MH' && !data.registered then warn("Maharashtra requires registration if rent + deposit > ₹5,000")`. The risk panel is updated whenever data changes. **This is the moat** — make the rule library comprehensive, not the LLM clever.
- **Metering**: every AI call decrements `WalletUsage.ai_attempts` (or tokens). Use existing `wallet-usage.service.ts`. Free tier: 5 AI calls/day per user, lifetime; paid tiers higher.
- **Caching**: identical (template, field, input) → cache for 24 h in Redis. The cache savings are 30–60% on common drafts; the starter already has ioredis.
- **Guardrails**: a wrapper that (a) strips PII from logged prompts, (b) refuses to generate court orders or anything that impersonates a judicial authority, (c) appends a disclaimer to every AI output: "AI-suggested; please review with a qualified advocate for binding use."

### 2.9 Multi-persona model

Three account types, same product, gated features:

- **Individual user** (default): pay-per-doc OR a small monthly plan. Sees a curated template gallery.
- **Lawyer / advocate** (verified via Bar Council number): same templates + ability to publish their own templates to a marketplace (revenue share — you take 20–30%). Branded PDFs (footer with their reg number). Multiple clients (link each `Document.ownerType=user` to a "drafted by" lawyer).
- **Agency / firm** (org): seats, shared template library, white-label share links on a custom subdomain (`docs.{slug}.yourdomain.com`), bulk send, role-based access.

Add `OrgMember` checks to existing guards. The starter's `auth` module already has a role enum (`Role.user | admin`); extend with a separate `OrgRole` rather than overloading it.

---

## Part 3 — Implementation plan, phased

Assume one strong full-stack engineer + one part-time designer + one part-time legal consultant. Timeline scales ~linearly with team size.

### Phase 0 — Foundations (Week 1–2)

1. Add Prisma models (§2.2). Migration. Seed `DocumentType` rows for `rent_agreement`, `rti`, `legal_notice`, plus 2 templates each.
2. Add `documents` plans:
   - Free: 2 docs/lifetime, 5 AI attempts/day, A4 only, no eSign.
   - Starter (₹199/mo or ₹49/doc): 10 docs/mo, 100 AI attempts/mo, all page sizes, drawn signature.
   - Pro (₹499/mo): 50 docs/mo, 500 AI attempts/mo, eSign (passes through eSign cost as ₹15/signature), share-with-password.
   - Agency (₹2,499/mo, seats add-on): unlimited docs, 5K AI attempts/mo, white-label, marketplace publishing.
3. Wire `documents` feature decrement on doc creation in `wallet-usage.service.ts`.
4. Scaffold three Nx libs/apps:
   - `libs/document-schema` (Zod, no UI)
   - `libs/document-templates` (React components, share between `app` and `artboard`)
   - `apps/artboard` (Vite React app, runs at `/artboard.html` mounted in iframe)

### Phase 1 — One vertical end-to-end: Rent Agreement (Week 3–6)

Cut scope brutally. The goal is to ship **one** document type with the full flow before broadening.

1. **Schema** (`libs/document-schema/src/rent-agreement/`):
   - sections: parties (landlord, tenant), property, term, rent + deposit, utilities, rules, witnesses
   - jurisdiction-aware fields (state, registration required?)
   - Zod schema + form metadata (label, helper text, AI-assist prompt key, conditional `showIf`)
2. **Templates** (`libs/document-templates/src/rent-agreement/`):
   - `classic` (formal, single column, English)
   - `bilingual` (Marathi/Hindi heading + English body)
   - both paginated, both page-size aware (A4 + stamp paper 215×330 with 95mm reserved top)
3. **Builder UI** (`apps/app/src/app/features/documents/`):
   - sections tree (left)
   - form (middle) — RHF + Zod resolver from the schema lib; field-level AI button
   - iframe artboard (right); postMessage on every change (debounced 250ms)
4. **Artboard** (`apps/artboard`):
   - listens for postMessage `{ templateKey, data, pageSize }`
   - renders template, paginates
   - `/render/:templateKey?token=...` route for server-side PDF (Puppeteer worker)
5. **PDF export**:
   - `POST /documents/:id/export?format=pdf&pageSize=stamp_paper_in_500` → enqueue BullMQ job
   - worker spawns Puppeteer, hits artboard, prints, uploads to S3, records `DocumentExport`
   - SSE/polling for completion → download URL
6. **Share link**: token-based, view-only. No comments yet.
7. **Single AI feature**: clause rewrite ("more formal / shorter / tenant-friendly"). Use existing `ai` providers; route to `gpt-4o-mini`. Cache.
8. **Risk panel**: hard-coded for rent agreement — registration threshold by state, deposit limit (some states cap it), notice period reasonableness.
9. **Pricing/paywall**: free user can create 2 drafts but cannot export PDF without payment. The wallet check is already in place.

**Definition of done for Phase 1**: a user lands, picks rent agreement, fills the form, sees live A4 + stamp-paper preview, gets clause AI suggestions, pays ₹199, downloads a PDF that prints cleanly on a 500-rupee stamp paper.

### Phase 2 — Sharing, signing, collaboration (Week 7–10)

1. Comments anchored to sections (`apps/web` share page renders Next.js public view; comments via REST + SSE).
2. Multi-signer flow with order. Drawn + typed signature first (no legal weight; visual only).
3. Integrate **one** eSign provider (Digio recommended — best DX, mid-priced). Implement: signer invite → provider redirect → webhook → signed PDF persisted → `DocumentSigner.status = signed`.
4. Audit trail PDF appended: who signed, when, IP, OTP txn id.
5. Email notifications (reuse `MailLog` + nodemailer).

### Phase 3 — Second and third document types (Week 11–14)

1. **RTI**: schema-driven, AI value high (auto-route to correct PIO based on department dropdown — store PIO directory in `LookupGroup`, the starter already has the model). Output: A4 (no stamp paper). Hindi template required.
2. **Legal notice**: schema variants for consumer / employment / civil / cheque-bounce (§138 NI Act). AI auto-fills citations from a curated rule library.

Each new doc type costs ~1 week if schema/template patterns are reusable. **If** they take longer, your abstraction layer is wrong — fix the abstraction before adding more types.

### Phase 4 — Multi-persona (Week 15–18)

1. `Organisation` model live; org dashboard at `/org/:slug`.
2. Branding profile (logo, footer, color) applied to PDF.
3. White-label share subdomain (DNS wildcard + middleware in Next.js).
4. Lawyer verification flow (manual review of BCI registration; store in `BrandingProfile.barCouncilNumber`).
5. Template marketplace MVP: lawyer publishes a template, you take 20% on each use. Use `DocumentTemplate.ownerType` already in the schema.

### Phase 5 — Long tail + eStamp (Week 19–24)

1. Add 10+ document types: NDA, MoU, partnership deed, will (codicil), affidavit (name change, address proof, lost-document), consumer forum complaint, FIR, divorce petition (mutual consent only — anything else needs a lawyer), RERA complaint.
2. eStamp aggregator integration (StampIt or partner via Leegality).
3. Hindi UI on `apps/app` (the i18next plumbing exists; this is content + QA work).
4. PWA + offline drafting (redux-persist already wires the storage layer).

### 3.6 Things you should NOT build in year one (and why)

- **Court e-filing**: eCourts CIS integration is gated, requires state-by-state onboarding, and the UX is brittle. Defer.
- **Lawyer chat/marketplace**: turns you into Vakilsearch. Defer.
- **DSC issuance**: leave to eMudhra/Capricorn. Integrate signing, not issuance.
- **Mobile native apps**: PWA is enough; you don't have iOS/Android dev capacity to do it well.
- **Notary**: physical/online notarization (Aadhaar-notary is nascent). Defer.
- **General CLM features** (approval workflows, redlining, version diff at clause level): enterprise CLM is a different product. If a lawyer asks for redlining, give them Track Changes equivalent via the comment system.

---

## Part 4 — Engineering risks & how to defuse them

| Risk                                            | Likelihood | Mitigation                                                                                                                                               |
| ----------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Print fidelity differs across printers/browsers | High       | Server-side Puppeteer only for final output; calibration ruler PDF; never trust browser print for production output                                      |
| Clause hallucinations / wrong legal advice      | High       | Risk rules are deterministic; AI outputs always carry disclaimer; per-state rule library is hand-curated                                                 |
| BCI complaint or PIL against you                | Moderate   | Position as DIY tool; never "we draft for you"; verified lawyers are independent contractors via marketplace                                             |
| eSign provider outage                           | Moderate   | Single-provider day 1, but design `signers.provider` field-driven so you can add a fallback in a week                                                    |
| AI cost spirals on free tier                    | High       | Per-attempt metering via existing `WalletUsage`; per-IP rate limit on anonymous preview AI (don't expose to anonymous users at all initially)            |
| Template proliferation = unmaintainable         | High       | Force every template through the schema lib's typed contract; no per-template HTML hacks; review at PR                                                   |
| State-law changes silently break correctness    | High       | Rule library in code with named effective dates; quarterly legal consultant review; CI test that every template renders for every supported jurisdiction |
| Stamp-paper offset varies by state denomination | Moderate   | Calibrate per `PageSize`; store offsets as data, not code                                                                                                |

---

## Part 5 — Honest assessment & recommendations

- **Build it?** Worth building only if you accept this is a 12–24 month grind to ₹3–10 Cr ARR, not a 6-month rocket. The starter saves you 3 months of foundation work, which is meaningful.
- **The single highest-leverage technical bet** is the schema-driven template system mirrored from MyLiveCV. Get that abstraction right (schema → form + template + AI prompts + risks all derived from one source), and adding doc types becomes cheap. Get it wrong, and you'll be rewriting every template by hand.
- **The single highest-leverage product bet** is stamp-paper-aware live preview. Nobody else has it; it's hard to copy; it's the demoable wow moment.
- **The single highest-leverage business bet** is going B2B2C through advocates and small agencies, not direct B2C. Direct B2C means buying ads from Google forever. Advocate marketplace = distribution that compounds.
- **Don't ship 30 templates on day one.** Ship rent agreement, perfectly. Earn the right to add the next one.

Next concrete step options:

- (a) Draft the Prisma migration and seed for Phase 0.
- (b) Scaffold `apps/artboard` and the two new libs with the rent-agreement schema + classic template.
- (c) Write the legal-AI prompt registry + risk-rule structure.
