# Product Roadmap

> Horizon: ~9 months of focused work for a small team (1 strong full-stack eng, part-time
> designer, part-time legal consultant). Timeline scales roughly linearly with headcount.
> Phases are sequenced so each ships a *usable* increment, not a half-built everything.

## Guiding principles

1. **One source of truth per doc type** (`DocumentTypeBundle`). Adding a doc type that needs
   custom code outside this contract is a smell — fix the abstraction first.
2. **Don't ship 30 documents.** Ship few, deep, correct. Earn the right to add the next.
3. **Correctness > cleverness.** The deterministic per-state, dated rule/citation library is the
   moat; the LLM is the assistant.
4. **User is always the author.** AI drafts; the human owns it. Keeps us out of the BCI grey zone.
5. **Court documents are the B2B revenue bet.** Consumer docs (rent/RTI/notice) are the funnel.

## Current baseline (already built — see [`04-progress-tracker.md`](04-progress-tracker.md))

Auth, payments/metering, S3, BullMQ, PDF export pipeline, artboard renderer, schema-driven form +
risk engine, stamp-paper-aware templates, TipTap editor with transliteration, **and** a working
`legal-ai` module that does clause-rewrite + rule-suggest with quota + caching + disclaimer.
**One** document type lives end-to-end: `rent_agreement` / `classic`.

---

> **Implementation status — audited 2026-06-08 against the codebase.**
> Legend: `[x]` shipped · `[~]` partial / shipped via a different mechanism than specified · `[ ]` not started.
> Where the build deviates from the spec, the `_Status_` note says how. Net: **Phase A largely shipped
> (freeform-HTML flavour, not Zod-structured)**, **Phase C delivered as AI presets (no structured court
> templates yet)**, **Phase D half-done (share/comments/signatures yes; eSign no)**, **Phases B & E mostly open.**

## Phase A — AI drafting copilot (the headline upgrade) · ~Weeks 1–4

**Goal:** the user can *generate* and *update* a whole document with AI, not just rewrite one clause.

- [x] **Add a Claude provider** to `apps/api/src/app/ai/providers/` alongside OpenAI + Gemini
      (`claude.provider.ts`, `@anthropic-ai/sdk`, default `claude-opus-4-8`). Wire `ANTHROPIC_API_KEY`
      / `ANTHROPIC_MODEL` into `config/schema.ts`. Make Claude the default provider for drafting.
