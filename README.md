# 🎮 GamePulse

### 📊 Open-source, self-hosted telemetry & analytics built specifically for games. 
Perfect for indie games, idle/incremental, roguelikes, mobile, and simulations.

Instead of generic web-product analytics, **GamePulse speaks your domain**: player progression, retention, game economy, upgrade balance, item usage, and session behavior. 

We aren't trying to out-feature PostHog, Amplitude, or GameAnalytics. GamePulse is designed to answer real gamedev questions out of the box:
* 📉 *“Is level 8 too hard?”*
* 💰 *“Is my gold economy inflating?”*
* ⚔️ *“Which upgrades are players ignoring?”*

---

### 🚀 Project Status: Early MVP / Alpha
The architecture and data model are **stable** and the core paths are thoroughly tested. However, please note that **APIs may still change** before the 1.0 release. 

⚠️ *Important:* Please read our **Production & Security** guide before self-hosting.

---

### 📄 License & Contributing
* 📜 **License:** [MIT](LICENSE) — Free, loose, and commercial-friendly.
* 🤝 **Contributing:** We love community help! Check out our [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

---

## Highlights

- **Event-driven ingestion** — `POST /api/v1/events` validates with Zod, returns
  `202`, and processes asynchronously through BullMQ. The write path stays cheap
  so it scales toward 100M+ events.
- **Game-specific analytics** — retention cohorts, funnels, progression
  drop-off, and a flagship **economy** module (sources/sinks, avg/median/p90/p99
  balances, inflation detection) plus idle-game adoption + dead-content.
- **Automated insights** — a nightly, rule-based balance analyzer flags dead
  upgrades, brutal levels, hoarded currencies, and inflation. No AI in the MVP.
- **Multi-tenant + RBAC** — organizations, projects, JWT auth with refresh
  rotation, API keys for ingestion, and Owner/Admin/Analyst/ReadOnly roles.
- **Typed end-to-end** — one Zod contract in `@gamepulse/shared` drives the API
  validation, the OpenAPI spec, and the SDK.
- **Batteries included** — Next.js dashboard (dark mode), JS SDK with offline
  queue, OpenAPI docs, Docker Compose, and tests.

## Architecture

```
                +------------------+         +------------------+
  Game / SDK -->|  API (Fastify)   |  enqueue|  Redis / BullMQ  |
                |  validate + 202  |-------->|  ingest queue    |
                +--------+---------+         +---------+--------+
                         | query                       | consume
                         v                              v
                +------------------+         +------------------+
   Dashboard -->|  PostgreSQL      |<--------|  Worker          |
   (Next.js)    |  events (JSONB)  | upsert  |  persist + rollup|
                |  + aggregates    |         |  nightly analyzer|
                +------------------+         +------------------+
```

- **`apps/api`** — Fastify: auth, ingestion, analytics queries, OpenAPI.
- **`apps/worker`** — BullMQ consumers: event persistence, daily rollups, the
  nightly balance analyzer that writes insights.
- **`apps/dashboard`** — Next.js App Router SPA with TanStack Query + Recharts.
- **`packages/shared`** — Prisma schema/client, Zod contracts, enums, env.
- **`packages/sdk-js`** — browser + Node telemetry SDK (batching, offline, retry).

### Why this shape

- **Ingestion is decoupled from persistence.** The API only validates + enqueues;
  the worker does upserts and aggregation. Throughput is bounded by Redis, not by
  Postgres write contention.
- **Reads are pre-aggregated.** `PlayerDay` makes DAU/retention O(active-days)
  instead of O(events); `DailyRollup` powers the Overview without scanning raw
  events. Analytical indexes all lead with `(projectId, timestamp)`.
- **One contract, no drift.** SDK and API import the same Zod schemas.

## Prerequisites

- **Docker** + Docker Compose v2 (for the one-command path), **or**
- **Node.js ≥ 24** and **npm ≥ 9** plus a local PostgreSQL 14+ and Redis 6+
  (for running from source).

## Quick start (Docker)

```bash
cp .env.example .env          # adjust secrets for non-local use
docker compose up -d          # postgres, redis, migrate, api, worker, dashboard
```

`docker compose` reads `.env` automatically; the `migrate` service applies the
schema before `api`/`worker` start.

- Dashboard → http://localhost:3000
- API + OpenAPI docs → http://localhost:4000/docs
- Health → http://localhost:4000/health

Seed demo data (a 45-day idle game with retention, economy, and insights):

```bash
docker compose run --rm migrate npm run db:seed -w @gamepulse/shared
# Login: demo@gamepulse.dev / password123  (API key is printed)
```

## Local development

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:deploy            # apply migrations
npm run db:seed              # optional demo data

npm run dev -w @gamepulse/api        # :4000
npm run dev -w @gamepulse/worker
npm run dev -w @gamepulse/dashboard  # :3000
```

> **Note:** the `db:*` scripts run inside `packages/shared`, so Prisma reads its
> `.env` from there or from the process environment. Either copy `.env` into
> `packages/shared/`, or export `DATABASE_URL` in your shell before running them
> (`export DATABASE_URL=postgresql://gamepulse:gamepulse@localhost:5432/gamepulse`).

## API

All endpoints under `/api/v1`. Ingestion uses the project API key
(`x-api-key`); everything else uses a user JWT (`Authorization: Bearer …`).

| Method | Path           | Auth   | Purpose                              |
| ------ | -------------- | ------ | ------------------------------------ |
| POST   | `/events`      | apiKey | Batch event ingestion (async, 202)   |
| POST   | `/auth/*`      | —      | register / login / refresh / logout  |
| GET    | `/projects`    | JWT    | List projects                        |
| GET    | `/players`     | JWT    | List players (cursor paginated)      |
| GET    | `/events`      | JWT    | Query events                         |
| GET    | `/overview`    | JWT    | DAU/WAU/MAU, totals, retention, series|
| GET    | `/retention`   | JWT    | Cohort retention (D1/D3/D7/D14/D30)  |
| GET    | `/funnels`     | JWT    | Funnel conversion / drop-off         |
| GET    | `/progression` | JWT    | Level completion / drop-off          |
| GET    | `/economy`     | JWT    | Currency sources/sinks/balances      |
| GET    | `/idle`        | JWT    | Generator/upgrade adoption           |
| GET    | `/insights`    | JWT    | Automated insights                   |

Full, interactive reference at **`/docs`** (OpenAPI 3).

### Ingesting events

```bash
curl -X POST http://localhost:4000/api/v1/events \
  -H "x-api-key: gp_live_…" -H "content-type: application/json" \
  -d '{"events":[{"eventName":"ore_mined","playerId":"player-123","properties":{"amount":25}}]}'
```

Send an `Idempotency-Key` header to make HTTP retries safe.

## SDK

```ts
import { GamePulse } from "@gamepulse/sdk-js";

const telemetry = new GamePulse({ apiKey: "gp_live_…", endpoint: "https://telemetry.example.com" });
telemetry.track("ore_mined", { amount: 10 });
telemetry.track("upgrade_bought", { upgrade: "drill_speed", cost: 100 });
```

Batching, offline queue, and retry/backoff are automatic. See
[`packages/sdk-js`](packages/sdk-js/README.md).

### Event conventions the analytics understand

| Event              | Key properties                          | Powers            |
| ------------------ | --------------------------------------- | ----------------- |
| `level_started` / `level_completed` | `level`                | Progression       |
| `currency_earned`  | `currency`, `amount`, `source`          | Economy sources   |
| `currency_spent`   | `currency`, `amount`, `sink`            | Economy sinks     |
| `generator_bought` | `generator`                             | Idle adoption     |
| `upgrade_bought`   | `upgrade`                               | Upgrade balance   |
| `session_start` / `session_end` | (with `sessionId`)         | Sessions          |

## Testing

```bash
npm test                                   # all workspaces
npm test -w @gamepulse/sdk-js              # unit
RUN_INTEGRATION=1 npm test -w @gamepulse/api   # needs db+redis
```

Unit tests cover the SDK, the insight rules, shared contracts, and API
crypto/util helpers. The Supertest integration suite exercises the full
register → project → ingest → query path.

## Configuration

All services are configured via environment variables (validated at boot with
Zod — a bad config fails fast). See [`.env.example`](.env.example) for the full
list; the most important:

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `REDIS_URL` | — | Redis connection string (required) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev placeholders | **Change for production** |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `900` / `1209600` | seconds |
| `API_PORT` / `API_HOST` | `4000` / `0.0.0.0` | API bind |
| `CORS_ORIGIN` | `*` | Comma-separated allowlist; **restrict in production** |
| `INGEST_RATE_LIMIT_MAX` / `INGEST_RATE_LIMIT_WINDOW` | `10000` / `1 minute` | per API key |
| `INGEST_MAX_BATCH` | `500` | max events per request |
| `ANALYZER_HOUR_UTC` | `3` | nightly balance-analyzer hour (worker) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | **Build-time** for the dashboard image |

## Production & security

- **Replace the JWT secrets** (`openssl rand -hex 48`) and use a real secrets
  manager — the defaults in `.env.example` are for local dev only.
- **Restrict `CORS_ORIGIN`** to your dashboard origin(s).
- Terminate TLS at a reverse proxy in front of `api` and `dashboard`.
- `NEXT_PUBLIC_API_URL` is inlined into the dashboard bundle at **build** time;
  rebuild the dashboard image with `--build-arg NEXT_PUBLIC_API_URL=https://…`
  for non-localhost deployments.
- API keys are stored only as SHA-256 hashes; passwords as bcrypt; refresh
  tokens are hashed, rotated on use, and revocable.

## Scaling notes

- `events` is prepared for native monthly range partitioning — see
  [`packages/shared/prisma/partitioning.sql`](packages/shared/prisma/partitioning.sql).
- Ingestion scales horizontally: run multiple `api` and `worker` replicas; the
  rate limiter and queue are Redis-backed and shared.
- All hot read paths are index-aligned to `(projectId, timestamp)`.

## Roadmap

The MVP deliberately stops short of a few things; PRs welcome:

**Product & features**
- **Unity** and **Godot** SDKs (the ingestion contract already supports them).
- Project member management UI (invites, role changes) — RBAC exists server-side.
- Configurable insight thresholds per project.
- Event schema registry / property typing.
- Data retention & GDPR delete-by-player tooling.

**Test automation & quality**
- ✅ GitHub Actions CI: typecheck + unit tests on every push/PR, plus an
  integration job with ephemeral Postgres + Redis. *(in progress)*
- Coverage reporting with a minimum threshold gate (target ≥ 80%) enforced in CI.
- End-to-end dashboard tests (Playwright) covering the auth + analytics flows.
- SDK browser-matrix tests and a load/throughput test for the ingestion path.
- Static analysis in CI: ESLint + Prettier checks and a Dependabot/`npm audit`
  security gate.

**CI/CD & releases**
- Build and publish versioned Docker images (api / worker / dashboard) to GHCR
  on tagged releases.
- Automated, changelog-driven releases (Changesets / release-please) and npm
  publishing of `@gamepulse/sdk-js`.
- Preview/staging deployments per pull request.
- Prisma migration checks in CI (drift detection + migrate-deploy dry run).

AI-assisted insights are intentionally **out of scope** for the MVP — analysis is
deterministic and rule-based.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the dev
setup, coding conventions, and how to run the test suite. Please open an issue to
discuss substantial changes first.

## Security

Found a vulnerability? Please **do not** open a public issue — email the
maintainers privately (see `CONTRIBUTING.md`) so it can be patched before
disclosure.

## License

[MIT](LICENSE) © 2026 GamePulse contributors.
