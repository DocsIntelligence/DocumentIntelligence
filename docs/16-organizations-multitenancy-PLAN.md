# Plan: Organizations & multi-tenancy — from modeled to live

> Status: PLAN — not implemented. `Organisation`/`OrgMember`/`OrgRole`/`OrgType` are real, migrated
> Prisma models with **zero business logic behind them** (confirmed by full-repo audit, 2026-07-23):
> no controller, no invite flow, no org-scoped billing despite the "Agency ₹2,499/mo + seats"
> pricing row in `docs/02-product-roadmap.md`. This plan takes it from schema-only to a real,
> self-serve feature, phased so each phase ships and is useful on its own — same rule as
> `docs/13-wealth-estate-vault-PLAN.md`.

---

## 0. What already exists vs. what's missing (the audit, so this plan doesn't re-derive it)

**Exists (schema + scattered plumbing):**

- `Organisation` (`id, name, slug, type: OrgType, brandingId`), `OrgMember` (`orgId, userId,
  role: OrgRole @@unique([orgId, userId])`), `OrgRole {owner admin member}`, `OrgType {agency
  law_firm individual_lawyer}` — `tools/prisma/schema.prisma`.
- `BrandingProfile` (`ownerUserId, logoS3Key, letterheadS3Key, primaryColor, footerText,
  barCouncilNumber`) — 1:1 with `Organisation` via `brandingId`. `barCouncilNumber` is a bare
  nullable string; **zero code reads or writes it today**.
