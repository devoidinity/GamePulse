import { prisma, Prisma } from "@gamepulse/shared/prisma";
import type { OverviewMetrics } from "@gamepulse/shared";
import { resolveRange, round } from "./util.js";
import { getRetention } from "./retentionService.js";

interface CountRow { n: bigint }
interface SeriesRow { date: Date; active: bigint; events: bigint }

/** Cheap, index-backed top-line metrics for the Overview page. */
export async function getOverview(
  projectId: string,
  from?: string,
  to?: string,
): Promise<OverviewMetrics> {
  const range = resolveRange(from, to, 30);
  const now = range.to;
  const dayAgo = new Date(now.getTime() - 1 * 86_400_000);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);

  const activeBetween = (since: Date) => prisma.$queryRaw<CountRow[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "playerId")::bigint AS n
    FROM player_days
    WHERE "projectId" = ${projectId} AND date >= ${since} AND date <= ${now}
  `);

  const [
    [dauRow],
    [wauRow],
    [mauRow],
    [playersRow],
    [eventsRow],
    [sessionRow],
    series,
    retention,
  ] = await Promise.all([
    activeBetween(dayAgo),
    activeBetween(weekAgo),
    activeBetween(monthAgo),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM players WHERE "projectId" = ${projectId}`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM events WHERE "projectId" = ${projectId}`),
    prisma.$queryRaw<{ avg: number | null }[]>(Prisma.sql`
      SELECT AVG("durationSeconds")::float AS avg
      FROM sessions
      WHERE "projectId" = ${projectId} AND "durationSeconds" IS NOT NULL
        AND "startedAt" >= ${range.from} AND "startedAt" <= ${range.to}`),
    prisma.$queryRaw<SeriesRow[]>(Prisma.sql`
      SELECT pd.date AS date,
             COUNT(DISTINCT pd."playerId")::bigint AS active,
             COALESCE(dr.events, 0)::bigint AS events
      FROM player_days pd
      LEFT JOIN daily_rollups dr
        ON dr."projectId" = pd."projectId" AND dr.date = pd.date
      WHERE pd."projectId" = ${projectId}
        AND pd.date >= ${range.from} AND pd.date <= ${range.to}
      GROUP BY pd.date, dr.events
      ORDER BY pd.date`),
    getRetention(projectId, from, to),
  ]);

  return {
    dau: Number(dauRow?.n ?? 0),
    wau: Number(wauRow?.n ?? 0),
    mau: Number(mauRow?.n ?? 0),
    totalPlayers: Number(playersRow?.n ?? 0),
    totalEvents: Number(eventsRow?.n ?? 0),
    avgSessionSeconds: round(sessionRow?.avg ?? 0, 1),
    retention: {
      d1: retention.overall[1] ?? 0,
      d7: retention.overall[7] ?? 0,
      d30: retention.overall[30] ?? 0,
    },
    series: series.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      activePlayers: Number(s.active),
      events: Number(s.events),
    })),
  };
}
