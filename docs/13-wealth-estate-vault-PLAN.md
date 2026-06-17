# Plan: Estate & Wealth Vault — a self-contained, configurable module

> Status: PLAN (refined, local pass). Built to a hard constraint: this ships as **one toggleable,
> config-driven module** you can enable/disable, configure per-org, and take live on its own — not a
> feature smeared across the app. Sections: 0 Module architecture (the spine) · 1 Security/encryption ·
> 2 Data model + extraction · 3 Go-to-market/monetisation · 4 Phasing (each phase independently shippable).
> Market analysis that justifies the direction is in §3 + Appendix C; the short version: it works as a
> **wealth manager AND a pass-to-nominee dead-man-switch** — but the wealth angle wins only by tracking the
> **physical/illiquid assets the RBI Account Aggregator structurally can't see** (real estate, gold, crypto,
> unlisted/foreign), which are the *majority* of Indian household wealth. Three load-bearing decisions this
> forces: (1) compete on **total net worth**, not financial-account aggregation (§3.1); (2) nominee handover
> **must be paired with a will** — a nominee is a trustee, not an owner (§9); (3) **simple, guided UX** is the
> moat against super-app bloat (§8). Reuses existing vault/intelligence/will-drafting code throughout (§5).

---

## 0. Module architecture — the spine (the part emphasised most)

**Goal: `EstateVault` is a module. One flag turns it on. Config (DB, per-org) shapes it. It can go live
alone, be disabled without collateral damage, and later be extracted into its own deployable.**

### 0.1 Backend — a self-contained NestJS dynamic module
- New dir `apps/api/src/app/estate-vault/` containing **everything**: controllers, services, scheduler,
  DTOs, the module file. Route prefix namespaced: `/estate/*` and `/config/estate-vault/*`.
- `EstateVaultModule.forRoot({ enabled })` (dynamic module). When `enabled=false` it registers **no
  controllers and no scheduler** — zero runtime surface, data tables untouched. Enable via
  `ESTATE_VAULT_ENABLED` env + per-org `EstateVaultConfig.enabled`.
- **Depends only on existing shared seams via DI** — `VaultCryptoService`, `StorageService`,
  `MailService`, the doc-intelligence pipeline services, `AiService`. It imports them; it does not reach
  into their internals. That clean dependency edge is what makes later extraction into a standalone
  service possible. Follows `docs/ARCHITECTURE_PRINCIPLES.md` (interface → registry → factory).
- **Capability advertisement:** a `GET /me/features` (or extend existing `/catalog`) returns
  `{ estateVault: boolean }` so the frontend mounts conditionally. (Confidence the app has a catalog/me
  endpoint to extend: high — `documents.service.listTypes()` exists; verify a `/me` features surface.)

### 0.2 Frontend — a lazy-loaded, flag-gated feature bundle
- New dir `apps/app/src/app/features/estate/` — its own routes, queries, components. **Lazy-loaded** so
  the bundle isn't shipped to users without the capability. Nav entry + routes mount only when
  `features.estateVault` is true. Admin config screens under `/config/estate-vault` (per the UI-consistency
  rule set: DataTable + server paging + `Select` filters + `t('key','English')`).

### 0.3 Config-as-data — the "I can handle/modify/configure it" requirement
A DB-backed, org-scoped `EstateVaultConfig` (same pattern as `VaultEntityKindConfig` /
`vault-config.service.ts`, DB-over-code) controls, **without redeploy**:
- which **asset types** are enabled and their order/labels;
- **liveness cadence** (ping every N days), number of missed pings before escalation, cooling-off length;
- **proof-of-death requirements** (which signals are mandatory);
- **max nominees per asset** (default 4, per Banking Laws (Amendment) Act 2025);
- **feature toggles** for sub-surfaces: net-worth dashboard, gap-nudges, claims-concierge, B2B2C white-label.

**Asset types + their financial-document extraction schemas are authored as DATA**, reusing the manifest
loader from `docs/12-template-plugins-PLAN.md`. Adding "ULIP" or "sovereign gold bond" as an asset type =
a manifest row, **no deploy**. This is the same plug-and-play engine, applied to a second domain — build
docs/12's `@org/template-kit` loader first and this module is a consumer of it.

### 0.4 Kill switch & data isolation
- All tables prefixed `Estate*` / `Asset*` and owned by this module's migration. Disabling hides
  UI + routes; **data is preserved**, never dropped.
- A documented internal service interface (`EstateVaultApi`) so other modules consume it through a port,
  not by importing services directly — keeps the seam clean for extraction.

---

## 1. Security & encryption — the hard blocker, designed concretely

**Today:** one app-level `VAULT_ENCRYPTION_KEY` AES-256-GCM-decrypts *everything*
(`vault-crypto.service.ts`). That cannot safely support "release only this nominee's slice" — releasing
would mean handing over the master key. **Confidence this is insufficient: high.** Replace with envelope
encryption.

### 1.1 Envelope encryption (per-asset DEK, wrapped per principal)
- Each asset's sensitive payload (value, account/policy numbers) is encrypted with a random 256-bit
  **DEK** (AES-256-GCM), one DEK per asset (or per vault if simpler for v1).
- The DEK is **wrapped** (encrypted) separately for each principal allowed to read it, stored as `DataKey`
  rows:
  - owner → DEK wrapped with the owner's KEK;
  - each nominee → DEK wrapped with that nominee's KEK (added at nomination time).
- **KEK strategy (decision required, recommend v1 = managed-KMS):**
  - **v1 — App-managed KEK under a real KMS.** Move the master key out of the env var into AWS KMS / GCP
    KMS (or `age`/libsodium sealed-boxes for self-host). Per-user KEK wrapped by the KMS master. Server can
    mediate release; lost user passphrase ≠ lost data. Not zero-knowledge — accept that trade-off for v1.
  - **v2 — Zero-knowledge mode (optional, high-assurance).** KEK derived client-side from passphrase/passkey;
    server never sees plaintext DEK. Requires **key escrow / Shamir secret-sharing** so a *dead* owner's
    DEK can still be unwrapped for the nominee. Document as future; do not gate v1 on it.
