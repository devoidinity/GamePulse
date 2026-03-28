import { prisma, Prisma } from "@gamepulse/shared/prisma";

interface RollupRow {
  date: Date;
  new_players: bigint;
  active_players: bigint;
  sessions: bigint;
  events: bigint;
  session_seconds: bigint;
}

/**
 * Recomputes DailyRollup for the trailing `days` from source tables. Idempotent
 * (full upsert per day), so it is safe to run repeatedly / on a schedule.
 */
export async function recomputeRollups(projectId: string, days = 35): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.$queryRaw<RollupRow[]>(Prisma.sql`
    WITH days AS (
      SELECT date FROM player_days
      WHERE "projectId" = ${projectId} AND date >= ${since}
      GROUP BY date
    ),
    active AS (
      SELECT date, COUNT(DISTINCT "playerId")::bigint AS n
      FROM player_days WHERE "projectId" = ${projectId} AND date >= ${since}
      GROUP BY date
    ),
    newp AS (
      SELECT date_trunc('day', "firstSeenAt")::date AS date, COUNT(*)::bigint AS n
      FROM players WHERE "projectId" = ${projectId} AND "firstSeenAt" >= ${since}
      GROUP BY 1
    ),
    sess AS (
      SELECT date_trunc('day', "startedAt")::date AS date,
             COUNT(*)::bigint AS n,
             COALESCE(SUM("durationSeconds"),0)::bigint AS secs
      FROM sessions WHERE "projectId" = ${projectId} AND "startedAt" >= ${since}
      GROUP BY 1
    ),
    ev AS (
      SELECT date_trunc('day', timestamp)::date AS date, COUNT(*)::bigint AS n
      FROM events WHERE "projectId" = ${projectId} AND timestamp >= ${since}
      GROUP BY 1
    )
    SELECT d.date,
      COALESCE(newp.n,0) AS new_players,
      COALESCE(active.n,0) AS active_players,
      COALESCE(sess.n,0) AS sessions,
      COALESCE(ev.n,0) AS events,
      COALESCE(sess.secs,0) AS session_seconds
    FROM days d
    LEFT JOIN active ON active.date = d.date
    LEFT JOIN newp   ON newp.date = d.date
    LEFT JOIN sess   ON sess.date = d.date
    LEFT JOIN ev     ON ev.date = d.date
  `);

  for (const row of rows) {
    await prisma.dailyRollup.upsert({
      where: { projectId_date: { projectId, date: row.date } },
      create: {
        projectId,
        date: row.date,
        newPlayers: Number(row.new_players),
        activePlayers: Number(row.active_players),
        sessions: Number(row.sessions),
        events: Number(row.events),
        sessionSeconds: row.session_seconds,
      },
      update: {
        newPlayers: Number(row.new_players),
        activePlayers: Number(row.active_players),
        sessions: Number(row.sessions),
        events: Number(row.events),
        sessionSeconds: row.session_seconds,
      },
    });
  }
  return rows.length;
}
