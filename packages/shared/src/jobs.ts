import type { IngestEvent } from "./contracts.js";

/**
 * Payload enqueued by the API ingestion endpoint and consumed by the worker.
 * Kept here so producer (api) and consumer (worker) share one definition.
 */
export interface IngestJobData {
  projectId: string;
  batchId: string;
  receivedAt: string; // ISO; server receive time
  events: IngestEvent[];
}
