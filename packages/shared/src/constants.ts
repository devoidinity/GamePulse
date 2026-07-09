/** Cross-cutting constants shared by API, worker, and SDK. */

/** BullMQ queue names. */
export const QUEUE = {
  /** Raw event batches awaiting persistence. */
  INGEST: "ingest",
  /** Nightly analytics / balance-analyzer jobs. */
  ANALYTICS: "analytics",
} as const;

/** Job names within the analytics queue. */
export const ANALYTICS_JOB = {
  ROLLUP: "daily-rollup",
  BALANCE_ANALYZER: "balance-analyzer",
  IDEMPOTENCY_CLEANUP: "idempotency-cleanup",
} as const;

/** Conventional event names GamePulse understands natively. */
export const CORE_EVENTS = {
  SESSION_START: "session_start",
  SESSION_END: "session_end",
  LEVEL_COMPLETED: "level_completed",
  LEVEL_STARTED: "level_started",
  CURRENCY_EARNED: "currency_earned",
  CURRENCY_SPENT: "currency_spent",
  UPGRADE_BOUGHT: "upgrade_bought",
  GENERATOR_BOUGHT: "generator_bought",
  ITEM_USED: "item_used",
} as const;

/** Idempotency keys older than this are eligible for cleanup. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** API key prefix shown in the dashboard, e.g. gp_live_xxxx. */
export const API_KEY_PREFIX = "gp_live_";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;
