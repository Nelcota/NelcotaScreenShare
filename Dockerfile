# syntax=docker/dockerfile:1.7
FROM node:26.11.1-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN apk add --no-cache libc6-compat && npm install --global --allow-scripts=pnpm pnpm@12.9.1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm install --frozen-lockfile

FROM base AS production-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && pnpm install --prod --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm build:scripts

FROM node:26.11.1-alpine AS runner
WORKDIR /app
RUN apk add --no-cache curl && \
    addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nelcota
COPY --from=production-deps --chown=nelcota:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nelcota:nodejs /app/package.json ./package.json
COPY --from=build --chown=nelcota:nodejs /app/build ./build
COPY --from=build --chown=nelcota:nodejs /app/dist/migrate.mjs ./migrate.mjs
COPY --from=build --chown=nelcota:nodejs /app/dist/create-owner.mjs ./create-owner.mjs
COPY --from=build --chown=nelcota:nodejs /app/drizzle ./drizzle
# Keep changing release metadata after the filesystem layers so they can reuse cache.
ARG APP_VERSION=dev
ARG PUBLIC_SENTRY_DSN=
ENV NODE_ENV=production APP_VERSION=$APP_VERSION PUBLIC_SENTRY_DSN=$PUBLIC_SENTRY_DSN \
    PORT=3000 HOST=0.0.0.0
USER nelcota
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "build/server/index.js"]
