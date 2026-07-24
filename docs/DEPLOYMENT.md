# Deployment — Vidhi (single VPS + Docker + Caddy)

Production runs as Docker containers on one VPS, behind Caddy (automatic HTTPS).
Public subdomains, one shared auth cookie. Domain used throughout this doc:
`doclio.in` — change the single `DOMAIN` value in `.env` to deploy under a
different domain; nothing else needs editing except the URLs derived from it.

| Subdomain               | Service    | What it is                                                            |
| ------------------------ | ---------- | ---------------------------------------------------------------------- |
| `doclio.in` (+ `www` → apex) | `web`      | Next.js marketing site (SSR, SEO) — no auth of its own, see below     |
| `app.doclio.in`          | `app`      | React SPA — the entire authenticated product (dashboard, builder, editor, vault, settings, admin config) |
| `api.doclio.in`          | `api`      | NestJS API (sets `.doclio.in` cookies)                                |
| `art.doclio.in`          | `artboard` | Stamp-paper-aware PDF render target (embedded iframe + Puppeteer target) |
| `storage.doclio.in`      | `minio`    | S3-compatible object storage — public reads for uploads/renders; the S3 API/console ports stay internal-only |

Internal only (no public ports): `postgres`, `redis`, `chrome` (PDF rendering).

## Why subdomains (not one root domain)

Login is a **shared cookie** across `*.doclio.in`: the API sets `access_token`
with `COOKIE_DOMAIN=.doclio.in`, and it's valid on every subdomain. The
marketing site (`apps/web`) never hosts its own auth — every "Sign in" /
"Start drafting free" / "Go to dashboard" CTA deep-links straight to
`app.doclio.in` (`apps/web/src/lib/app-href.ts`), and the whole authenticated
product (auth, dashboard, documents, vault, settings, and the admin `/config/*`
screens) lives in the React SPA. That split — and the shared cookie making it
invisible to the user — only works when everything shares the parent domain. A
single root domain would need a path-routing proxy (`/app`, `/api`) and a Vite
base path, for no benefit here.

## 1. Prerequisites

- A VPS (≈2 vCPU / 4 GB RAM is comfortable; 2 GB minimum) running Docker Engine +
  the Compose plugin. Ubuntu 22.04/24.04 is fine.
- Ports **80** and **443** open to the internet.
- The domain, with DNS **A records** (and AAAA if you have IPv6) pointing at the
  VPS IP:

  ```
  doclio.in         A   <VPS_IP>
  www.doclio.in     A   <VPS_IP>
  app.doclio.in     A   <VPS_IP>
  api.doclio.in     A   <VPS_IP>
  art.doclio.in     A   <VPS_IP>
  storage.doclio.in A   <VPS_IP>
  ```

  Caddy provisions Let's Encrypt certs automatically once these resolve.

### Cloudflare: DNS-01 certs (safe to proxy every subdomain)

Caddy is built with the `caddy-dns/cloudflare` module and issues/renews certs via
a **DNS-01** challenge instead of the default HTTP-01/TLS-ALPN-01. This matters
because those default challenges need Cloudflare's proxy (orange cloud) to let
live traffic straight through to the origin during issuance — a **Proxied**
record blocks them (Cloudflare Error 525). DNS-01 instead proves ownership by
creating a short-lived TXT record via the Cloudflare API, so it works the same
whether a subdomain is Proxied or DNS-only. **Every `*.doclio.in` record can
stay Proxied** (CDN, DDoS protection, caching) with no cert risk.

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** → use the
   **"Edit zone DNS"** template, scoped to the `doclio.in` zone only (not the
   account-wide Global API Key).
2. Set `CLOUDFLARE_API_TOKEN` in `.env` to that token.

Not using Cloudflare? Delete the `acme_dns cloudflare {$CLOUDFLARE_API_TOKEN}`
line in `docker/Caddyfile` — Caddy falls back to HTTP-01, which needs each
subdomain to be DNS-only (grey cloud) while the cert is first issued.

## 2. First deploy

```bash
git clone <your-repo-url> && cd DocumentIntelligence
cp .env.production.example .env
# Edit .env: fill every CHANGE_ME, generate secrets, add at least one AI
# provider key (ANTHROPIC_API_KEY recommended — see docs/03-technical-design.md).
docker compose --env-file .env up -d --build
```

The first build compiles all four apps (`api`, `web`, `app`, `artboard`) —
expect 5–15 minutes depending on the VPS. `docker compose logs -f api` to
watch the API come up; `prisma migrate deploy` runs automatically as part of
its start command.

### Bootstrap the first admin

`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` control a one-time idempotent seed
(`tools/prisma/seed.ts`) that creates (or promotes) that account to
`role: admin`. Without it there is **no way** to reach `/config/*` in a fresh
deployment — every admin surface (API `RolesGuard`, the SPA's `AdminRoute`)
requires the role, and there's no other bootstrap path.

```bash
docker compose --env-file .env exec api node_modules/.bin/prisma db seed
```

Re-running the seed is safe — every step (plans, document types, citations,
the admin account) is an upsert.

## 3. Updating

```bash
git pull
docker compose --env-file .env up -d --build
```

Compose rebuilds only images whose inputs changed. Migrations run again on
`api` startup (`prisma migrate deploy` is a no-op if nothing's pending).

## 4. Configuration reference

All production values live in `.env` (`.env.production.example` documents
every key). A few worth calling out beyond the obvious secrets:

- **`DOMAIN`** — the one value that drives `docker/Caddyfile`'s subdomain
  routing. Everything else in `.env` (the `*_URL` vars) still needs to be
  edited to match if you change it — they aren't derived automatically.
- **`ESTATE_VAULT_ENABLED`** — the Wealth & Estate Vault module (docs/13) is a
  toggleable, config-as-data feature. `false` mounts no controllers/scheduler
  and hides its nav entry; existing data is never dropped, so it's safe to
  flip either direction.
- **`BILLING_ENFORCED`** — set `false` while validating pricing tiers to let
  every request through regardless of `WalletUsage` state.
- **`WEBAUTHN_RP_ID`/`WEBAUTHN_ORIGIN`** — only needed if passkeys should work
  across a domain `FRONTEND_URL` (`app.doclio.in`) doesn't cover. Left unset,
  they're derived from `FRONTEND_URL` — correct for the default topology.
- **At least one AI provider key is required** (`ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` / `GEMINI_API_KEY`) to enable `/ai`, `/legal-ai` (the AI
  drafting copilot, citation critique) and `/intelligence` (document
  extraction). None set → those routes 4xx, everything else still works.
- **Storage** defaults to the bundled MinIO container. Point `STORAGE_ENDPOINT`
  at a managed S3/R2/Spaces bucket instead if you'd rather not self-host it —
  drop the `minio`/`minio-init` services from `docker-compose.yml` in that case.

## 5. Backups

- **Postgres**: `docker compose exec postgres pg_dump -U postgres vidhi | gzip > backup-$(date +%F).sql.gz`
  — automate via cron; store off the VPS.
- **MinIO / uploads**: the `miniodata` volume holds every uploaded/rendered
  file. Snapshot it the same way, or point `STORAGE_ENDPOINT` at a managed
  bucket with its own versioning/replication instead.
- **Caddy** certs live in the `caddy_data` volume — losing it just means a
  fresh Let's Encrypt issuance on next boot (DNS-01 has no rate-limit
  surprises worth worrying about here), not an outage.
