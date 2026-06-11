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

// Values shipped in .env.example — must never be used in production.
const KNOWN_DEV_SECRETS = new Set([
  "dev-access-secret-change-me-in-production-please",
  "dev-refresh-secret-change-me-in-production-please",
]);

/**
 * Refuse to boot in production with weak, default, or duplicated JWT secrets.
 * In dev/test the short example secrets stay usable for convenience.
 */
export const apiEnvSchemaChecked = apiEnvSchema.superRefine((cfg, ctx) => {
  if (cfg.NODE_ENV !== "production") return;

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const value = cfg[key];
    if (KNOWN_DEV_SECRETS.has(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "must not use the example/default secret in production" });
    }
    if (value.length < 32) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "must be at least 32 characters in production (openssl rand -hex 48)" });
    }
  }
  if (cfg.JWT_ACCESS_SECRET === cfg.JWT_REFRESH_SECRET) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_REFRESH_SECRET"], message: "access and refresh secrets must differ" });
  }
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const env: ApiEnv = parseEnv(apiEnvSchemaChecked);
