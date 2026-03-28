import { Worker, type Job } from "bullmq";
import { prisma } from "@gamepulse/shared/prisma";
import { QUEUE, ANALYTICS_JOB, type IngestJobData } from "@gamepulse/shared";
import { env } from "./config/env.js";
import { connection } from "./lib/redis.js";
import { logger } from "./lib/logger.js";
import { processIngestBatch } from "./processors/ingestProcessor.js";
import { recomputeRollups } from "./processors/rollupProcessor.js";
import { analyzeAllProjects } from "./processors/balanceAnalyzer.js";
import { analyticsQueue, scheduleNightlyJobs } from "./lib/queue.js";

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

function startAnalyticsWorker(): Worker {
  const worker = new Worker(
    QUEUE.ANALYTICS,
    async (job: Job) => {
      // The nightly job recomputes rollups for all projects, then runs the
      // rule-based balance analyzer to (re)generate insights.
      logger.info({ name: job.name }, "running analytics job");
      const projects = await prisma.project.findMany({ select: { id: true } });
      for (const p of projects) await recomputeRollups(p.id);
      if (job.name === ANALYTICS_JOB.BALANCE_ANALYZER) await analyzeAllProjects();
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, "analytics job failed"),
  );
  return worker;
}

async function main(): Promise<void> {
  logger.info("worker starting");
  workers.push(startIngestWorker(), startAnalyticsWorker());
  await scheduleNightlyJobs();
  logger.info({ concurrency: env.INGEST_CONCURRENCY }, "workers ready");

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "worker shutting down");
    // Stop accepting new jobs, let in-flight finish.
    await Promise.all(workers.map((w) => w.close()));
    await analyticsQueue.close();
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
