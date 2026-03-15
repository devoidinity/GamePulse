import { prisma, Prisma } from "@gamepulse/shared/prisma";
import { CORE_EVENTS, type IngestJobData } from "@gamepulse/shared";

const dayUTC = (d: Date): Date => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

interface SessionAgg {
  playerExternalId: string;
  startedAt: Date;
  endedAt?: Date;
}

/**
 * Persists one ingest batch with set-based operations. Idempotent at the event
 * level via the IdempotencyKey table, so BullMQ retries never double-insert.
 */
export async function processIngestBatch(data: IngestJobData): Promise<{
  inserted: number;
  deduped: number;
}> {
  const { projectId, events } = data;
  if (events.length === 0) return { inserted: 0, deduped: 0 };

  const tsOf = (e: (typeof events)[number]) =>
    e.timestamp ? new Date(e.timestamp) : new Date(data.receivedAt);

  // --- 1. Per-event idempotency: drop keys we've already seen ---
  const keyed = events.filter((e) => e.idempotencyKey);
  let deduped = 0;
  let workItems = events;
  if (keyed.length) {
    const scoped = keyed.map((e) => `evt:${e.idempotencyKey}`);
    const existing = new Set(
      (
        await prisma.idempotencyKey.findMany({
          where: { projectId, key: { in: scoped } },
          select: { key: true },
        })
      ).map((r) => r.key),
    );
    workItems = events.filter(
      (e) => !e.idempotencyKey || !existing.has(`evt:${e.idempotencyKey}`),
    );
    deduped = events.length - workItems.length;
    const fresh = workItems
      .filter((e) => e.idempotencyKey)
      .map((e) => ({ projectId, key: `evt:${e.idempotencyKey}` }));
    if (fresh.length) {
      await prisma.idempotencyKey.createMany({ data: fresh, skipDuplicates: true });
    }
  }
  if (workItems.length === 0) return { inserted: 0, deduped };

  // --- 2. Upsert players (firstSeen on create, lastSeen advances) ---
  const playerWindow = new Map<string, { min: Date; max: Date }>();
  for (const e of workItems) {
    const t = tsOf(e);
    const w = playerWindow.get(e.playerId);
    if (!w) playerWindow.set(e.playerId, { min: t, max: t });
    else {
      if (t < w.min) w.min = t;
      if (t > w.max) w.max = t;
    }
  }
  const playerIdByExternal = new Map<string, string>();
  for (const [externalPlayerId, w] of playerWindow) {
    const player = await prisma.player.upsert({
      where: { projectId_externalPlayerId: { projectId, externalPlayerId } },
      create: { projectId, externalPlayerId, firstSeenAt: w.min, lastSeenAt: w.max },
      update: { lastSeenAt: w.max },
      select: { id: true },
    });
    playerIdByExternal.set(externalPlayerId, player.id);
  }

  // --- 3. Upsert sessions (start/end events shape the time window) ---
  const sessionAgg = new Map<string, SessionAgg>();
  for (const e of workItems) {
    if (!e.sessionId) continue;
    const t = tsOf(e);
    const agg = sessionAgg.get(e.sessionId) ?? {
      playerExternalId: e.playerId,
      startedAt: t,
    };
    if (e.eventName === CORE_EVENTS.SESSION_START || t < agg.startedAt) agg.startedAt = t;
    if (e.eventName === CORE_EVENTS.SESSION_END) agg.endedAt = t;
    sessionAgg.set(e.sessionId, agg);
  }
  const sessionIdByExternal = new Map<string, string>();
  for (const [externalId, agg] of sessionAgg) {
    const playerId = playerIdByExternal.get(agg.playerExternalId)!;
    const endedAt = agg.endedAt;
    const durationSeconds = endedAt
      ? Math.max(0, Math.round((endedAt.getTime() - agg.startedAt.getTime()) / 1000))
      : undefined;
    const session = await prisma.session.upsert({
      where: { projectId_externalId: { projectId, externalId } },
      create: { projectId, playerId, externalId, startedAt: agg.startedAt, endedAt, durationSeconds },
      update: {
        ...(endedAt ? { endedAt, durationSeconds } : {}),
      },
      select: { id: true },
    });
    sessionIdByExternal.set(externalId, session.id);
  }

  // --- 4. Insert events ---
  const eventRows: Prisma.EventCreateManyInput[] = workItems.map((e) => ({
    projectId,
    playerId: playerIdByExternal.get(e.playerId)!,
    sessionId: e.sessionId ? sessionIdByExternal.get(e.sessionId) ?? null : null,
    eventName: e.eventName,
    properties: (e.properties ?? {}) as Prisma.InputJsonValue,
    timestamp: tsOf(e),
  }));
  await prisma.event.createMany({ data: eventRows });

  // --- 5. PlayerDay (DAU + retention backbone) ---
  const playerDaySet = new Map<string, Prisma.PlayerDayCreateManyInput>();
  for (const e of workItems) {
    const playerId = playerIdByExternal.get(e.playerId)!;
    const date = dayUTC(tsOf(e));
    playerDaySet.set(`${playerId}:${date.toISOString()}`, { projectId, playerId, date });
  }
  await prisma.playerDay.createMany({
    data: [...playerDaySet.values()],
    skipDuplicates: true,
  });

  return { inserted: eventRows.length, deduped };
}
