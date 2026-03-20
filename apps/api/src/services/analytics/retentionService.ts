import { prisma, Prisma } from "@gamepulse/shared/prisma";
import type { RetentionCohort, RetentionResult } from "@gamepulse/shared";
import { resolveRange, ratio, round } from "./util.js";

const DEFAULT_DAYS = [1, 3, 7, 14, 30];

interface SizeRow {
  cohort: Date;
  size: bigint;
}
interface RetRow {
  cohort: Date;
  day_no: number;
  players: bigint;
}

/**
 * Cohort retention computed from PlayerDay. A player belongs to the cohort of
 * their firstSeen day; day_no is the integer day offset of each active day.
 */
export async function getRetention(
  projectId: string,
  from?: string,
  to?: string,
): Promise<RetentionResult> {
  const range = resolveRange(from, to, 30);

  const sizes = await prisma.$queryRaw<SizeRow[]>(Prisma.sql`
    SELECT date_trunc('day', "firstSeenAt")::date AS cohort,
           COUNT(*)::bigint AS size
    FROM players
    WHERE "projectId" = ${projectId}
      AND "firstSeenAt" >= ${range.from}
      AND "firstSeenAt" <  ${range.to}
    GROUP BY 1
    ORDER BY 1
  `);

  const rows = await prisma.$queryRaw<RetRow[]>(Prisma.sql`
    WITH cohort AS (
      SELECT id AS player_id, date_trunc('day', "firstSeenAt")::date AS cohort_day
      FROM players
      WHERE "projectId" = ${projectId}
        AND "firstSeenAt" >= ${range.from}
        AND "firstSeenAt" <  ${range.to}
    )
    SELECT c.cohort_day AS cohort,
           (pd.date - c.cohort_day) AS day_no,
           COUNT(DISTINCT c.player_id)::bigint AS players
    FROM cohort c
    JOIN player_days pd
      ON pd."playerId" = c.player_id AND pd."projectId" = ${projectId}
    WHERE pd.date >= c.cohort_day
    GROUP BY 1, 2
  `);

  const sizeByCohort = new Map<string, number>();
  for (const s of sizes) sizeByCohort.set(s.cohort.toISOString().slice(0, 10), Number(s.size));

  const grid = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const key = r.cohort.toISOString().slice(0, 10);
    if (!grid.has(key)) grid.set(key, new Map());
    grid.get(key)!.set(Number(r.day_no), Number(r.players));
  }

  const cohorts: RetentionCohort[] = [];
  const overallNum: Record<number, number> = {};
  const overallDen: Record<number, number> = {};

  for (const [cohort, size] of [...sizeByCohort.entries()].sort()) {
    const dayMap = grid.get(cohort) ?? new Map();
    const retention: Record<number, number> = {};
    for (const d of DEFAULT_DAYS) {
      const retained = dayMap.get(d) ?? 0;
      retention[d] = round(ratio(retained, size));
      overallNum[d] = (overallNum[d] ?? 0) + retained;
      overallDen[d] = (overallDen[d] ?? 0) + size;
    }
    cohorts.push({ cohort, size, retention });
  }

  const overall: Record<number, number> = {};
  for (const d of DEFAULT_DAYS) overall[d] = round(ratio(overallNum[d] ?? 0, overallDen[d] ?? 0));

  return { days: DEFAULT_DAYS, cohorts, overall };
}
