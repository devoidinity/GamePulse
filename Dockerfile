# Backend image: builds @gamepulse/shared, api, and worker. The same image runs
# the API, the worker, and DB migrations (command is overridden per service).
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- build stage (dev deps included) ----
FROM base AS build
ENV NODE_ENV=development
# Copy every workspace manifest so npm can resolve the workspace graph.
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk-js/package.json packages/sdk-js/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm install --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/worker apps/worker

RUN npx prisma generate --schema packages/shared/prisma/schema.prisma \
  && npm run build -w @gamepulse/shared \
  && npm run build -w @gamepulse/api \
  && npm run build -w @gamepulse/worker

# ---- runtime stage ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/worker ./apps/worker

# Default to the API; docker-compose overrides for worker & migrate.
CMD ["node", "apps/api/dist/index.js"]
