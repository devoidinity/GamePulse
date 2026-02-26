import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Shared ioredis connection. BullMQ requires `maxRetriesPerRequest: null`.
 * A single connection is reused for queue producers and rate limiting.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

export async function pingRedis(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === "PONG";
  } catch {
    return false;
  }
}
