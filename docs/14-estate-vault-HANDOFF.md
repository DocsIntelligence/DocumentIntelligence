# Estate & Wealth Vault — HANDOFF / RESUME (read this first)

> Self-contained handoff for a fresh account/session. Pairs with the full plan in
> **`docs/13-wealth-estate-vault-PLAN.md`** (strategy, market analysis, security design,
> open-questions Appendix D). Burn-down lives in **`docs/TASKS.md` Tier 11**; the dated
> journal is **`docs/BUILD_LOG.md`** (newest entries on top). Last updated **2026-06-18**.

> ⚠️ **IN-FLIGHT FEATURE — read `docs/15-estate-multiprofile-RESUME.md` FIRST.** A multi-profile +
> sharing rework is **mid-implementation**: backend complete & compiling, **frontend switcher NOT
> built**. The app still works on an auto-created "self" profile. Migration
> `20260618160000_estate_profiles` must be applied (`pnpm prisma:migrate`).

## 0. TL;DR — where we are
A new, **toggleable** module "Estate & Wealth Vault" is built through several milestones and is
**build + lint green but NOT runtime-tested** (the user verifies all flows manually at the end).
Mission: *track all assets (incl. the physical/illiquid wealth the RBI Account Aggregator can't see)
+ pass them to a nominee so "money is not orphaned."* Nominee = custodian, **not** heir → pair with a will.

**Shipped:** M1 module shell · M2 asset inventory + net worth + history · M5 nominee + dead-man-switch
+ Estate Report · M3 document capture + AI extract-assist · M3+ CAS multi-holding import · dedupe-on-reupload
· M6 gap nudges + freshness/dormancy · folder restructure · Admin config UI (`/config/estate-vault`) ·
**M4 envelope encryption (per-asset DEK)** · extract text-first + password PDFs · Wealth Vault nav submenu ·
multi-file bulk import · nominee enrichment (KYC + Vault link) · Estate Report **PDF** (`/estate/report.pdf`) ·
CAS dedupe fix (label in key) · assets bulk-select/delete · nominee = Vault person (source of truth) ·
**M5 hardening** (proof-of-death upload + `/config/estate-vault/grants` verification + multi-instance
scheduler `SchedulerLease` + legal-review config entry) · Vault bulk KYC upload (classify+extract+fill) ·
provider-agnostic OCR (text-first).

**IN FLIGHT:** **Multi-profile + sharing** (manage self + spouse + a wealth-manager's clients; profiles
scoped by `profileId`; shareable via `EstateProfileAccess`). **Backend done & compiling; frontend
switcher/profiles-page pending** → see `docs/15-estate-multiprofile-RESUME.md`.

**Not done (next):** the multi-profile **frontend** (docs/15 §4) · lawyer review (gated) · forms →
react-hook-form. **Deferred by user (3rd-party):** DigiLocker, lawyer/physical copies, hosted KMS.

## 1. FIRST STEPS on a fresh checkout/account (do this before anything)
```bash
pnpm install
pnpm prisma:migrate            # = prisma migrate deploy — APPLIES pending migrations to your DB
pnpm prisma:generate           # regenerate the client
```
> ⚠️ Estate migrations (apply ALL, in order): `20260617144855_estate_vault`, `..._estate_nominee_release`,
> `20260618120000_estate_data_keys` (M4 DataKey), `20260618130000_nominee_kyc`,
> `20260618140000_nominee_vault_source` (drops the duplicated nominee KYC cols — KYC now lives in the
> linked Vault person). If the DB doesn't have them applied, every `/estate/*` write 500s — e.g.
> `The table DataKey does not exist` on `/estate/assets/*` means M4 isn't migrated. After ANY branch
> switch/pull: `pnpm prisma:migrate` (+ `pnpm prisma:seed` for the `relationship` lookup group used by the
> nominee form; the form falls back to a built-in list if unseeded).

**Env:** `ESTATE_VAULT_ENABLED` (default on; `=false` mounts nothing). `VAULT_ENCRYPTION_KEY` (32-byte
base64; required in prod — reused by estate for at-rest encryption). AI vision provider configured for
extract-assist (`/estate/extract*`). `REDIS_URL` optional (mail/queues fall back to sync).

**Build/verify gates (every unit):** `pnpm nx build @org/api` + `pnpm nx build @org/app` + 
`pnpm nx run-many -t lint -p @org/api @org/app @org/dto @org/api-client` (must be 0 errors). There is NO
`typecheck` target — `build` type-checks.

## 2. Where the code lives (layered structure — follow it for new files)
**API** `apps/api/src/app/estate-vault/`
```
estate-vault.module.ts        # EstateVaultModule.forRoot() — flag-gated dynamic module
estate.constants.ts           # ESTATE_VAULT_ENABLED, DEFAULT_ESTATE_CONFIG, CLAIM_INSTRUCTIONS
dto/estate.dto.ts             # createZodDto wrappers over @org/dto schemas
controllers/
  estate.controller.ts        # /estate/* (assets, networth, nominees, nominations, release, checkin, report, nudges)
  estate-document.controller.ts # /estate/* docs + /estate/extract + /estate/extract-holdings
  estate-admin.controller.ts  # /admin/estate-vault/* (config GET/PUT, grants, grants/:id/release)
  estate-nominee.controller.ts# public /estate/nominee-access/:token (no auth, token-guarded)
services/
  asset.service.ts            # asset CRUD, valuations, net worth, bulkCreate (+ dedupe), snapshots
  asset-document.service.ts   # doc upload/version, presigned URL, AI extract (single + holdings array)
  nominee.service.ts          # nominee CRUD + per-asset nominations
  release.service.ts          # dead-man-switch grants, check-in, human-verified release, tick()
  estate-liveness.service.ts  # hourly setInterval scheduler → release.tick()
  estate-report.service.ts    # owner masked preview + token nominee view (decrypted, scoped)
  gap.service.ts              # gap nudges + freshness/dormancy
  estate-vault-config.service.ts # config-as-data (org→system→code)
```
**App** `apps/app/src/app/features/estate/`
```
index.ts (barrel)   queries.ts (all React Query hooks + formatMoney)
pages/   EstateHomePage · EstateAssetsPage · EstateAssetNewPage · EstateImportPage ·
         EstateAssetDetailPage · NomineesPage · EstateReleasePage · EstateReportPage · NomineeAccessPage
components/ AssetRegister.tsx · AssetDocuments.tsx
```
**Shared:** `libs/shared/dto/src/lib/estate/estate.schema.ts` (Zod, source of truth for shapes);
`libs/shared/api-client/src/lib/estate.service.ts` (`createEstateService`, wired in `services-context.tsx`
+ `main.tsx`). Routes in `apps/app/src/app/app.tsx` (estate under MainLayout; public `/n/:token`).
Nav: capability-gated "Wealth Vault" item in `MainLayout.tsx` via `useEstateCapability`.

## 3. Prisma models (in `tools/prisma/schema.prisma`)
`Asset`, `AssetValuation` (append-only history), `AssetDocument` (slotKey+periodAsOf versioning),
`WealthSnapshot`, `EstateVaultConfig`, `Nominee` (KYC lives in a linked Vault PERSON entity via
required `vaultEntityId`; no KYC columns on Nominee), `AssetNomination` (≤4/asset), `ReleaseGrant`
(state machine: active→pinged→escalated→released|revoked), `EstateAccessLog`, **`DataKey`** (M4:
per-asset DEK wrapped per principal).
Amounts: minor-unit `BigInt` plaintext (for SQL aggregation/sort). Sensitive identifiers/notes: encrypted in
`Asset.dataEncrypted` under a **per-asset DEK** (M4 envelope) wrapped per principal in `DataKey` via
HKDF-derived KEKs over `VAULT_ENCRYPTION_KEY` — see `EstateEnvelopeService`. (Legacy single-master-key
blobs auto-migrate on read + boot backfill.)

## 4. API surface (all under global `/api` prefix; JwtAuthGuard unless noted)
- Assets: `GET/POST /estate/assets`, `POST /estate/assets/bulk`, `GET/PATCH/DELETE /estate/assets/:id`,
  `GET /estate/assets/:id/reveal`, `POST/GET /estate/assets/:id/valuations`.
- Net worth: `GET /estate/networth`, `GET /estate/networth/history`.
- Capability/types: `GET /estate/capability`, `GET /estate/asset-types`.
- Docs/extract: `GET/POST /estate/assets/:id/documents`, `GET .../:docId/url`, `DELETE .../:docId`,
  `POST .../:docId/extract`, `POST /estate/extract` (single), `POST /estate/extract-holdings` (CAS array),
  `POST /estate/import-files` (multi-file → one asset each + attach). All extract endpoints accept an
  optional `password` (form/body) for protected PDFs; PDFs are parsed text-first (vision only for scans).
- Nominees: `GET/POST /estate/nominees`, `PATCH/DELETE /estate/nominees/:id`,
  `GET /estate/nominees/:id/reveal` (unmasked KYC), `GET/PUT /estate/assets/:id/nominations`.
- Release: `GET /estate/release`, `POST /estate/checkin`, `PATCH /estate/release/:nomineeId`,
  `POST /estate/release/:nomineeId/revoke`.
- Report/nudges: `GET /estate/report`, `GET /estate/nudges`.
- Public: `GET /estate/nominee-access/:token` (no auth; 403 until grant released).
- Admin (`/admin/estate-vault`): `GET/PUT config`, `GET grants`, `POST grants/:id/release`.

## 5. RESUME — next tasks, in order (all internal; no 3rd-party)
1. ✅ **DONE (2026-06-18)** — **Admin config UI** at `/config/estate-vault`. api-client
   `adminGetConfig`/`adminUpdateConfig` (`/admin/estate-vault/config`) + `features/admin/estate/`
   (`queries.ts` + `EstateVaultConfigPage.tsx`: module/currency/cadence/threshold/toggle editor + inline
   asset-type catalog with stable-key locking + unique-key validation, whole-config PUT) + route in
   `app.tsx` + estate-gated nav item in `MainLayout.tsx`. Build + lint green; NOT runtime-tested.
2. ✅ **DONE (2026-06-18)** — **M4 app-managed envelope encryption**. Per-asset DEK (AES-256-GCM),
   wrapped per principal via HKDF-derived KEKs over `VAULT_ENCRYPTION_KEY` (`DataKey` model + migration
   `20260618120000_estate_data_keys`). `EstateEnvelopeService` owns write/revealOwner/revealNominee/
   syncNominations + boot `backfill()`; rotation on nominee removal; lazy legacy migration. Wired into
   asset/report/nominee services. NOT zero-knowledge (accepted v1; KMS later = swap `deriveKek`/wrap/unwrap,
   no schema change). Build+lint green; NOT runtime-tested.
3. **Estate Report as a rendered PDF** (NEXT) via the existing artboard / `@org/document-templates` +
   `DocumentExport` pipeline (currently a print-friendly HTML page). See `docs/13` §10.3.

**Deferred (user said skip 3rd-party):** DigiLocker ingestion; lawyer/physical-copy flows; live price feeds
for gold/property auto-valuation (mechanism can be config-rate-based later).

## 6. Verification checklist (the user's manual end pass)
- Toggle: `ESTATE_VAULT_ENABLED=false` ⇒ no `/estate/*` routes, nav hidden, tables intact; `=true` ⇒ visible.
- Assets: add → net worth updates → re-value → history shows → reveal identifier → soft-delete.
- CAS import: upload a statement → holdings list → import → assets created; re-import → updates not dupes.
- Docs: upload to an asset (with statement date) → version listed → download → delete.
- Nominee/release: add nominee → assign to asset → check-in → (admin) `POST grants/:id/release` →
  open `/n/<accessToken>` → scoped, revealed register + how-to-claim; revoke; non-released token → 403.
- Nudges: create an asset with no nominee/value → "Things to review" card shows it.

## 7. Key decisions & gates (don't lose these)
- **Strategy**: compete on TOTAL net worth incl. physical assets AA can't see; estate/legacy is the wedge,
  wealth view is a byproduct. Monetise via will-upsell (warm) + B2B2C + post-death claims, NOT a flat sub.
- **Legal**: nominee ≠ heir (SC *Sarbati Devi*, *Shakti Yezdani 2023*) → handover passes custody, not
  ownership; must pair with a will. How-to-claim text + nominee copy **need an Indian lawyer's review**.
- **UNVALIDATED gates (docs/13 Appendix D — resolve before scaling)**: (a) will people *manually maintain*
  a physical-asset register? (demand unproven); (b) legal review; (c) M4 KMS host choice (deferred — app-
  managed HKDF for now).
- **Conventions**: shared `@org/dto` Zod + `createZodDto`; `@org/ui` components only; i18n `t('key','English')`;
  list pages = DataTable + server paging + Select filters + ⋯ overflow; admin under `/config/*`.
- **Module deviations logged in BUILD_LOG**: routes static-imported (not lazy); forms use direct `useState`
  (not react-hook-form) to match existing vault pages; amounts plaintext (identifiers encrypted) pending M4.
