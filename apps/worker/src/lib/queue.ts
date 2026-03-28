import { Queue } from "bullmq";
import { QUEUE, ANALYTICS_JOB } from "@gamepulse/shared";
import { connection } from "./redis.js";
import { env } from "../config/env.js";

export const analyticsQueue = new Queue(QUEUE.ANALYTICS, { connection });

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
