import { detectStorage } from "./storage.js";
import type {
  EventProperties,
  GamePulseOptions,
  KeyValueStorage,
  QueuedEvent,
} from "./types.js";

export * from "./types.js";

const SEND_BATCH_MAX = 500; // server-side cap
const STORAGE_KEY = "gamepulse:queue";
const ANON_KEY = "gamepulse:anon";

/**
 * GamePulse telemetry client.
 *
 *   const gp = new GamePulse({ apiKey: "gp_live_…", endpoint: "https://…" });
 *   gp.track("ore_mined", { amount: 10 });
 *
 * Events are batched, persisted to an offline queue, and flushed with
 * exponential-backoff retries. Works in browsers and Node.
 */
export class GamePulse {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly flushAt: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly storage: KeyValueStorage;
  private readonly debug: boolean;

  private playerId: string;
  private sessionId?: string;
  private queue: QueuedEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sending = false;
  private retryCount = 0;

  constructor(options: GamePulseOptions) {
    if (!options.apiKey) throw new Error("GamePulse: apiKey is required");
    if (!options.endpoint) throw new Error("GamePulse: endpoint is required");

    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.flushAt = options.flushAt ?? 20;
    this.flushIntervalMs = options.flushIntervalMs ?? 10_000;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    this.maxRetries = options.maxRetries ?? 5;
    this.debug = options.debug ?? false;

    const f = options.fetchImpl ?? globalThis.fetch;
    if (!f) throw new Error("GamePulse: no fetch available; pass options.fetchImpl");
    this.fetchImpl = f.bind(globalThis);
    this.storage = options.storage ?? detectStorage();

    this.playerId = options.playerId ?? this.loadAnonId();
    this.sessionId = options.sessionId;

    this.loadQueue();
    this.startTimer();
    this.registerUnloadFlush();
  }

  /** Identify the current player (e.g. after login). */
  setPlayer(playerId: string): void {
    this.playerId = playerId;
  }

  setSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /** Queue an event. Flushes immediately once `flushAt` is reached. */
  track(
    eventName: string,
    properties: EventProperties = {},
    opts: { playerId?: string; sessionId?: string; timestamp?: Date; idempotencyKey?: string } = {},
  ): void {
    const event: QueuedEvent = {
      eventName,
      playerId: opts.playerId ?? this.playerId,
      sessionId: opts.sessionId ?? this.sessionId,
      timestamp: (opts.timestamp ?? new Date()).toISOString(),
      properties,
      idempotencyKey: opts.idempotencyKey,
    };

    this.queue.push(event);
    if (this.queue.length > this.maxQueueSize) {
      // Drop oldest to bound memory/storage.
      this.queue.splice(0, this.queue.length - this.maxQueueSize);
    }
    this.persistQueue();

    if (this.queue.length >= this.flushAt) void this.flush();
  }

  /** Send all queued events. Resolves when the queue is drained or stalls. */
  async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, SEND_BATCH_MAX);
        const outcome = await this.sendBatch(batch);
        if (outcome === "ok") {
          this.queue.splice(0, batch.length);
          this.persistQueue();
          this.retryCount = 0;
        } else if (outcome === "drop") {
          // Non-retryable (4xx): drop the batch to avoid a poison loop.
          this.queue.splice(0, batch.length);
          this.persistQueue();
        } else {
          // Retryable: stop, schedule a backoff retry, keep events persisted.
          this.scheduleRetry();
          break;
        }
      }
    } finally {
      this.sending = false;
    }
  }

  /** Flush and stop timers. Call before process exit. */
  async shutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }

  // --- internals ---

  private async sendBatch(events: QueuedEvent[]): Promise<"ok" | "retry" | "drop"> {
    try {
      const res = await this.fetchImpl(`${this.endpoint}/api/v1/events`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify({ events }),
        keepalive: true, // survive page unload in browsers
      });
      if (res.ok) return "ok";
      if (res.status === 429 || res.status >= 500) return "retry";
      this.log("dropping batch, status", res.status);
      return "drop";
    } catch (err) {
      this.log("network error, will retry", err);
      return "retry"; // offline / DNS / TLS — keep and retry
    }
  }

  private scheduleRetry(): void {
    if (this.retryCount >= this.maxRetries) {
      this.log("max retries reached; events remain queued for next flush");
      this.retryCount = 0;
      return;
    }
    this.retryCount++;
    const delay = Math.min(30_000, 1000 * 2 ** (this.retryCount - 1));
    setTimeout(() => void this.flush(), delay);
  }

  private startTimer(): void {
    if (this.flushIntervalMs <= 0) return;
    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    // Don't keep a Node process alive solely for the flush timer.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private registerUnloadFlush(): void {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const handler = () => void this.flush();
    window.addEventListener("pagehide", handler);
    window.addEventListener("beforeunload", handler);
  }

  private loadAnonId(): string {
    let id = this.storage.getItem(ANON_KEY);
    if (!id) {
      id = `anon-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      this.storage.setItem(ANON_KEY, id);
    }
    return id;
  }

  private loadQueue(): void {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) this.queue = JSON.parse(raw) as QueuedEvent[];
    } catch {
      this.queue = [];
    }
  }

  private persistQueue(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage full / unavailable — keep in-memory copy only.
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) console.log("[GamePulse]", ...args);
  }
}

export default GamePulse;
