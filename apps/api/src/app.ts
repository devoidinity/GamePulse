import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { redis } from "./lib/redis.js";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { registerErrorHandler } from "./plugins/errorHandler.js";
import { authPlugin } from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { playerRoutes } from "./routes/players.js";
import { eventRoutes } from "./routes/events.js";
import { analyticsRoutes } from "./routes/analytics/index.js";
import { insightRoutes } from "./routes/insights.js";

export interface BuildAppOptions {
  /** Disable request logging in tests. */
  logger?: boolean;
}

/**
 * Builds a fully-wired Fastify instance WITHOUT listening. Used by both the
 * production bootstrap (src/index.ts) and Supertest integration tests.
 * Modules (auth, ingestion, analytics, openapi) register themselves here as
 * they are added.
 */
export async function buildApp(
  opts: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            transport:
              env.NODE_ENV === "development"
                ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } }
                : undefined,
            redact: ["req.headers.authorization", "req.headers['x-api-key']"],
          },
    trustProxy: true,
    genReqId: (req) =>
      (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
    bodyLimit: 5 * 1024 * 1024, // 5 MB batches
  }).withTypeProvider<ZodTypeProvider>();

  // Zod as the single validation + serialization engine.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    credentials: true,
  });

  registerErrorHandler(app);

  // Rate limiting (opt-in per route via config.rateLimit), backed by Redis so
  // limits are shared across API replicas. Keyed by API key for ingestion.
  await app.register(rateLimit, {
    global: false,
    redis: env.NODE_ENV === "test" ? undefined : redis,
    keyGenerator: (req) =>
      (req.headers["x-api-key"] as string) ?? req.ip,
  });

  // Auth decorators (authenticate / requireRole / authenticateApiKey).
  await app.register(authPlugin);

  // --- Routes & modules (extended as features land) ---
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(projectRoutes, { prefix: "/api/v1/projects" });
  await app.register(playerRoutes, { prefix: "/api/v1/players" });
  await app.register(eventRoutes, { prefix: "/api/v1" });
  await app.register(analyticsRoutes, { prefix: "/api/v1" });
  await app.register(insightRoutes, { prefix: "/api/v1" });

  return app;
}
