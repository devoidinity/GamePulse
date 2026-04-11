export type PropertyValue = string | number | boolean | null;
export type EventProperties = Record<string, PropertyValue>;

/** Wire shape — mirrors @gamepulse/shared IngestEvent (kept dep-free here). */
export interface QueuedEvent {
  eventName: string;
  playerId: string;
  sessionId?: string;
  timestamp: string;
  properties: EventProperties;
  idempotencyKey?: string;
}

/** Minimal persistence contract; satisfied by localStorage and the Node shim. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GamePulseOptions {
  /** Project API key (gp_live_…). */
  apiKey: string;
  /** Base URL of the GamePulse API, e.g. https://telemetry.example.com */
  endpoint: string;
  /** Stable player id. Omit to auto-generate + persist an anonymous id. */
  playerId?: string;
  /** Current session id. */
  sessionId?: string;
  /** Flush when this many events are queued. Default 20. */
  flushAt?: number;
  /** Flush at least this often (ms). Default 10000. Set 0 to disable timer. */
  flushIntervalMs?: number;
  /** Hard cap on the offline queue; oldest dropped past this. Default 1000. */
  maxQueueSize?: number;
  /** Max send retries before giving up on a batch. Default 5. */
  maxRetries?: number;
  /** Inject fetch (tests / non-global environments). */
  fetchImpl?: typeof fetch;
  /** Inject storage (tests / custom persistence). */
  storage?: KeyValueStorage;
  /** Log debug output. */
  debug?: boolean;
}
