# Dashboard image: Next.js standalone build.
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk-js/package.json packages/sdk-js/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm install --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/dashboard apps/dashboard
# NEXT_PUBLIC_* is inlined at build time; pass --build-arg to point elsewhere.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx prisma generate --schema packages/shared/prisma/schema.prisma \
  && npm run build -w @gamepulse/shared \
  && npm run build -w @gamepulse/dashboard

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Next standalone output mirrors the monorepo layout (outputFileTracingRoot).
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build /app/apps/dashboard/public ./apps/dashboard/public
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