- **Nominee removal ⇒ DEK rotation.** Removing a nominee must re-key the asset (new DEK, re-wrap for
  remaining principals) so the removed nominee's old wrapped key is dead. Don't just delete the `DataKey` row.

### 1.2 Release mechanism (the dead-man-switch state machine)
`ReleaseGrant.status`: `active → pinged → escalated → cooling → released` (plus `revoked`). On `released`,
the server exposes the **nominee-wrapped DEKs only for assets nominated to that nominee** — never the whole
vault. Nominee authenticates via an invite token (reuse the `DocumentShare` token pattern in `shares/`),
gets **read-only, audited** decryption of their slice; every access lands in `VaultAccessLog`.

### 1.3 False-trigger guardrails (all configurable, conservative defaults)
A wrongful release is catastrophic, so release requires **multiple independent signals**, never a timer alone:
1. Periodic liveness ping (email/SMS); owner taps "I'm here" → timer resets.
2. N missed pings over a window → `escalated`.
3. Trusted-contact corroboration **and/or** nominee-uploaded death certificate.
4. Mandatory cooling-off + loud notification to **all** owner channels before `released`.
5. Owner override at any point; full `LivenessEvent` audit trail.

### 1.4 Other security notes
- **Crypto holdings: store statements/keys-as-documents, never custody private keys.** Warn explicitly.
- Threat model to cover in design doc: server compromise (KMS bounds blast radius), nominee collusion,
  replay, key rotation, backup/restore of wrapped keys.

---

## 2. Data model + extraction

### 2.1 Prisma models (new, namespaced; sensitive numerics encrypted via DEK)
- `Asset` — owner scope, `type` (from config), institution, label, `identifierMasked`,
  `valueEncrypted`+`currency`, `asOf`, status, `sourceDocumentId?`, `vaultEntityId?`, `dekId`.
- `AssetValuation` — assetId, value, currency, asOf, source(`manual|extracted|aa`). History → net-worth
  over time without overwriting; also the seam for future AA auto-refresh.
- `Nominee` — owner scope, name, email, `phoneEnc`, relationship, status(`invited|active`), inviteToken.
- `AssetNomination` — assetId, nomineeId, `priority`(primary/successive), `share?` (supports up-to-4 split).
- `ReleaseGrant` — owner, nominee, `scope`(all|asset-list), status, schedule, lastPingAt, missedCount,
  `proofRefs` Json, releasedAt.
- `LivenessEvent` — append-only audit driving the scheduler.
- `DataKey` — per-principal wrapped DEKs (§1.1).
- `WealthSnapshot` — cached `totalsByCategory`/`netWorth`/`currency`/`asOf`, recomputed on asset change.
- `EstateVaultConfig` — org-scoped JSON config (§0.3), DB-over-code.

### 2.2 Financial-document extraction (cross-document — the real new capability)
- Analysis today is **per-document only** (`AnalysisRun`). New: an aggregation service that turns N
  extractions into a deduped `Asset` set (dedupe by institution + masked identifier) and recomputes
  `WealthSnapshot`.
- New `ExtractionSchema`s **authored as manifest data** (docs/12): `insurance_policy`, `mf_cams_statement`,
  `bank_statement`, `crypto_holdings`, `property_deed`, `epf_nps`, `will`. Register their keys in the
  classifier candidate set (`libs/doc-intelligence/src/schemas/_registry.ts`).
- Add a `FieldMap`: extraction → `Asset` fields, **including "nominee on record"** — extracting that powers
  the highest-value nudge ("this policy has no nominee").
- Reuse pluggable `AiService.extract()`; keep per-field confidence + review routing for load-bearing values
  (account numbers, sums). Pipeline: upload → classify → extract → upsert `Asset` → recompute snapshot.

