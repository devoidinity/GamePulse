# Contributing to GamePulse

Thanks for your interest in improving GamePulse! This guide covers the dev setup,
conventions, and how to get a change merged.

## Development setup

Requirements: Node.js ≥ 24, npm ≥ 9, Docker (for Postgres + Redis).

```bash
git clone <your-fork>
cd gamepulse
npm install
cp .env.example .env
docker compose up -d postgres redis

export DATABASE_URL=postgresql://gamepulse:gamepulse@localhost:5432/gamepulse
npm run db:deploy        # apply migrations
npm run db:seed          # optional demo data

npm run dev -w @gamepulse/api
npm run dev -w @gamepulse/worker
npm run dev -w @gamepulse/dashboard
```

## Repository layout

| Path | What |
| ---- | ---- |
| `apps/api` | Fastify API (auth, ingestion, analytics, OpenAPI) |
| `apps/worker` | BullMQ consumers + nightly balance analyzer |
| `apps/dashboard` | Next.js dashboard |
| `packages/shared` | Prisma schema/client, Zod contracts, enums, env |
| `packages/sdk-js` | Browser + Node telemetry SDK |

## Before you open a PR

Run these from the repo root and make sure they pass:

```bash
npm run typecheck --workspaces --if-present
npm test --workspaces --if-present
```

For changes that touch query or ingestion behavior, run the integration suite
against a live stack:

```bash
docker compose up -d postgres redis
npm run db:deploy
RUN_INTEGRATION=1 npm test -w @gamepulse/api
```

## Conventions

- **TypeScript strict** everywhere; no `any` without a justifying comment.
- **The wire contract lives once** in `@gamepulse/shared` (Zod). If you change an
  ingestion or analytics shape, update it there so the API, OpenAPI, and SDK stay
  in sync.
- **Layering:** routes (HTTP) → services (domain logic) → Prisma. Keep SQL/Prisma
  out of route handlers.
- **Database changes** go through Prisma migrations:
  `npm run db:migrate -w @gamepulse/shared -- --name your_change`. Commit the
  generated SQL. Keep new analytical indexes leading with `(projectId, timestamp)`.
- **Commits:** Conventional Commits (`feat(api): …`, `fix(worker): …`,
  `docs: …`). One logical change per commit.
- **Tests:** add/adjust unit tests for new logic; pure functions (e.g. insight
  rules) should be unit-tested without a database.

## Adding a new SDK

The ingestion endpoint is contract-first. A new SDK (Unity, Godot, …) only needs
to `POST /api/v1/events` with the `x-api-key` header and the batch body defined
by `ingestBatchSchema`. Mirror the batching/offline/retry behavior of
`packages/sdk-js`.

## Reporting security issues

Please report vulnerabilities privately rather than via public issues. Open a
GitHub security advisory on the repository, or contact a maintainer directly, so
a fix can ship before disclosure.
