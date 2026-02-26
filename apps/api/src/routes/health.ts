import type { FastifyInstance } from "fastify";
import { prisma } from "@gamepulse/shared/prisma";
import { pingRedis } from "../lib/redis.js";

/** Liveness + readiness probes for Docker / orchestration. */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // Liveness: process is up. Never touches dependencies.
  app.get("/health", { config: { public: true } }, async () => ({
    status: "ok",
    uptime: process.uptime(),
  }));

  // Readiness: dependencies reachable. Used by compose healthchecks.
  app.get("/ready", { config: { public: true } }, async (_req, reply) => {
    const [db, cache] = await Promise.all([
      prisma
        .$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false),
      pingRedis(),
    ]);
    const ok = db && cache;
    return reply.status(ok ? 200 : 503).send({
      status: ok ? "ready" : "degraded",
      checks: { database: db, redis: cache },
    });
  });
}
