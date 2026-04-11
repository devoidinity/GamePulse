# @gamepulse/sdk-js

Telemetry SDK for GamePulse. Works in browsers and Node.js, with batching, an
offline queue, and retry/backoff. Zero runtime dependencies.

## Install

```bash
npm install @gamepulse/sdk-js
```

## Usage

```ts
import { GamePulse } from "@gamepulse/sdk-js";

const telemetry = new GamePulse({
  apiKey: "gp_live_xxx",
  endpoint: "https://telemetry.example.com",
  playerId: "player-123", // optional; auto-generated + persisted if omitted
});

telemetry.track("ore_mined", { amount: 10 });
telemetry.track("upgrade_bought", { upgrade: "drill_speed", cost: 100 });

// After login you can attach a stable id:
telemetry.setPlayer("user-42");

// Before exit (Node) — flush remaining events:
await telemetry.shutdown();
```

## Options

| Option            | Default   | Description                                   |
| ----------------- | --------- | --------------------------------------------- |
| `apiKey`          | —         | Project API key (required)                    |
| `endpoint`        | —         | API base URL (required)                       |
| `playerId`        | anon id   | Stable player id                              |
| `flushAt`         | `20`      | Flush when this many events are queued        |
| `flushIntervalMs` | `10000`   | Periodic flush interval (0 disables)          |
| `maxQueueSize`    | `1000`    | Offline queue cap (oldest dropped past this)  |
| `maxRetries`      | `5`       | Backoff retries per batch                     |
| `fetchImpl`       | global    | Inject a `fetch` implementation               |
| `storage`         | auto      | Inject a `localStorage`-like store            |

## Behavior

- **Batching** — events accumulate and flush at `flushAt`, on the interval
  timer, on `flush()`, and on page unload (browser).
- **Offline queue** — events persist to `localStorage` (browser) or memory
  (Node). They survive reloads and flush when connectivity returns.
- **Retries** — network errors, `429`, and `5xx` retry with exponential
  backoff; `4xx` (other than `429`) drop to avoid poison loops.
