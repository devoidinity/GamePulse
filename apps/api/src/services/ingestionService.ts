import { randomUUID } from "node:crypto";
import { prisma } from "@gamepulse/shared/prisma";
import type { IngestBatch, IngestJobData, IngestResponse } from "@gamepulse/shared";
import { ingestQueue } from "../lib/queue.js";

/**
 * Ingestion is intentionally write-cheap: validate, optionally dedupe the whole
 * batch by an Idempotency-Key, enqueue to BullMQ, and return 202. All heavy
 * work (player/session upsert, event insert, rollups) happens in the worker.
 */
export const ingestionService = {
  async enqueueBatch(
    projectId: string,
    batch: IngestBatch,
    idempotencyKey?: string,
  ): Promise<{ response: IngestResponse; replayed: boolean }> {
    // Batch-level idempotency: a retried HTTP request with the same key must
    // not double-enqueue. We rely on the unique (projectId, key) constraint.
    if (idempotencyKey) {
      try {
        await prisma.idempotencyKey.create({
          data: { projectId, key: idempotencyKey },
        });
      } catch {
        // Already processed this exact request — acknowledge without re-enqueue.
        return {
          replayed: true,
          response: { accepted: 0, duplicates: batch.events.length, batchId: idempotencyKey },
        };
      }
    }

    const batchId = randomUUID();
    const jobData: IngestJobData = {
      projectId,
      batchId,
      receivedAt: new Date().toISOString(),
      events: batch.events,
    };

    await ingestQueue.add("batch", jobData, { jobId: batchId });

    return {
      replayed: false,
      response: { accepted: batch.events.length, duplicates: 0, batchId },
    };
  },
};