### 2.3 Document versions & periodic re-uploads (time-series — load-bearing)
Financial documents are **inherently periodic**: a CAS in January, another in February, a quarterly statement,
an annual premium receipt. The system must treat these as **versions over time of the same thing, not new
things.** Core rules:
- **Documents version, assets don't duplicate.** Each upload is a `SourceDocument` stamped with a
  **`periodAsOf`** (the statement's *as-of* date, extracted — not the upload date) and grouped under a stable
  **`documentSlot`** (e.g. "ICICI savings statement", "CAMS CAS"). Re-uploading Feb after Jan adds a *version*
  to the slot; it does **not** create a second account/asset. (Reuse the existing `DocumentGroup` concept from
  the `add_document_groups` migration as the grouping primitive — verify fit.)
- **Each version → an `AssetValuation` row** (value + `asOf` + `source`), keyed to the asset. This is exactly
  why §2.1 has `AssetValuation` as history, not a single mutable `value`: Jan and Feb both persist, powering
  net-worth-over-time and returns. **Never overwrite; always append.**
- **Latest-version pointer.** Current net worth, the dashboard, and the Estate Report read the **most recent
  version per slot** (`max(periodAsOf)`); history reads all. Out-of-order uploads (Jan after Feb) sort by
  `periodAsOf`, not upload time.
- **Idempotent re-ingest / dedupe.** Same period re-uploaded → replace that version (by checksum/period), don't
  double-count. Holdings reconcile by institution + masked identifier (folio/account), not by document.
- **Freshness is measured from the latest version's `periodAsOf`** (ties to §11.3): "your CAS is 5 months old"
  drives the re-confirm loop. The Estate Report flags per-asset staleness so the nominee knows what's current.
- **Corrections vs. periods.** Distinguish a *new period* (Feb statement) from a *correction of the same period*
  (re-scan of January) — keep an edit/version audit (the pipeline already tracks `Extraction.edits`).

---

## 3. Go-to-market & monetisation (with the market evidence)

### 3.1 Market verdict (verified June 2026) — the reconciled wealth-manager stance
- **Don't compete on financial-account aggregation; compete on TOTAL net worth.** RBI **Account Aggregator**
  (~2.88B accounts enabled / ~284.6M linked / ~410 FIUs) lets INDmoney/Cred/Jupiter/Fi auto-pull
  **regulated financial** data with no uploads. Trying to out-aggregate them loses on friction + freshness.
  **But AA only sees a minority of Indian wealth.** It **structurally excludes** real estate, physical gold,
  crypto, unlisted shares (outside depositories), joint and non-individual accounts, and >2yr history — and
  in 2023–24 Indian households put **₹38.4 lakh cr into physical assets vs ₹3.4 lakh cr into financial**
  (~11:1); household **gold alone > $5 trillion (~125% of GDP)**. So a document/manual vault is the *only*
  practical home for the **majority** of household wealth. **The wedge: be the one place that shows the whole
  picture — pull the AA-covered financial slice later, own the physical/illiquid slice now.** **Confidence: high.**
- **This is also what makes it a real wealth manager, not a toy:** net worth = (physical assets you capture
  by document/manual entry) + (financial assets, manual now / AA-synced later). INDmoney can't easily add the
  physical long tail; you can't easily out-aggregate AA — so the defensible product is the *union*.
- **The after-death gap is the unserved pain.** Unclaimed bank deposits **>₹82,000 cr** (late 2025),
  unclaimed life insurance **~₹25,000 cr**, inoperative EPF **~₹8,505 cr**; the govt drive recovered only
  **₹5,777 cr**. Cause: families don't know what the deceased owned or how to claim it.
- **Regulatory tailwind:** Banking Laws (Amendment) Act 2025 (≤4 nominees), IRDAI nominee mandates, **DPDP
  Act §14 + Rule 13 "Right to Nominate"** for digital data after death.
- **Incumbents are tiny** (Yellow FY24 ₹46L; WillJini FY25 ₹1.85cr; EasyInherit unfunded; Kustodian.life
  does post-death *claims*, ₹203cr+ processed). Global: Everplans **$99.99/yr**, FutureVault (B2B2C).
  Digital-vault market ~$1.1B→$2.06B by 2028. **Read: real but low consumer willingness-to-pay.**

### 3.2 Revenue shows up at the ends, not the middle
- **Consumer subscription** (organize + legacy): freemium; paid tier = release/multi-nominee/concierge.
  India price-sensitive → anchor **₹999–₹2,999/yr**, below Everplans. Weak as a standalone business
  (see incumbent revenues). **Confidence: moderate.**
- **B2B2C white-label** (insurers / wealth managers / banks give clients a vault — FutureVault model).
  Most credible recurring revenue. Module config (§0.3) must support per-tenant branding/toggles.
- **Will + estate-planning upsell — the warm, NEAR-TERM revenue (revised; see §11.5).** You already draft
  wills; the inventory you build pre-fills the will (§9). Sell will/estate services *at the moment of asset
  organisation*, while the user is alive and engaged. This is the revenue to lead with.
- **Post-death claims concierge** (Kustodian model): success-fee on recovered assets — highest value per
  transaction but triggers only on death (long, morbid feedback loop). **Long-tail, not the opening move.**
  Design `ReleaseGrant`/`AssetNomination` so it's an unlock, not a rewrite.
- **No investment advice.** "Hidden benefits/policies" = SEBI RIA risk. Ship **operational gap nudges
  only** ("no nominee", "renewal due", "no will on file"), legal-reviewed copy. **Confidence: high.**

### 3.3 P0 — validate before building (no code)
Landing A/B: "estate vault + nominee handover" vs "wealth dashboard"; measure waitlist conversion +
willingness-to-pay; 1–2 partner interviews (insurer/wealth-mgr) to test B2B2C pull. Pre-set kill criteria.

---

## 4. Phasing — every phase is an independently shippable module increment

| Phase | Ships | Independently live? | Effort |
|------|-------|---------------------|--------|
| **P0** | Demand validation (landing/A-B, partner calls) | n/a | S, no code |
| **M0 (NEW — see §11.1)** | **Concierge / Wizard-of-Oz**: manually build a register + will for 10–20 real families. No module, no encryption, mostly spreadsheets + the existing will flow. Proves the emotional hook before any crypto. | n/a (manual) | S, ~no code |
| **M1** | `EstateVaultModule` skeleton + `EstateVaultConfig` + flag + empty UI shell + capability gating | Yes (empty, but real toggle) | S |
| **M2** | `Asset`/`AssetValuation` + manual add/edit + net-worth snapshot + dashboard | **Yes — standalone asset organizer** | M |
| **M3** | 3 financial `ExtractionSchema`s (manifest data) + auto-create assets from uploads | Yes (additive) | M |
| **M4** | Envelope encryption: DEK/`DataKey` + KMS + migrate asset values off the single key | Internal upgrade (prereq for M5) | M–L |
| **M5** | `Nominee`/`AssetNomination`/`ReleaseGrant` + liveness scheduler + scoped nominee access | **Yes — the differentiator** | L |
| **M6** | Gap nudges (non-advice) | Yes | S–M |
| **M7** | Monetisation unlocks: B2B2C white-label config + claims-concierge workflow | Yes, optional | L |

**v1 cut line:** M1+M2(+M3) = a configurable estate/asset organizer that can go live on its own. M4+M5 is
the "secure release to nominee" upgrade — the actual moat — and depends on the envelope-encryption work, so
**do not promise nominee release before M4 lands.**

**Honest risk:** M4→M5 is the hard, slow, correctness-critical part and the *only* differentiated part.
M1–M3 is a pleasant organizer that competes with nobody. If you stall before M4 you've built the commodity
and skipped the moat — treat M4/M5 as the real project, M1–M3 as setup.

**Dependency note:** M3 and the config-as-data story both depend on the `docs/12` manifest loader
(`@org/template-kit`). Build that first, or M3 falls back to hardcoded schemas (still works, just not
no-deploy).

---

## 5. Critical files
- **Reuse:** `apps/api/src/app/vault/vault-crypto.service.ts` (extend, don't replace),
  `.../vault/vault-config.service.ts` (config pattern), `.../shares/*` (token/grant pattern),
  `.../mail/*`, `.../intelligence/reconciler.service.ts` (scheduler pattern),
  `libs/doc-intelligence/src/schemas/*` + `_registry.ts`, `apps/api/src/app/ai/providers/ai-provider.interface.ts`.
- **New (module):** `apps/api/src/app/estate-vault/*`; `apps/app/src/app/features/estate/*`;
  `tools/prisma/schema.prisma` (§2.1 models) + migration; financial extraction manifests.
- **Cross-ref:** `docs/12-template-plugins-PLAN.md` (manifest loader), `docs/ARCHITECTURE_PRINCIPLES.md`,
  `docs/TASKS.md` (add ledger entries per phase).

## 6. Verification
- **Module toggle:** flag off ⇒ no `/estate/*` routes, no scheduler, UI hidden, tables intact. Flag on per-org
  via config ⇒ surfaces appear. Test both.
- **Extraction:** sample insurance/CAMS/bank PDFs ⇒ deduped `Asset` rows, masked identifiers, confidence;
  DB value column is ciphertext.
- **Aggregation:** net-worth snapshot matches a hand-computed multi-doc fixture.
- **Release (the risky path):** simulate liveness timeout → ping → escalate → cooling → release ⇒ nominee
  decrypts **only** their nominated assets; non-nominee gets nothing; every access in `VaultAccessLog`.
  Negative: timer-only never releases; removed-nominee's old wrapped key fails after DEK rotation.

## 7. Out of scope (v1)
AA-based auto wealth refresh (future; needs NBFC-AA partner — don't gate v1 on it); live crypto-exchange
balances (statement upload only); zero-knowledge client-side encryption (v2); any fiduciary/investment advice.

---

## 8. UX & simplicity mandate (the moat against super-app bloat)

INDmoney's most-cited user complaints are "**overwhelming, aggressive notifications, too much**" — and
account-setup taking 3–4 weeks. The opportunity is the opposite: a calm, guided tool a non-financial,
non-technical Indian adult (and their nominee) can actually finish. **Simplicity is a feature, not polish.**

Principles (binding on every screen):
- **One job per screen, progressive disclosure.** No dense super-app dashboard. Home = a single net-worth
  number + "add your first asset". Detail/advanced behind taps, not on the landing surface.
- **Guided "add an asset" flow** with three on-ramps: (a) **snap/upload a document** → auto-extract → confirm
  (reuses the doc-intelligence pipeline + the vault vision-`scan` autofill pattern); (b) **pick a type and
  type a few fields**; (c) skip for later. Never a blank form wall.
- **Plain language, vernacular-first.** Use the existing i18n (`t('key','English')`); the nominee flow
  especially must read at a low literacy bar — the nominee is often grieving and non-technical.
- **Two personas, two modes.** Owner mode (organise, see net worth, assign nominees) and Nominee mode (a
  dead-simple, read-only "here is what they left and how to claim it" checklist after release). Don't show the
  owner's full app to the nominee.
- **Quiet by default.** Liveness pings and nudges are rare, batched, and dismissible — the opposite of
  aggressive notifications. Cadence is config-driven (§0.3).
- **Trust cues up front.** Encryption/who-can-see-this stated in plain words at the point of data entry; this
  is the #1 adoption blocker for financial/PII data in India.

## 9. Legal requirement: nominee ≠ heir → pair the handover with a will (reuse existing drafting)

**Hard legal constraint, not optional.** The Supreme Court (*Sarbati Devi v. Usha Devi*, 1984; *Shakti
Yezdani v. Jayanand Salgaonkar*, Dec 2023) holds a **nominee is a trustee/custodian, NOT the beneficial
owner**; succession follows the **will**, or statutory succession law in its absence. (Narrow exception:
post-2015 insurance where the nominee is spouse/child/parent.) **Implication: "pass everything to the
nominee" transfers *custody of information/documents*, not *ownership of assets*. Shipping the dead-man-switch
without this distinction gives users false legal comfort and is a liability.**

Design response (and a monetisation hook):
- Frame the nominee as **"who gets access to find and claim everything"**, explicitly *not* "who inherits".
- **Bundle a will.** You already have will drafting (`will` DocumentTypeBundle + the standard form/render
  flow) — surface a "create/attach your will" step inside the estate flow and store it as a first-class vault
  document. The asset inventory you build for the vault is exactly the schedule-of-assets a will needs →
  reuse it to pre-fill the will. This turns a legal caveat into the product's most valuable, defensible action.
- Show a **coverage gap nudge**: "3 assets have a nominee but no will" — operational, not advice (§3.2).

## 10. Investment tracking, reports, and the Estate Report — "money is not orphaned"

The product mission in one line: **no asset should die with its owner.** ~₹82,000 cr of bank deposits +
~₹25,000 cr of life insurance sit unclaimed precisely because nobody recorded what existed or how to claim
it. Tracking investments and passing down a usable register is the payoff — everything else is plumbing.

### 10.1 Track everything (investment-aware `Asset` model)
Extend `Asset`/`AssetValuation` (§2.1) so an asset is trackable, not just listed:
- `maturityDate?`, `payoutSchedule?` (FD/bond/insurance/PPF maturities, SIP/coupon dates).
- `valuation history` (`AssetValuation` rows) → returns + net worth over time. **Returns are *reporting of the
  user's own data*, not advice** — keep it descriptive (XIRR/absolute), never prescriptive (§3.2 / no SEBI RIA).
- `lastActivityAt` + `dormancyRisk` — RBI deems accounts inoperative after ~2yr inactivity → the on-ramp to
  "orphaned". Track it so we can nudge *before* money is lost.
- `nomineeOnRecord?` (extracted from the document) vs the nominee assigned in-app — the gap that strands money.

### 10.2 Reports for the living user (descriptive, not advisory)
Derived from the models above; rendered in the simple UI (§8):
- **Net worth over time** + **asset allocation** (physical vs financial — the §3.1 wedge made visible).
- **Maturity & income calendar** — "₹2L FD matures 14 Aug", "LIC premium due" — utility that drives retention.
- **Orphan-risk / dormancy alerts** — "this account is 22 months inactive; act before it's frozen" (the
  prevent-while-alive half of the mission).
- **Nominee & will coverage** — "5 of 11 assets have no nominee; 3 have a nominee but no will" (operational
  nudge, ties to §9). 
- **Historical / time-machine views (surfaces the §2.3 time-series).** Because every periodic upload appends an
  `AssetValuation` (never overwrites), the UI can show **value-over-time per asset** and **net-worth-over-time
  for the portfolio** (Jan → Feb → …), with a date-range / "as of <date>" selector to view the portfolio as it
  stood at any past point. Optional, behind a tap (per §8 progressive disclosure) — present but not on the
  default surface.
- **Document version history.** Each `documentSlot` (§2.3) shows its uploaded versions by `periodAsOf` — open
  the January CAS vs the February CAS, see what changed (holdings added/removed, value delta). Old versions are
  retained and viewable, not discarded; the Estate Report can optionally attach the latest statement per asset.

### 10.3 The Estate Report / Asset Register — the artifact that gets passed down
The single most valuable output, and the thing the nominee/heir actually receives:
- A generated **Asset Register**: every asset, institution, masked identifier, current value, maturity,
  nominee-on-record, **and step-by-step "how to claim this" instructions** per asset type (e.g. bank →
  death certificate + nominee KYC + claim form; insurance → policy no. + IRDAI process; MF → CAMS/KFintech
  transmission). This is what turns "find all" from a months-long hunt into a checklist.
- **Reuse the existing document pipeline to produce it.** The register is a document — render via
  `@org/document-templates` + the artboard renderer + the existing export/PDF flow (`DocumentExport`). Author
  it as a manifest template (docs/12), so its layout/claim-instructions are config-data, updatable without
  deploy. The owner can preview exactly "what my family will see".
- **Two release forms:** (a) live, owner-downloadable PDF ("keep this safe / give to your lawyer"); (b) the
  post-death **Nominee mode** (§8) — a read-only, audited, claim-oriented view unlocked by the release flow
  (§1.2), scoped to that nominee's assets only.
- **Honest framing (§9):** the register says who the *nominee* is for each asset and flags where a *will* is
  required for ownership — it helps the heir **find and claim custody**, and points to the will for title.

### 10.4 Phasing fit
Reports + Estate Report slot in after the inventory exists: living-user reports land with/just after **M2–M3**
(they need `Asset`/`AssetValuation`); the **post-death Nominee-mode register** is part of **M5** (needs the
release + scoped-decryption flow). The "how-to-claim" instruction set is config-data — start with the top
asset types (bank, insurance, MF, EPF/NPS, property) and extend.

## 11. Critical-review revisions (these SUPERSEDE the noted sections)

A second-pass critique surfaced seven improvements. Most **shrink the first build** (de-risk) while
**sharpening the wedge**. Where these conflict with earlier sections, **§11 wins.**

### 11.1 Build less first — concierge MVP before any crypto (supersedes §4 ordering)
The core demand assumption (D.1.1: people will manually maintain a physical-asset register) is unproven, yet
§1/§4 spec envelope encryption + a release state machine. Backwards. **New M0** (added to §4): manually build a
register + will for 10–20 families, no automation. If the "your family will find everything" hook doesn't pull
at N≈20, nothing downstream matters. **M4/M5 are *earned*, not scheduled.** Confidence: high.

### 11.2 The wedge has a hidden contradiction — name it and fix valuation (revises §3.1 + §10.1)
The assets AA can't see (gold, real estate) are exactly the ones with **no document and no auto-valuation** —
highest-friction, fastest-stale. Don't pretend it's a free win. Fix with **semi-auto valuation** (add to §10.1):
- **Gold:** store **grams + purity** → auto-value at daily spot. (Gold *is* auto-valuable — model quantity, not rupees.)
- **Property:** store **area + locality/PIN** → estimate via **circle/ready-reckoner rates**; let user override.
- **Unlisted/foreign:** manual, with a "last valued" date + staleness flag.
This turns the wedge from "manual forever" into "enter once, auto-revalue."

### 11.3 Make onboarding survivable — hero ingestion + DigiLocker (revises §2.2 / §10.1 priorities)
Per-type schemas are right, but **prioritise one-file-covers-most**:
- **CAS (CAMS/KFintech + NSDL/CDSL Consolidated Account Statement)** = the **hero upload**: one PDF → nearly all
  mutual funds + demat holdings. Build this *first* among financial schemas.
- **DigiLocker** = first-class ingestion source (govt PAN/insurance/vehicle/some-property; already digital, high
  trust). Glaring earlier omission.
- **Freshness/decay engine** is **core, not a nudge**: periodic re-confirm; a 2-year-stale register is itself
  orphaned. Promote from §10.2 alert to a first-class loop.

### 11.4 Promote Account Aggregator from "out of scope" to a prioritised unlock (revises §7)
AA's **account-discovery** ("you have an account you forgot") is *the* anti-orphaning mechanism — fresh, free,
a trust signal — and arguably more important than manual financial entry. Gated on an NBFC-AA partnership, so
not v1, but **move it from §7 out-of-scope to a high-priority unlock** for the financial half + discovery.
Confidence: moderate (partnership/regulatory lift).

### 11.5 Lead monetisation with the will, not the death-fee (revises §3.2 — done inline)
See §3.2: will/estate-planning upsell at the moment of organising assets is the warm, near-term revenue (you
already have the product); claims-concierge is long-tail because it only triggers on death.

### 11.6 v1 release is human-in-the-loop, not automated (revises §1.2/§1.3 for v1)
A false/fraudulent automated release is catastrophic (D.3.11–12). **v1 = human-verified release**: nominee
contacts the platform → ops verifies the death certificate → manual, audited unlock. This removes the need to
perfect the dead-man-switch state machine before launch; full automation is a v2 luxury. Confidence: high.

### 11.7 Sharpen the entry persona (revises §8)
Don't serve "owner" generically and don't fight INDmoney for the 25-yo returns-tracker. **Enter via the 45–65
"I have stuff scattered everywhere and want my family to find it" persona** — where physical wealth, the will
need, and willingness-to-pay concentrate. Confidence: moderate-high.

> Net of §11: the original analysis is sound but **too eager to build and too optimistic that manual data stays
> fresh.** Shrink the first build (M0 concierge, human release); sharpen the wedge (CAS/DigiLocker, gold/property
> auto-valuation, AA discovery, will-upsell, 45–65 persona).

---

# Appendix A — Current codebase capabilities (what we can reuse vs. build)

Findings from a code audit of the existing vault, doc-intelligence, and auth/sharing/encryption subsystems
(June 2026). **Headline: ~70% of the plumbing exists; the gaps are specific.**

## A.1 Document Vault (exists, reuse heavily)
Models in `tools/prisma/schema.prisma` (~lines 1177–1334): `VaultEntity` (AES-256-GCM `dataEncrypted`,
owner/org scoped, soft-delete), `VaultDocument` (private S3 key, checksum), `VaultAccessLog`
(create/update/reveal/download/delete audit), plus config models `VaultEntityKindConfig`,
`VaultFieldConfig`, `VaultEntityKindField`, `VaultDocKindConfig` (DB-driven, org-scoped overrides, seeded
from `vault.fields.ts`).
- API: `apps/api/src/app/vault/vault.controller.ts` + `vault-admin.controller.ts` — entity CRUD, masked
  list/detail, audited `reveal`/`autofill`, document upload + presigned URL + vision-`scan` autofill.
- Crypto: `vault-crypto.service.ts` — AES-256-GCM, **single app-level `VAULT_ENCRYPTION_KEY`** (the gap §1).
- UI: `apps/app/src/app/features/vault/*` (list/detail/edit/new + autofill dialog).
- **Absent:** net-worth/aggregation, nominee/beneficiary, access-after-death, vault sharing, delegated grants.

## A.2 Document-Intelligence pipeline (exists, reuse for extraction)
Flow `upload → parse → classify → extract → validate → analyze`. Engine in
`apps/api/src/app/intelligence/*`; contracts + schemas in `libs/doc-intelligence/*`.
- **Classification today covers only ~5 legal types** (rent_agreement, rti, legal_notice, nda,
  generic_document). **No financial doc types** — insurance/CAMS/bank/crypto/property currently fall back to
  `generic_document`. (`libs/doc-intelligence/src/schemas/_registry.ts`.)
- Extraction is **schema-driven + DB-over-code resolvable + tiered (native → VLM → agentic)**;
  `ExtractionSchema`/`FieldMap` shapes in `libs/doc-intelligence/src/{types.ts,field-map.ts}`. Pluggable
  `AiProvider.extract()` (`apps/api/src/app/ai/providers/ai-provider.interface.ts`).
- Analysis: `AnalysisService` + `AnalysisRun` model → summary/parties/keyDates/obligations/riskFlags +
  validated citations. **Per-document only — no cross-document aggregation** (the gap §2.2).
- Storage: `StorageService` (S3 + local), presigned URLs; **files not encrypted at rest** (bucket policy only).

## A.3 Auth / sharing / scheduling / encryption (mixed — key gaps here)
- **Users/auth (`apps/api/src/app/auth/*`):** email+password (bcrypt), OAuth (google/github/linkedin),
  WebAuthn passkeys, email verification + reset tokens. `User` has email (no phone — phone lives only in the
  encrypted vault).
- **Orgs/access:** `Organisation` + `OrgMember` (owner/admin/member). Access pattern = `ownerUserId === user`
  OR org-member; see `documents.service.ts` `assertCanAccess()`. **No user-to-user grant.**
- **Sharing:** `DocumentShare` — token-based public links (view/comment/edit), optional password + expiry +
  view tracking (`apps/api/src/app/shares/*`). **Good precedent for nominee invite tokens; not user-to-user.**
- **Mail + queues:** `MailService` (BullMQ `mail` queue + sync fallback, `MailLog`, templates). **BullMQ is
  available** for delayed/repeat jobs.
- **Scheduling:** `setInterval`-based sweepers only (`intelligence/reconciler.service.ts`, `ai-usage.purge.ts`).
  **No `@nestjs/schedule`/cron** — add one for the liveness scheduler (§1.3).
- **Encryption:** AES-256-GCM **only for vault entities**, key from a single env var (no KMS); `Document.data`
  and stored files are plaintext. **This is why §1 (envelope encryption + KMS) is the hard blocker.**

## A.4 Gap summary (what this plan actually builds)
1. Financial-doc extraction schemas (as manifest data) + classifier labels — §2.2.
2. Cross-document `Asset` inventory + `WealthSnapshot` aggregation — new, §2.
3. Envelope encryption (per-asset DEK, KMS, per-principal wrapping) — replaces single-key model, §1.
4. `Nominee`/`AssetNomination`/`ReleaseGrant` + liveness scheduler + scoped nominee access — §1.2/§2.1.
5. The whole thing wrapped as a toggleable, config-driven module — §0.

---

# Appendix B — Market research (full, with sources)

## B.1 Wealth aggregation is already solved without uploads (so don't lead with it)
RBI **Account Aggregator** framework at scale by early 2026: ~**2.88B accounts enabled**, ~**284.6M linked**,
~**410 Financial Information Users**. Consumer apps (INDmoney, Cred, Jupiter, Fi) auto-pull bank/MF/insurance
data with consent — **no uploads, never stale**. A manual-upload net-worth view competes here and loses on
friction + freshness. **Confidence: high.**

## B.2 The after-death asset-discovery failure (the real, unserved pain)
- Unclaimed bank deposits: **₹67,270 cr (Jun 2025)**, **>₹82,000 cr by late 2025** (RBI; ~87% in PSBs).
- Unclaimed life insurance: **~₹25,000 cr** (2023–24); insurer-outstanding **₹8,973.89 cr (Feb 2026)**.
- Inoperative EPF: **~₹8,505 cr** (2023–24).
- Govt "Your Money, Your Right" drive (Oct–Dec 2025) restituted only **₹5,777 cr / 22.95 lakh claims** by
  Feb 2026 — a fraction of the pool. Cause (RBI/IRDAI + claims firms): families don't know what the deceased
  owned, across how many institutions, or how to assemble the documents.

## B.3 Regulatory tailwind
- **Banking Laws (Amendment) Act 2025** — up to **4 nominees** (successive/simultaneous) on bank accounts.
- **IRDAI** — mandatory nominee capture + policyholder communication.
- **DPDP Act 2023 §14 + DPDP Rules 2025 Rule 13** — statutory **"Right to Nominate"** for digital data after
  death/incapacity (nominee = data-access delegate, distinct from legal heir).

## B.4 Competitive landscape (nascent, underfunded — opportunity + warning)
- **Yellow (getyellow.in)** — digital wills + post-demise execution; FY24 revenue **₹46 lakh**.
- **WillJini** — since 2014; FY25 revenue **₹1.85 cr**; total funding **~$54K**.
- **EasyInherit** — unfunded.
- **Kustodian.life** — post-death **claims concierge** (₹**203 cr+** claims processed) — the model with real
  per-transaction value.
- **Global:** Everplans **$99.99/yr**, Trust & Will, Trustworthy (consumer); **FutureVault** (B2B2C for wealth
  enterprises). Digital-vault market ~**$1.1B (2024) → ~$2.06B (2028), ~16.7% CAGR**.
- **Read:** real but **low consumer willingness-to-pay** (sub-₹2-cr incumbent revenues). Revenue concentrates
  at **B2B2C white-label** and **post-death claims**, not a flat consumer subscription.

## B.5 Sources
- AA framework: casparser.in/blog/state-of-account-aggregator-2026 ; financialservices.gov.in/account-aggregator-framework
- Unclaimed assets: business-standard.com (RBI ₹78,213 cr report) ; pib.gov.in PRID 2244475 ; the420.in (₹70,000 cr unclaimed) ; kustodian.life/resources/claim-unclaimed-assets-deceased-india
- DPDP "Right to Nominate": livelaw.in/articles/digital-nominee-legal-heir-dpdp-act-521855 ; dpdpa.com/blogs/righttonominatedpdpadigitalafterlife.html
- Competitors / market size: inc42.com (Yellow) ; tracxn.com (WillJini) ; seniorliving.org/finance/estate-planning/everplans ; futurevault.com/pricing ; einpresswire.com (digital vault $2.06B by 2028)

> Figures are point-in-time (verified June 2026) and from secondary sources; re-verify before any
> investor-facing or go/no-go use.

---

# Appendix C — Indian scenario, deep-dive (wealth manager + nominee handover)

The analysis that produced §3.1, §8, and §9. Three structural facts about India decide the product.

## C.1 Indian wealth is mostly physical — and AA can't see it (the wealth-manager wedge)
- **Composition skews heavily physical.** 2023–24 household savings: **~₹38.4 lakh cr physical** (real
  estate, gold) vs **~₹3.4 lakh cr net financial**. Within financial portfolios, **bank deposits ~54%,
  securities only ~13%**.
- **Gold is the elephant.** Household gold value **> $5 trillion (~125% of GDP)** by Jan 2026 — **~175% more
  than bank deposits + equities combined**; ~25,000 tonnes.
- **The RBI Account Aggregator covers only regulated financial data** (bank/NBFC deposits, MF/demat, insurance,
  NPS, loans). It **excludes**: real estate, **physical gold/commodities**, **cryptocurrency** (exchanges
  aren't FIPs), **unlisted shares** held outside NSDL/CDSL, **joint accounts**, **non-individual** (firm/
  company/trust) accounts, and history **beyond ~2 years**.
- **Conclusion:** INDmoney & co. show the *minority* of a typical Indian's wealth and **cannot** show the
  physical/illiquid majority. A document/manual vault is the natural — and largely uncontested — home for that
  majority. The wealth-manager value is **completeness** (one true net worth), not aggregation speed.
  **Confidence: high.**

## C.2 Nominee ≠ heir (the legal constraint behind §9)
- **Sarbati Devi v. Usha Devi (1984)** and **Shakti Yezdani v. Jayanand Salgaonkar (Dec 2023, SC)**: a nominee
  is a **trustee/custodian**, not the beneficial owner; nomination is a *facilitatory* mechanism that does not
  override testamentary/statutory succession. A nominee can't sell/transfer without probate/succession
  certificate. Narrow exception: post-2015 insurance, nominee = spouse/child/parent → beneficial owner unless
  a will says otherwise.
- **Product consequence:** the dead-man-switch passes *access to find and claim*, not *ownership*. Must be
  paired with a will (which you already draft) to be genuinely useful and legally honest.

## C.3 Adoption realities (behind §8 and §3.2)
- **Willingness to pay is low; aggregation is commoditised + free.** INDmoney's core aggregation is free
  (monetises on broking); estate incumbents earn sub-₹2 cr. → flat consumer subscription is weak; lean B2B2C +
  claims-concierge.
- **Super-apps overwhelm.** Documented INDmoney friction: "overwhelming," "aggressive notifications," "too
  much," 3–4 week onboarding. → simplicity + a finishable guided flow is a genuine differentiator.
- **Privacy is the gating fear.** Email-scan/aggregation features draw "invasive" complaints; financial+PII
  data needs visible, plain-language trust cues at entry (ties to envelope encryption §1 + masking).

## C.4 Sources (Appendix C)
- Wealth composition / gold: relakhs.com (RBI household savings 2024-25) ; business-standard.com (household
  wealth +14.5% 2024; gold > top-10 central banks) ; india.com (gold > $5T / 125% GDP).
- AA coverage limits: hyperverge.co/blog/account-aggregator-framework-rbi ; indiafreenotes.com (AA limitations) ;
  casparser.in/blog/state-of-account-aggregator-2026 ; pwc.in (AA explainer).
- Nominee vs heir: supremetoday.ai (nominee = trustee) ; bhattandjoshiassociates.com + youareensured.com
  (Shakti Yezdani) ; mondaq.com / trilegal.com (nominee conundrum, post-2015 insurance exception).
- Adoption/UX: INDmoney App Store / Play listings + user-sentiment summaries (overwhelm, onboarding delays,
  privacy concerns).

> As with Appendix B: point-in-time (June 2026), secondary sources — re-verify before go/no-go.

---

# Appendix D — Open questions & assumptions to re-check (think-and-revisit list)

This doc is a thinking artifact, not a commitment. Before building, pressure-test these. Each is tagged with
current confidence and *who/what* settles it. **Nothing here is runtime-verified.**

## D.1 Strategy / market (settle via the P0 demand test + partner calls)
1. **Is the "physical-wealth wedge" real demand or just a real gap?** AA can't see gold/real-estate (high
   confidence on the *gap*); that people will *manually maintain* a physical-asset register is the
   **unproven** leap (moderate). → P0 landing test + interviews.
2. **GTM sequencing — consumer vs B2B2C vs claims-concierge.** Recommended: build consumer, monetise B2B2C +
   claims. Confidence: moderate. → validate with 1–2 insurer/wealth-mgr conversations before committing.
3. **Willingness to pay.** Assumed low (incumbent revenues sub-₹2cr). Confidence the *assumption* is right:
   high; the *price point* (₹999–₹2,999) is a guess: low. → pricing survey in P0.
4. **Does AA's roadmap erode the wedge?** AA is expanding within *regulated financial* data only; physical/
   gold/crypto remain out of scope. Risk it eats the wedge: low — but re-confirm AA scope at build time.

## D.2 Legal (needs an Indian lawyer's sign-off — do not ship without it)
5. **Nominee≠heir framing + the will-pairing copy** (§9). Confidence in the doctrine: high (*Sarbati Devi*,
   *Shakti Yezdani 2023*). Exact post-2015 insurance exception wording and any 2024–26 amendments: re-verify.
6. **"How-to-claim" instructions per asset type** (§10.3) must be legally + operationally accurate and kept
   current — varies by institution and changes. Treat as reviewed config-data, not free text. Confidence: low
   until a lawyer/ops reviews each.
7. **DPDP "Right to Nominate" (§14 / Rule 13) final operative text** and what a "data nominee" may lawfully
   access — confirm against the gazetted DPDP Rules 2025, not secondary summaries.
8. **Is the product a fiduciary / does any report cross into investment advice (SEBI RIA)?** Design intent:
   descriptive only. Confidence: high it *can* stay non-advisory; needs counsel to confirm the line.

## D.3 Security / architecture (settle in a design spike before M4)
9. **KEK strategy: v1 managed-KMS vs zero-knowledge** (§1.1). Recommend managed-KMS v1. Open: which KMS, and
   whether any zero-knowledge mode ships at all. Confidence single-env-key is insufficient: high.
10. **DEK granularity — per-asset vs per-vault.** Per-asset = cleaner scoped release + rotation, more keys.
    Open trade-off.
11. **Release-trigger threshold tuning** (missed-ping count, cooling-off, proof requirements). False-release is
    catastrophic; defaults must be conservative and lawyer-reviewed. Open.
12. **Nominee identity proofing at release.** How does a claimed nominee prove they are who they say, post-death?
    (Invite-token + KYC?) Unresolved — design before M5.

## D.4 Codebase assumptions to verify in code (cheap to check now)
13. **`/me` features / capability endpoint exists** to gate the module (§0.1). Flagged high-confidence-but-
    unverified — grep before relying on it.
14. **Artboard/`document-templates` can render a variable-length Asset Register** with pagination (§10.3).
    Pagination utilities exist; confirm they handle a long, data-driven table.
15. **`docs/12` manifest loader is a hard dependency** for financial schemas + config-as-data + the register
    template. If docs/12 isn't built, M3/§10.3 fall back to hardcoded (works, not no-deploy). Sequence accordingly.
16. **Reuse fit of vault vision-`scan`** for the guided "snap a document" on-ramp (§8) — confirm it generalises
    beyond ID cards to financial statements.

## D.5 Product scope still undecided
17. Multi-currency / NRI assets (foreign accounts AA can't see — possibly a strong sub-wedge). Open.
18. Joint/family assets and shared vaults (HUF, joint property) — Indian-specific, not modelled yet.
19. Whether crypto is in v1 at all (high sensitivity, statement-only) — leaning defer.

> When revisiting: start at D.1 (is the wedge real?) and D.2 (is it legal?) — those are gat­ing. D.3–D.5 only
> matter if D.1/D.2 hold.
