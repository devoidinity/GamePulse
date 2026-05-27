# GamePulse

**Open-source, self-hosted telemetry & analytics built for games** — indie,
idle/incremental, roguelikes, mobile, and simulation. Instead of generic product
analytics, GamePulse speaks your domain: player progression, retention, the game
economy, upgrade balance, item usage, and session behavior.

> Not trying to out-feature PostHog/Amplitude/GameAnalytics. Trying to answer
> *"Is level 8 too hard?"* and *"Is my gold economy inflating?"* out of the box.

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

## Quick start (Docker)

```bash
cp .env.example .env          # adjust secrets for non-local use
docker compose up -d          # postgres, redis, migrate, api, worker, dashboard
```

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
docker compose up -d postgres redis
npm run db:deploy            # apply migrations
npm run db:seed              # optional demo data

npm run dev -w @gamepulse/api        # :4000
npm run dev -w @gamepulse/worker
npm run dev -w @gamepulse/dashboard  # :3000
```

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

## Scaling notes

- `events` is prepared for native monthly range partitioning — see
  [`packages/shared/prisma/partitioning.sql`](packages/shared/prisma/partitioning.sql).
- Ingestion scales horizontally: run multiple `api` and `worker` replicas; the
  rate limiter and queue are Redis-backed and shared.
- All hot read paths are index-aligned to `(projectId, timestamp)`.

## License

MIT.
