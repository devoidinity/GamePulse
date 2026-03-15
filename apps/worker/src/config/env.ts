import { baseEnvSchema, parseEnv } from "@gamepulse/shared";
import { z } from "zod";

const workerEnvSchema = baseEnvSchema.extend({
  INGEST_CONCURRENCY: z.coerce.number().int().default(8),
  // Run the nightly balance analyzer at this hour (UTC). Cron set in index.ts.
  ANALYZER_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(3),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export const env: WorkerEnv = parseEnv(workerEnvSchema);
