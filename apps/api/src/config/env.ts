import { baseEnvSchema, parseEnv } from "@gamepulse/shared";
import { z } from "zod";

const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().default(4000),
  API_HOST: z.string().default("0.0.0.0"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().default(1_209_600),

  INGEST_RATE_LIMIT_MAX: z.coerce.number().int().default(10_000),
  INGEST_RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  INGEST_MAX_BATCH: z.coerce.number().int().default(500),

  CORS_ORIGIN: z.string().default("*"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const env: ApiEnv = parseEnv(apiEnvSchema);