- [~] **Document-level generation endpoint** `POST /legal-ai/generate` — natural-language brief →
      structured data conforming to the doc type's Zod schema (via Claude **structured outputs**),
      validated, returned as `Document.data`. ("Draft a rent agreement: landlord Ramesh, tenant
      Priya, 2BHK in Pune, ₹25,000/mo, 11-month term, ₹50,000 deposit.")
      _Status: partial — endpoint ships, but generates **freeform HTML** (with `{{placeholders}}`), not Zod-schema-structured `data` via structured outputs. Schema-structured generation for the form builder is a follow-up._
- [~] **Document-level update endpoint** `POST /legal-ai/revise` — existing `data` + instruction
      → patched `data` ("make the deposit 2 months", "add a no-pets clause", "make it
      tenant-friendly"). Returns a diff the user approves before it's applied.
      _Status: partial — `/legal-ai/revise` ships (HTML revise + translate), but there is **no accept/reject diff** UI yet (it replaces, relying on undo)._
- [ ] **Conversational intake** (optional, behind a flag): a tool-use loop where Claude asks for
      missing required fields before generating, instead of silently inventing them.
- [~] **Builder UI**: "Draft with AI" entry on document creation; inline "Ask AI to revise"
      on each section; show AI changes as an accept/reject diff. Reuse existing
      `PlaceholderHighlightExtension` to surface still-empty `{{fields}}`.
      _Status: partial — "Draft with AI" entry + inline Revise shipped; placeholder highlighting in use; **accept/reject diff not built**._
- [~] **Guardrails carried over + extended**: disclaimer on every output; PII stripped from logs;
      refuse to impersonate judicial authority; **every statutory citation validated against the
      curated citation library, not trusted from the model** (see new-criminal-codes risk).
      _Status: partial — disclaimer, no-judicial-impersonation, `{{applicable_law}}` placeholder, and the criminal-code-reform guardrail (`@org/legal-reference`) are wired into the prompts. **Programmatic citation validation + PII log-stripping not yet implemented** (AI is instructed not to emit citations rather than validated against the library)._
- [x] **Metering**: generation/revision decrement `Feature.ai_attempts` / `ai_tokens` via existing
      `wallet-usage.service.ts`. Cache identical (type, input) for 24h.

**Done when:** a user types one sentence, gets a schema-valid draft rendered in the live preview,
and can say "change X" and watch it update — within free-tier quota.

## Phase B — Multi-format export + advocate-grade output · ~Weeks 4–6

**Goal:** advocates can get an **editable DOCX**, not just a locked PDF. This is a hard requirement
for the B2B court-document market.

- [~] **DOCX export** in the exports pipeline (`docx` npm lib or a headless LibreOffice worker).
      Wire `DocumentExport.format = 'docx'` through `ExportsService` + a BullMQ processor.
      _Status: partial — editable Word export ships, but as a **client-side `.doc`** (Word-openable HTML, `export-word.ts`), **not** true OOXML through the exports pipeline. The backend DOCX worker was intentionally removed. Good enough to open/edit in Word; not spec-faithful OOXML._
- [ ] **PNG/preview-image export** for thumbnails and share cards (already enum-supported).
- [ ] **Calibration ruler PDF** for stamp-paper printer alignment (trust-builder for agencies).
- [ ] **Branded output** for verified advocates/agencies: `BrandingProfile` (logo, footer, Bar
      Council number) applied to PDF/DOCX headers/footers.

**Done when:** a document exports identically to PDF and to a DOCX an advocate can open and edit in
Word, optionally on their letterhead.

## Phase C — Court documents (the B2B revenue bet) · ~Weeks 6–12

**Goal:** the highest-value, hardest-to-copy doc family. Build the *court-document scaffolding* once
(cause title, memo of parties, prayer, verification, vakalatnama, court/case-number placeholders),
then add types cheaply.

Rollout order (each is one `DocumentTypeBundle` + template):

> _Status: the whole court-doc family ships as **AI presets** (`DOCUMENT_PRESETS` in `@org/legal-reference`) → New-document picker "Court & legal" section → AI draft with a per-preset structural scaffold (`apps/api/.../legal-ai/court-scaffolds.ts`) + the criminal-code guardrail → freeform editor. **No structured `DocumentTypeBundle` + React template** exists for any of them yet — that's the deliberate trade-off (court docs are prose-heavy). Hence every item below is `[~]`._

- [~] **Legal notice** family first (bridge between consumer and court): consumer, employment,
      civil, **cheque-bounce u/s 138 NI Act**. High willingness-to-pay, high AI value.
      _Status: partial — AI presets `notice-138` + general notice; no dedicated structured templates._
- [~] **Consumer complaint** under Consumer Protection Act 2019 (District/State/National
      Commission formats).
      _Status: partial — AI preset `consumer-complaint` (CPA 2019); commission-format variants via the brief._
- [~] **Affidavits**: name-change, address-proof, lost-document, general (A4, no stamp paper).
      _Status: partial — AI preset `affidavit-general`; specific variants via the brief._
- [~] **Bail application** (regular + anticipatory) — **must cite BNSS, not CrPC**.
      _Status: partial — AI presets `bail-regular` + `bail-anticipatory`, steered to **BNSS** by the scaffold + guardrail._
- [~] **Plaint / Written Statement** (civil suit) + **Vakalatnama** + **Memo of Parties**.
      _Status: partial — AI presets `plaint`, `written-statement`, `vakalatnama`._
- [ ] **Writ petition** scaffold (Art. 226/32) — advanced; gate behind advocate accounts.
- [~] **Curated citation library** (`libs/document-schema/.../citations.ts`) with **effective dates**
      mapping old→new codes (IPC→BNS, CrPC→BNSS, Evidence Act→BSA). The AI must look up citations
      here, never emit them freely.
      _Status: partial — built at `libs/shared/legal-reference/.../citations.ts` (not `document-schema`): `CRIMINAL_CODE_REFORMS` act-level mapping is authoritative + dated (eff. 2024-07-01); section-level maps are confidence-flagged + "verify against bare act". Wired as a **prompt guardrail**, but there is **no server-side citation-fill/validation step** yet (AI is told to use `{{applicable_law}}`, not to look up + insert)._

**Done when:** an advocate drafts a §138 cheque-bounce notice and a regular bail application with
correct BNSS sections, on their letterhead, exported to editable DOCX.

> **Explicitly NOT in scope this year:** court e-filing (eCourts CIS integration is gated, brittle,
> state-by-state) and any "we file for you" service (BCI risk). We generate the document; the
> advocate files it.

## Phase D — Sharing, signing, collaboration · ~Weeks 8–14 (parallelizable)

- [x] Share links (`DocumentShare`, view/comment/edit modes) rendered on `apps/web` (Next.js).
      _Status: done — `shares` module + api-client + `ShareDialog` (mode/password/expiry) + public `/s/:token` `SharedDocumentView`. **Public view lives in `apps/app`, not `apps/web`.**_
- [~] Section-anchored comments (`DocumentComment`) over REST + SSE.
      _Status: partial — REST done (`comments` module, `CommentsDialog` in both builders, guest comments via share token). **SSE live-refresh not done** (react-query refetch); `anchor` is stored but UI is document-level._
- [x] Multi-signer flow (`DocumentSigner`): drawn/typed signatures first (visual only).
      _Status: done — `signers` module + `SignaturesDialog` with **draw / image-upload / typed** capture, status tracking, auto-marks doc `signed` when all sign. (Rendering the signature onto the exported PDF + reorder UI are follow-ups.)_
- [ ] **One eSign provider** (Digio recommended): invite → provider OTP → webhook → signed PDF in
      S3 → `SignerStatus.signed`. **Hard-gate eSign off for Schedule-1-excluded doc types** (wills,
      PoA, trusts, immovable-property conveyance) per [`01-market-analysis-india.md`](01-market-analysis-india.md) §4.1.
      _Status: not started — deferred (Digio is paid in prod). The Schedule-1 hard-gate is still open (free, provider-independent)._
- [ ] Audit-trail page appended to signed PDF (who/when/IP/OTP txn id).

## Phase E — Multi-persona, marketplace, long tail · ~Weeks 14+

- [ ] Organisation/agency multi-tenancy (`Organisation`/`OrgMember`/`OrgRole` already modelled).
      _Status: not started — models + access checks exist (comments/signers honour `ownerOrgId`), but no org UI/flows._
- [ ] Advocate verification (manual BCI number review → `BrandingProfile.barCouncilNumber`).
- [ ] Template marketplace (advocate publishes a template, platform takes 20–30%; `DocumentTemplate.ownerType` already supports this).
- [ ] White-label share subdomains (Next.js middleware + DNS wildcard).
- [~] Long-tail consumer docs: NDA, MoU, partnership deed, will, gift deed, GPA, sale agreement, RTI.
      _Status: partial — available as **AI presets** in `DOCUMENT_PRESETS` (NDA, MoU, partnership deed, will, gift deed, GPA, RTI). No structured templates._
- [~] Hindi UI on `apps/app` (i18next plumbing exists — content + QA work).
      _Status: partial — shell, dashboard, documents list, new-document picker, and the document dialogs (share/comments/signatures/version) translated with real Hindi. **Remaining:** auth pages, editors + sub-components, SharedDocumentView, finish Settings; + native-speaker QA._
- [ ] eStamp aggregator integration; PWA + offline drafting (redux-persist already wires storage).

---

## Pricing (starting hypothesis — validate against conversion)

| Tier | Price | Docs | AI | Export | eSign | Persona |
|---|---|---|---|---|---|---|
| Free | ₹0 | 2 lifetime | 5 attempts/day | preview only (no download) | – | individual |
| Starter | ₹199/mo or ₹49/doc | 10/mo | 100 attempts/mo | PDF, all page sizes | drawn/typed | individual |
| Pro | ₹499/mo | 50/mo | 500 attempts/mo | PDF + **DOCX** | Aadhaar eSign (cost passthrough ~₹15/sig) | individual/advocate |
| Advocate | ₹999/mo | 150/mo | 1500 attempts/mo | PDF + DOCX + branded | eSign | verified advocate, marketplace publish |
| Agency | ₹2,499/mo + seats | unlimited | 5K attempts/mo | all + white-label | eSign | firm/org |

Metering reuses the existing `Plan` / `PlanFeature` / `WalletUsage` models — **no schema change
needed** for billing. The free tier's paywall is "draft for free, pay to export."

## Success metrics (north stars per phase)

- **Phase A:** % of new documents created via AI draft; AI-revision acceptance rate; AI-attempt → paid-export conversion.
- **Phase B:** DOCX export adoption among advocate-tier users.
- **Phase C:** advocates retained MoM; court-docs drafted/advocate/month; **citation-correctness rate** (audited sample — this is also a liability metric).
- **Phase D:** documents shared; signature completion rate.
- **Phase E:** marketplace GMV; agency seat expansion.

## Top risks (carried from plan, plus new)

| Risk | Severity | Mitigation |
|---|---|---|
| AI emits **wrong (pre-2024) criminal-code citations** | High | Deterministic dated citation library; AI looks up, never invents; audited correctness metric |
| AI hallucinates clauses / wrong legal advice | High | Disclaimer always; deterministic risk rules; per-state library hand-curated |
| eSign offered on a Schedule-1-excluded doc | High (legal) | Hard gate by doc type |
| BCI complaint / PIL | Moderate | DIY positioning; verified advocates are independent; never "we draft for you" |
| Print fidelity drift | High | Server-side Puppeteer only for final output; calibration ruler |
| Template proliferation unmaintainable | High | Enforce `DocumentTypeBundle` contract at PR review |
| AI cost spiral on free tier | High | Per-attempt metering; Haiku for cheap ops, Opus for generation; 24h cache; no anonymous AI |
