# Estate Multi-Profile + Sharing — RESUME (read this first)

> **UPDATE 2026-06-18 (b)**: frontend built (§4) **and the migration is now applied**
> (`20260618160000_estate_profiles` deployed via `pnpm prisma:migrate`, client regenerated).
> Re-verified after migrate: `@org/api` build green, `@org/app` build green, lint across
> `@org/api @org/app @org/dto @org/api-client` clean (0 errors). The **only** remaining step is
> the **browser walk** (§4.5) — owner is running it. Pairs with `docs/14-estate-vault-HANDOFF.md`
> (overall module) and `docs/BUILD_LOG.md`.

## 0. What this feature is
One account can manage **multiple person-vaults** (self, spouse, a wealth-manager's clients).
Each is an **`EstateProfile`** backed by a Vault PERSON entity. All estate data (assets,
nominees, net worth, snapshots, release grants, report) is scoped by **`profileId`**, not by the
acting user. A profile can be **shared** with other accounts (3rd-party wealth manager / the
original person) via `EstateProfileAccess`.

## 1. Migration — APPLIED ✅ (2026-06-18)
`20260618160000_estate_profiles` was deployed (`pnpm prisma:migrate` → "All migrations have been
successfully applied"; it was the only pending one — earlier estate migrations were already applied)
and the client regenerated (`pnpm prisma:generate`). It adds `EstateProfile` + `EstateProfileAccess`
tables and `profileId` columns on `Asset`, `Nominee`, `WealthSnapshot`, `ReleaseGrant`. (On a fresh
DB/clone, run those two commands; until applied, every `/estate/*` write 500s with "column profileId
does not exist".)

## 2. Verify the checkpoint builds (do this first on resume)
```bash
pnpm nx build @org/api      # was GREEN at checkpoint (webpack compiled)
pnpm nx build @org/app      # NOT re-verified after the last 2 edits — run it
pnpm nx run-many -t lint -p @org/api @org/app @org/dto @org/api-client
```
The last two edits were `apps/app/src/main.tsx` (added `installEstateProfileParam(http)` + its
import). If the app build fails, that import/usage is the only suspect — everything else compiled.

## 3. DONE — backend (complete, compiles)
- **Schema** (`tools/prisma/schema.prisma`): `EstateProfile {id, ownerUserId, vaultEntityId, label,
  isSelf}`, `EstateProfileAccess {profileId, userId, role}` (FK→profile, cascade), and `profileId?`
  on `Asset` / `Nominee` / `WealthSnapshot` / `ReleaseGrant` (+ indexes). Migration
  `20260618160000_estate_profiles`.
- **`EstateProfileService`** (`services/estate-profile.service.ts`): `ensureSelf` (auto-creates the
  creator's self profile + a Vault person, then **backfills** their `profileId=null` rows onto it),
  `resolve(userId, profileId?)` (authorises: owner or shared-access; defaults to self), `list`
  (owned + shared), `create` (link/mint a Vault person), `remove` (blocks self + non-empty),
  `share`/`unshare`/`listAccess` (by email → `EstateProfileAccess`).
- **All estate services rescoped from `userId` → `profileId`**, taking a `ResolvedProfile`:
  `asset.service`, `nominee.service`, `release.service` (grants carry `profileId`; `ensureGrant`/
  `checkIn`/`updatePlan`/`revoke`/`listGrants` profile-scoped), `estate-report.service`
  (owner report by profile; nominee view by `grant.profileId`), `gap.service`,
  `estate-report-pdf.service`, and `asset-document.service.importFiles`. **Envelope owner principal
  is always `profile.ownerUserId`** (so a shared manager resolves the same DEKs).
- **Controllers**: `EstateController` resolves `@Query('profileId')` (default self) on every data
  endpoint and added **`/estate/profiles`** CRUD + `/estate/profiles/:id/{access,share,access/:userId}`.
  `EstateDocumentController.importFiles` resolves profile too. DTOs `CreateEstateProfileDto` /
  `ShareEstateProfileDto` (schemas in `@org/dto` estate.schema.ts). `EstateProfileService` registered
  in the module (which already imports `VaultModule`).
- **api-client**: `EstateProfile` + payload/access types; `listProfiles`/`createProfile`/
  `removeProfile`/`listProfileAccess`/`shareProfile`/`unshareProfile`. Plus a shared
  **`estate-context.ts`**: `setActiveEstateProfileId` / `getActiveEstateProfileId` /
  `installEstateProfileParam(http)` — an axios request interceptor that injects `?profileId` on
  profile-scoped `/estate/*` calls (skips `/estate/profiles*` + `/estate/nominee-access*`).
- **main.tsx**: calls `installEstateProfileParam(http)` (last edit — verify build).

## 4. DONE — frontend (built 2026-06-18; builds green, lint clean)
All four pieces below are implemented exactly as planned. Files:

1. **Active-profile context** — `features/estate/profile-context.tsx`:
   `EstateProfileProvider` + `useActiveProfile()`. `useEstateProfiles()` →
   `svc.listProfiles()`; holds `activeProfileId` (localStorage key
   `estate.activeProfileId`), seeds `setActiveEstateProfileId` synchronously on mount,
   defaults to `isSelf` once loaded, falls back if the stored id is stale. On switch:
   `setActiveEstateProfileId(id)` + `qc.removeQueries({ queryKey: ['estate'] })`.
2. **EstateLayout route wrapper** — `features/estate/EstateLayout.tsx`: mounts the
   provider + a switcher bar (`Select` of profiles w/ You/role badges + "Manage profiles"
   link) above `<Outlet/>`. Wired in `app.tsx` as `<Route element={<EstateLayout/>}>`
   around all in-app `/estate/*` routes (`/n/:token` stays outside).
3. **Profiles management page** — `features/estate/pages/EstateProfilesPage.tsx`
   (`/estate/profiles`): list (label + self/role badge), add (New-person / Link-Vault-
   person toggle), delete (owner non-self only), inline **Share panel** per owned profile
   (list access + add by email/role + unshare). Nav item "Profiles" added under the
   Wealth Vault submenu in `MainLayout.tsx`.
4. **Queries** — `features/estate/queries.ts`: profile hooks under a **distinct
   `['estate-profiles']` key prefix** (survives `removeQueries(['estate'])`):
   `useEstateProfiles`, `useCreateProfile`, `useRemoveProfile`, `useProfileAccess`,
   `useShareProfile`, `useUnshareProfile`. Data hooks unchanged (interceptor injects
   `profileId`).

### 4.5 STILL TODO — runtime verification (nothing runtime-tested yet)
Apply the migration (§1), then a browser walk: create a 2nd profile (spouse), switch,
add an asset, confirm net worth/assets/report are scoped to it; share with another
account's email, log in as that account → the profile appears in the switcher with role
`manager`/`viewer`; confirm a shared manager resolves the same encrypted asset data
(envelope owner = `profile.ownerUserId`, §5).

## 5. Design notes / gotchas
- **Envelope owner = profile.ownerUserId** everywhere (not the acting user) — so shared managers
  read the same per-asset DEKs. Don't "fix" this to the acting user.
- Nominee/asset **Vault entities are created under `profile.ownerUserId`**, not the acting user.
- `ReleaseGrant` keeps `@@unique([ownerUserId, nomineeId])`; grants are still 1-per-nominee, and a
  nominee belongs to exactly one profile, so this holds. `requireGrant` now scopes by `profileId`.
- Legacy rows (`profileId=null`) are migrated to self on first `ensureSelf`. `estate-report`
  nominee view falls back to `ownerUserId` when `grant.profileId` is null (pre-migration grants).
- The interceptor sends `profileId` even on global endpoints (capability/asset-types) — harmless,
  those controllers ignore it.

## 6. Files touched in this checkpoint
API: `estate-vault/services/{estate-profile,asset,nominee,release,estate-report,gap,estate-report-pdf,
asset-document}.service.ts`, `estate-vault/controllers/{estate,estate-document}.controller.ts`,
`estate-vault/dto/estate.dto.ts`, `estate-vault/estate-vault.module.ts`,
`common/headless-browser.service.ts` (earlier). Schema + migration `20260618160000_estate_profiles`.
DTO: `libs/shared/dto/.../estate/estate.schema.ts` (profile schemas). api-client:
`estate.service.ts`, `estate-context.ts`, `index.ts`. App: `main.tsx`.
