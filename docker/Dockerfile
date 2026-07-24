# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Multi-target build for the Vidhi monorepo (pnpm + Nx).
# One shared `base` stage installs + builds everything once; `api`, `web`,
# `app` and `artboard` are slim runtime images that copy only what they need.
#
# Build a single target with:  docker build -f docker/Dockerfile --target api .
# docker-compose builds all four via `build.target` (see docker-compose.yml).
# ─────────────────────────────────────────────────────────────────────────────

# ── base: install deps + build all apps ──────────────────────────────────────
FROM node:22-bookworm-slim AS base
WORKDIR /app

# Build toolchain for any native modules (sharp/swc/prisma engines have prebuilds,
# but node-gyp fallbacks need these). openssl is required by Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Frontend env is inlined at BUILD time (NEXT_PUBLIC_* / VITE_*), so it must be
# present before the build runs — passed in as build args from docker-compose.
ARG NEXT_PUBLIC_SITE_NAME=Vidhi
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG VITE_APP_NAME=Vidhi
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_WEB_URL
ARG VITE_ARTBOARD_URL
ARG VITE_RAZORPAY_KEY_ID
ENV NEXT_PUBLIC_SITE_NAME=$NEXT_PUBLIC_SITE_NAME \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
    NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_API_URL=$VITE_API_URL \
    VITE_APP_URL=$VITE_APP_URL \
    VITE_WEB_URL=$VITE_WEB_URL \
    VITE_ARTBOARD_URL=$VITE_ARTBOARD_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID

# Install with the lockfile (whole repo copied; node_modules/dist are dockerignored).
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Generate the Prisma client (schema path comes from package.json#prisma.schema)
# then build the four deployables.
RUN pnpm exec prisma generate
# Build serially (--parallel=1) and cap the Node heap: on a small VPS (≈4GB) that
# is also running the live stack, concurrent builds (webpack/tsc + Vite ×2 +
# Next) exhaust RAM and hang the host (OOM / swap thrash). One-at-a-time is
# slower but completes reliably. Bump these on a bigger build host if you have
# the RAM.
RUN NODE_ENV=production NODE_OPTIONS=--max-old-space-size=2048 \
    pnpm nx run-many -t build --projects=api,web,app,artboard --parallel=1

# api/app/artboard → dist/apps/* already. Next builds in-place to
# apps/web/.next (`next build --webpack`), so assemble a self-contained
# dist/apps/web that `next start dist/apps/web` can run — keeping all four
# deployables uniformly under dist/apps.
RUN mkdir -p dist/apps/web \
    && cp -r apps/web/.next dist/apps/web/.next \
    && cp -r apps/web/public dist/apps/web/public \
    && cp apps/web/next.config.js dist/apps/web/next.config.js

# ── api: NestJS server ───────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist/apps/api ./dist/apps/api
COPY --from=base /app/tools/prisma ./tools/prisma
COPY --from=base /app/package.json ./package.json
EXPOSE 5230
# Apply migrations, then start. `prisma migrate deploy` reads tools/prisma/schema.prisma
# via package.json#prisma.schema.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/apps/api/main.js"]

# ── web: Next.js (SSR — runs `next start`, not a static export) ───────────────
FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist/apps/web ./dist/apps/web
COPY --from=base /app/package.json ./package.json
EXPOSE 5220
CMD ["sh", "-c", "node_modules/.bin/next start dist/apps/web -p 5220 -H 0.0.0.0"]

# ── app: React/Vite SPA served as static files by nginx ──────────────────────
FROM nginx:1.27-alpine AS app
COPY --from=base /app/dist/apps/app /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# ── artboard: Vite SPA (PDF render target for stamp-paper-aware templates).
#    Server-side Puppeteer navigates here to print PDFs; same static-SPA
#    pattern as `app`. ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS artboard
COPY --from=base /app/dist/apps/artboard /usr/share/nginx/html
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# ── caddy: custom build with the Cloudflare DNS module, for DNS-01 ACME
#    challenges (works even while Cloudflare's proxy is on — HTTP-01/TLS-ALPN-01
#    need direct traffic to the origin, which a proxied DNS record blocks).
#    Independent build chain — no dependency on the node/pnpm stages above. ────
FROM caddy:2-builder-alpine AS caddy-builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare

FROM caddy:2-alpine AS caddy
COPY --from=caddy-builder /usr/bin/caddy /usr/bin/caddy
