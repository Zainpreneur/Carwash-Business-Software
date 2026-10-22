# syntax=docker/dockerfile:1

# ---- Base: Node + pnpm -----------------------------------------------------
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_HOME=/opt/corepack
# Cache pnpm in the shared corepack home so the non-root runtime user can run
# `pnpm --filter @carwash/db db:migrate` without downloading anything.
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# ---- Dependencies (full monorepo, cached) ----------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile || pnpm install

# ---- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
# node_modules (incl. pnpm store + workspace symlinks) and package manifests
COPY --from=deps /app /app
# source
COPY packages ./packages
COPY apps/api ./apps/api

RUN mkdir -p /data && addgroup -S app && adduser -S app -G app && chown -R app:app /data
USER app
# Run from the API package so `--import tsx` resolves its local devDependency.
WORKDIR /app/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/health || exit 1

# tsx runs the TypeScript workspace directly (no separate package build step).
CMD ["node", "--import", "tsx", "src/server.ts"]