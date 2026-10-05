# syntax=docker/dockerfile:1

# ---- base: Node + pnpm (version pinned by package.json "packageManager") ----
FROM node:24-alpine AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

# ---- deps: all dependencies, needed to build ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts: skips the husky "prepare" hook (no .git in the image)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --store-dir=/pnpm/store

# ---- prod-deps: production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir=/pnpm/store

# ---- build: compile TypeScript to dist/ ----
FROM deps AS build
COPY . .
RUN pnpm build

# ---- runtime: minimal image that runs the app ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node migrations ./migrations

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health" > /dev/null || exit 1

# Run node directly (not via pnpm) so it receives SIGTERM for graceful shutdown.
CMD ["node", "dist/main.js"]
