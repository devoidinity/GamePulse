import { Worker, type Job } from "bullmq";
import { prisma } from "@gamepulse/shared/prisma";
import { QUEUE, type IngestJobData } from "@gamepulse/shared";
import { env } from "./config/env.js";
import { connection } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { processIngestBatch } from "./processors/ingestProcessor.js";

const workers: Worker[] = [];

function startIngestWorker(): Worker {
  const worker = new Worker<IngestJobData>(
    QUEUE.INGEST,
    async (job: Job<IngestJobData>) => {
      const result = await processIngestBatch(job.data);
      logger.debug(
        { batchId: job.data.batchId, ...result },
        "processed ingest batch",
      );
      return result;
    },
    { connection, concurrency: env.INGEST_CONCURRENCY },
  );

  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, "ingest job failed"),
  );
  worker.on("error", (err) => logger.error({ err }, "ingest worker error"));
  return worker;
}

async function main(): Promise<void> {
  logger.info("worker starting");
  workers.push(startIngestWorker());
  logger.info({ concurrency: env.INGEST_CONCURRENCY }, "ingest worker ready");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "worker shutting down");
    // Stop accepting new jobs, let in-flight finish.
    await Promise.all(workers.map((w) => w.close()));
    await connection.quit();
    await prisma.$disconnect();
    logger.info("worker shutdown complete");
    process.exit(0);
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void shutdown(sig));
  }
}

void main();
