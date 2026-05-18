import { Queue, type ConnectionOptions } from "bullmq";
import { QUEUE, ANALYTICS_JOB } from "@gamepulse/shared";
import { connection } from "./redis.js";
import { env } from "../config/env.js";

// BullMQ bundles its own ioredis copy; cast to bridge the duplicate types.
export const bullConnection = connection as unknown as ConnectionOptions;

export const analyticsQueue = new Queue(QUEUE.ANALYTICS, { connection: bullConnection });

/**
 * Registers the nightly repeatable job (idempotent — BullMQ dedupes by the
 * repeat options + jobId). Runs at ANALYZER_HOUR_UTC every day.
 */
export async function scheduleNightlyJobs(): Promise<void> {
  await analyticsQueue.add(
    ANALYTICS_JOB.BALANCE_ANALYZER,
    {},
    {
      repeat: { pattern: `0 ${env.ANALYZER_HOUR_UTC} * * *`, tz: "UTC" },
      jobId: "nightly-balance-analyzer",
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
}
