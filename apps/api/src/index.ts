import { prisma } from "@gamepulse/shared/prisma";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { redis } from "./lib/redis.js";
import { closeQueues } from "./lib/queue.js";

async function main(): Promise<void> {
  const app = await buildApp();

  // --- Graceful shutdown ---
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, "shutting down");
    try {
      await app.close(); // stop accepting, drain in-flight
      await closeQueues();
      await redis.quit();
      await prisma.$disconnect();
      app.log.info("shutdown complete");
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, "error during shutdown");
      process.exit(1);
    }
  };

  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => void shutdown(sig));
  }
  process.on("unhandledRejection", (reason) => {
    app.log.error({ reason }, "unhandledRejection");
  });

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (err) {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
}

void main();
