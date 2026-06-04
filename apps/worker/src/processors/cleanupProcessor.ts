import { prisma } from "@gamepulse/shared/prisma";
import { IDEMPOTENCY_TTL_MS } from "@gamepulse/shared";

/**
 * Deletes idempotency keys older than the TTL. Without this the
 * `idempotency_keys` table grows unbounded — one row per deduped batch/event.
 * Keys only need to outlive the window in which a client might retry, so the
 * TTL (24h) is safe to prune past.
 */
export async function pruneIdempotencyKeys(): Promise<number> {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
