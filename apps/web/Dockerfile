# The site on the VPS (docs/adr/0009-vps-scaleway.md), built from the monorepo root:
#   docker build -f apps/web/Dockerfile --target web .    the site (Next.js standalone)
#   docker build -f apps/web/Dockerfile --target tools .  migrations and the hourly ingest (deploy/ingest.sh)
# The build prerenders pages from a database: pass DATABASE_URL and --network host (an empty database is enough, the
# deployment asks the site to rebuild its pages once started).

FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# The site's dependencies only (not the extension's), then the sources.
FROM base AS source
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/crypto/package.json packages/crypto/
COPY packages/game/package.json packages/game/
COPY packages/map/package.json packages/map/
COPY apps/web/prisma apps/web/prisma
COPY apps/web/prisma.config.ts apps/web/
RUN pnpm install --frozen-lockfile --filter "@optizzz/web..."
COPY packages packages
COPY apps/web apps/web

FROM source AS tools
WORKDIR /repo/apps/web

FROM source AS build
ARG DATABASE_URL
ARG NEXT_PUBLIC_ADSENSE_CLIENT
ARG NEXT_PUBLIC_ADSENSE_SLOT
# The server's secrets come at start (deploy/compose.yml); only the public ones are inlined at build.
ENV SKIP_ENV_VALIDATION=1 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    BETTER_AUTH_URL=https://optizzz.fr \
    DATABASE_URL=$DATABASE_URL \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT \
    NEXT_PUBLIC_ADSENSE_SLOT=$NEXT_PUBLIC_ADSENSE_SLOT
RUN pnpm --filter @optizzz/web build

FROM node:24-alpine AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