- **Config-as-data, org-scoped-override plumbing already works**: `settings`, `vault-admin`,
  `estate-admin`, `search-admin` all accept `?orgId=` and resolve system-default-vs-org-override
  correctly (`settings.service.ts`'s scope chain, `vault-config.service.ts`, etc.). This is the
  *mechanism* Phase 2 below reuses — it does not need to be built, only **authorized properly**.
- `Document`, `DocumentTemplate`, `DocumentGroup`, and several intelligence models carry a
  nullable `ownerOrgId` — the column exists on the row, nothing populates or filters by it from
  the UI yet.
- `assertOrgMember(userId, orgId)` — one narrow, private helper in
  `apps/api/src/app/intelligence/batch.service.ts` / `intelligence.service.ts`, used only for
  intelligence batch scoping. Not a general authorization primitive.

**Missing (why this is a real project, not a bolt-on):**

- No org CRUD, no invite flow, no member management, no "which org am I acting as" concept
  anywhere in `apps/app`.
- No `OrgRolesGuard` — the only role guard is platform-wide `RolesGuard`/`@Roles('admin')`
  (just wired up repo-wide this week, see `docs/BUILD_LOG.md`). Today, the `?orgId=` config
  endpoints are reachable **only by a platform admin** — an org's own owner/admin has no way to
  self-serve manage their org's config. That's the actual gap Phase 2 closes.
- **Billing is entirely per-user.** `UserWallet.userId String @unique` — one wallet per user, no
  org-level wallet/subscription/seat count anywhere. The "Agency ₹2,499/mo + seats" pricing row
  is copy with nothing behind it.
- No advocate-verification workflow (`docs/02-product-roadmap.md` and `docs/TASKS.md` both list
  it unchecked) — `BrandingProfile.barCouncilNumber` is captured nowhere and reviewed by no one.

---

## 1. Load-bearing decisions (made here so later phases don't re-litigate them)

1. **Two separate role systems, on purpose.** Platform `Role {user admin}` (just re-secured, see
   `docs/16`'s sibling work this week) stays the "runs the whole platform" role. `OrgRole {owner
   admin member}` is scoped to one `Organisation` via `OrgMember` and never implies platform
   admin. A platform admin can still reach any org's config (super-user override); an org
   owner/admin can only reach their own org's. **Confidence: high** — this mirrors the exact
   split GathBandhan (`Matrimonial/`) and most B2B SaaS use, and the schema already models it
   this way (`Role` on `User`, `OrgRole` on `OrgMember`).
2. **A user can belong to more than one org.** `OrgMember` has no constraint preventing it
   (`@@unique([orgId, userId])` only blocks a duplicate row in the *same* org). The frontend needs
   an explicit "acting as" switch (Decision 3), not an assumption of exactly one org per user —
   useful for the advocate-manages-multiple-client-orgs case the Agency tier implies.
3. **"Acting as an org" is a client-side selection, not a server session concept** — same
   reasoning as `apps/app`'s existing estate multi-profile switcher
   (`docs/15-estate-multiprofile-RESUME.md`): the selected `orgId` rides along as an explicit
   param on writes (`?orgId=`, or a body field), never inferred from hidden server state. Simpler
   to reason about, and reuses the exact `?orgId=` plumbing already wired into every config
   endpoint.
4. **Org billing is a parallel `OrgWallet`, not an extension of `UserWallet`.** Making
   `UserWallet.userId` nullable and adding `orgId` would ripple through every existing
   per-user billing query (`WalletUsage`, quota-check middleware, Razorpay/Stripe webhook
   handlers) for a feature (org billing) that's additive, not a replacement. A parallel
   `OrgWallet`/`OrgWalletUsage` (identical shape) keeps the blast radius to "new code path,"
   not "touch every existing billing read." **Confidence: high**, same reasoning as the
   estate-vault module choosing a fully separate table prefix over overloading existing models.
5. **Invite tokens reuse the existing pattern**, not a new library: `Secrets.resetToken` /
   `verificationToken` already do "random token + expiry + one-time consume" for password reset
   and email verification. `OrgInvite` copies that shape exactly.

---

## 2. Schema additions (one migration per phase, additive only — no existing table altered
##    except adding nullable columns)

```prisma
model Organisation {
  // ...existing fields...
  seatLimit Int?            // null = unlimited (platform-admin-set orgs, or pre-Agency-tier orgs)
  invites   OrgInvite[]
  wallet    OrgWallet?
}

model OrgInvite {
  id        String    @id @default(cuid())
  orgId     String
  email     String
  role      OrgRole   @default(member)
  token     String    @unique
  invitedByUserId String
  expiresAt DateTime
  acceptedAt DateTime?
  createdAt DateTime  @default(now())

  org Organisation @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([email])
}

model OrgWallet {
  id          String      @id @default(cuid())
  orgId       String      @unique
  paymentType PaymentType @default(one_time)
  active      Boolean     @default(false)
  startAt     DateTime
  endAt       DateTime
  planId      String
  paymentId   String?

  org     Organisation  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  plan    Plan          @relation(fields: [planId], references: [id])
  payment Payment?      @relation(fields: [paymentId], references: [id])
  usage   OrgWalletUsage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model OrgWalletUsage {
  id           String @id @default(cuid())
  name         Feature
  quantity     Int    @default(0) // -1 = unlimited
  consumed     Int    @default(0)
  orgWalletId  String
  orgWallet    OrgWallet @relation(fields: [orgWalletId], references: [id], onDelete: Cascade)
  @@unique([name, orgWalletId])
}

// BrandingProfile gets a review-status pair (Phase 4):
model BrandingProfile {
  // ...existing fields...
  verificationStatus   VerificationStatus @default(unverified)
  verificationNote     String?            // admin's reviewer note (approval/rejection reason)
  verifiedAt           DateTime?
  verifiedByUserId     String?
}

enum VerificationStatus {
  unverified
  pending
  verified
  rejected
}
```

`Plan.wallets` gains a symmetrical `orgWallets OrgWallet[]` back-relation; `Payment.orgWallet`
symmetrical back-relation. No column is removed or made non-nullable on an existing table, so
every migration in this plan is a pure additive `ALTER TABLE ... ADD COLUMN` / `CREATE TABLE` —
safe to run against a live production DB with zero downtime.

---

## 3. Backend

### 3.1 `OrgRolesGuard` + `@OrgRoles()` — the new authorization primitive

Mirrors `RolesGuard`/`@Roles()` exactly (`apps/api/src/app/auth/guards/roles.guard.ts` /
`decorators/roles.decorator.ts`) but resolves membership instead of reading `user.role`:

```ts
// apps/api/src/app/auth/guards/org-roles.guard.ts
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private db: DatabaseService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ORG_ROLES_KEY, [...]);
    if (!required?.length) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as User;
    const orgId = req.query.orgId ?? req.body?.orgId ?? req.params?.orgId;
    if (!orgId) throw new BadRequestException('orgId required');
    const membership = await this.db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: user.id } } });
    if (!membership || !required.includes(membership.role)) throw new ForbiddenException();
    req.orgMembership = membership; // downstream handlers can read this instead of re-querying
    return true;
  }
}
```

### 3.2 `PlatformOrOrgAdminGuard` — the composition Phase 2 actually applies

Nest's default multi-guard behavior is **AND** (every guard must pass). The config endpoints need
**OR**: platform admin, *or* org owner/admin of the `orgId` in the request. One small guard that
tries platform role first, falls back to org membership:

```ts
@Injectable()
export class PlatformOrOrgAdminGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role === 'admin') return true;
    const orgId = req.query.orgId ?? req.body?.orgId;
    if (!orgId) return false; // no orgId + not platform admin → only system-scope config is off-limits
    const membership = await this.db.orgMember.findUnique({ where: { orgId_userId: { orgId, userId: req.user.id } } });
    return membership?.role === 'owner' || membership?.role === 'admin';
  }
}
```

Applied as a straight swap for the current `@Roles('admin')` on: `settings.controller.ts`,
`vault-admin.controller.ts`, `estate-admin.controller.ts`, `search.controller.ts`
(`SearchAdminController`). **Not** applied to platform-only surfaces (`admin.controller.ts`,
`users.controller.ts`, `intelligence-admin.controller.ts`'s pipeline/schema authoring, the
`legal-ai.controller.ts` citation library) — those stay platform-admin-only; an org doesn't own
the citation catalog or the pipeline registry, it only owns its own settings/vault-field/estate
overrides.

### 3.3 `OrganizationsModule` (new, self-contained — same shape as `EstateVaultModule`)

`apps/api/src/app/organizations/`:

- `POST /orgs` — create an org (any authenticated user; creator becomes `OrgMember{role:owner}`
  in the same transaction).
- `GET /orgs/mine` — orgs the current user belongs to, with their role in each.
- `GET /orgs/:id` — org detail (any member).
- `PATCH /orgs/:id` — update name/type (`@OrgRoles('owner')`).
- `GET /orgs/:id/members`, `PATCH /orgs/:id/members/:userId` (change role), `DELETE
  /orgs/:id/members/:userId` (remove — an owner can't remove themself if they're the last owner;
  guard against zero-owner orgs) — all `@OrgRoles('owner','admin')`, role-change to/from `owner`
  restricted to existing owners.
- `POST /orgs/:id/invites` (`@OrgRoles('owner','admin')`) — creates `OrgInvite`, emails via
  existing `MailService` (new `orgInviteTemplate`, same `baseTemplate` pattern as
  `enterprise-lead.template.ts` added this week).
- `POST /orgs/invites/:token/accept` (`@Public()`, requires the *accepting* user to be logged in —
  same "public route, but still needs a session" shape as `documents.controller.ts`'s
  render-payload token check) — creates the `OrgMember` row, marks `acceptedAt`.
- `DELETE /orgs/:id/invites/:inviteId` (revoke a pending invite) — `@OrgRoles('owner','admin')`.

Seat enforcement: `POST /orgs/:id/invites` checks `org.seatLimit` against
`count(OrgMember) + count(pending OrgInvite)` before creating — reject with a clear "upgrade your
plan" error, not a silent no-op.

### 3.4 Billing service extensions

`payment.service.ts` (or wherever checkout is orchestrated today) gains a `target: 'user' |
'org'` discriminator on the existing Razorpay/Stripe checkout-session creation, writing to
`OrgWallet` instead of `UserWallet` when `target === 'org'` and `orgId` is present + the caller is
an org owner. Quota-check middleware (wherever `WalletUsage` is currently consulted per-request)
gains an org-aware variant: when a request carries an active `orgId` context AND the resource
being created/consumed will be `ownerOrgId`-tagged, decrement `OrgWalletUsage` instead of the
personal `WalletUsage`. **This is the highest-uncertainty piece of the whole plan** — needs a
read of the current quota-enforcement code path before Phase 3 starts (flagged as an open
question, §5).

---

## 4. Frontend (`apps/app`)

- **Org context**: a small Redux slice (`activeOrgId: string | null`), persisted to
  `localStorage`, exposed via `useActiveOrg()` — same shape as the estate multi-profile switcher
  (`docs/15`). `null` = "acting as myself," matching today's behavior with zero migration needed
  for existing users.
- **Org switcher**: a dropdown in `MainLayout`'s sidebar header (next to the user avatar) —
  "Personal" + each org the user belongs to (from `GET /orgs/mine`). Only rendered when
  `orgs.mine.length > 0` — invisible/no-op for the overwhelming majority of users who aren't in
  any org, exactly like the "Configuration" nav group is now invisible to non-admins.
- **`/org/settings`** (members, seats, plan, branding) — reachable by any `OrgMember`, mutating
  actions gated client-side by the member's `OrgRole` (matching how `AdminRoute` gates
  `/config/*` today) *and* server-enforced by `OrgRolesGuard` regardless of what the client
  hides.
- **Invite acceptance**: a public `/org/invites/:token` route (mirrors `/n/:token` nominee-access
  pattern already in `app.tsx`) — shows the org name + role being offered, requires sign-in/
  registration first if not authenticated (carry the token through via `?redirect=`, the same
  param `appHref()` already threads through login/register in `apps/web`).
- **Existing `/config/*` admin pages**: each gains an org-scope toggle when `activeOrgId` is set —
  same UI, just appends `?orgId=` to the same fetches those pages already make. No new screens
  needed here, just wiring the existing `?orgId=` param through from the switcher instead of
  hardcoding system-scope.
- **Document/group creation**: when `activeOrgId` is set, new documents/groups/templates get
  `ownerOrgId` set instead of `ownerUserId`-only; list views (`DocumentsList`, `GroupsPage`)
  filter by "mine OR my active org's" instead of just "mine."

---

## 5. Open questions (decide before/while building — flagged, not blocking the plan itself)

1. **Where exactly does quota enforcement currently read `WalletUsage`?** (interceptor? guard?
   service-level check inline in `documents.service.ts`?) Confidence this needs a dedicated read
   before Phase 3: **high** — billing is the part of this plan most likely to have a
   non-obvious existing shape that org-awareness has to slot into cleanly rather than duplicate.
2. **Razorpay/Stripe checkout metadata** — does the existing webhook handler have room to carry an
   `orgId` through the payment-gateway round-trip (metadata field), or does that need a schema
   look first? Needed for Phase 3's org-targeted checkout.
3. **Agency commission** (`docs/02-product-roadmap.md`'s "advocate/agency manages a client's
   account, earns a %") is explicitly Phase 5/later here — it's a genuinely separate feature
   (a *managed-client* relationship, not an org*-membership* relationship) and shouldn't block
   shipping Phases 0–4.
4. **Does a solo "individual_lawyer" `OrgType` need an org at all**, or is that tier better served
   by the existing per-user Advocate plan (no org overhead)? Recommendation: leave
   `individual_lawyer` as a real `OrgType` for branding/verification purposes only (so
   `BrandingProfile`/verification reuses the same path), but don't force seat/invite UI on a
   1-person "org." Confirm with product before Phase 4.

---

## 6. Phasing (each phase independently shippable, per the estate-vault plan's own rule)

| Phase | Ships                                                                                   | Est.     |
| ----- | ---------------------------------------------------------------------------------------- | -------- |
| **0** | `OrgRolesGuard` + `OrganizationsModule` CRUD (`POST /orgs`, `GET /orgs/mine`, `GET /orgs/:id`, `PATCH /orgs/:id`). No UI yet beyond a debug/admin view. Nothing else in the platform changes. | 2–3 days |
| **1** | Invites: `OrgInvite` model + email + accept flow, member list/role-change/remove, seat-limit check. Frontend: org switcher, `/org/settings`, `/org/invites/:token`. | ~1 week  |
| **2** | `PlatformOrOrgAdminGuard` swapped onto `settings`/`vault-admin`/`estate-admin`/`search-admin`. Org owners/admins can now self-serve their own config without needing platform-admin. | ~1 week  |
| **3** | `OrgWallet`/`OrgWalletUsage`, org-targeted checkout, quota enforcement made org-aware, documents/groups/templates taggable with `ownerOrgId` from the UI. | ~1.5 weeks |
| **4** | `BrandingProfile` verification workflow (admin review queue, `verificationStatus`), branded export gated on `verified`. | 3–5 days |
| **5** | Agency commission tracking, managed-client accounts, org-scoped analytics/search — roadmap-driven, not scoped in detail here. | later    |

Phases 0–2 alone (roughly 2–2.5 weeks) already deliver the concrete, immediately valuable outcome:
**an org owner can invite teammates and manage their own org's settings without needing a
platform-admin account** — the core "Agency"/"law firm" pitch, without yet touching billing.
Phase 3 (billing) is deliberately separable because it's the highest-risk, most-uncertain piece
(§5, open question 1) and shouldn't block 0–2 from shipping and being used.
