import { Queue, type ConnectionOptions } from "bullmq";
import { QUEUE } from "@gamepulse/shared";
import { redis } from "./redis.js";

// BullMQ bundles its own ioredis copy; cast to bridge the duplicate types.
const connection = redis as unknown as ConnectionOptions;

/** Producer-side handle to the ingestion queue. Worker consumes it. */
export const ingestQueue = new Queue(QUEUE.INGEST, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 10_000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

export async function closeQueues(): Promise<void> {
  await ingestQueue.close();
}
