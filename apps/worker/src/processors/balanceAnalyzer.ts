import { prisma, Prisma } from "@gamepulse/shared/prisma";
import { logger } from "../lib/logger.js";
import {
  evaluateDeadContent,
  evaluateInflation,
  evaluateLevelDropoff,
  evaluateUnspentCurrency,
  type InsightSpec,
} from "../insights/rules.js";

const WINDOW_DAYS = 30;

function windowStart(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS);
  return d;
}

async function activePlayers(projectId: string, since: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "playerId")::bigint AS n
    FROM player_days WHERE "projectId" = ${projectId} AND date >= ${since}`);
  return Number(rows[0]?.n ?? 0);
}

async function adoption(projectId: string, eventName: string, prop: string, since: Date, denom: number) {
  const rows = await prisma.$queryRaw<{ name: string; players: bigint }[]>(Prisma.sql`
    SELECT properties->>${prop} AS name, COUNT(DISTINCT "playerId")::bigint AS players
    FROM events
    WHERE "projectId" = ${projectId} AND "eventName" = ${eventName}
      AND properties ? ${prop} AND timestamp >= ${since}
    GROUP BY 1`);
  return rows
    .filter((r) => r.name)
    .map((r) => ({ name: r.name, players: Number(r.players), adoptionRate: denom > 0 ? Number(r.players) / denom : 0 }));
}

/** Runs every rule for one project and upserts the resulting insights. */
export async function analyzeProject(projectId: string): Promise<number> {
  const since = windowStart();
  const denom = await activePlayers(projectId, since);

  // --- gather ---
  const [upgrades, generators, levelRows, flowRows, inflationRows] = await Promise.all([
    adoption(projectId, "upgrade_bought", "upgrade", since, denom),
    adoption(projectId, "generator_bought", "generator", since, denom),
    prisma.$queryRaw<{ lvl: number; started: bigint; completed: bigint }[]>(Prisma.sql`
      SELECT (properties->>'level')::int AS lvl,
        COUNT(DISTINCT "playerId") FILTER (WHERE "eventName"='level_started')::bigint AS started,
        COUNT(DISTINCT "playerId") FILTER (WHERE "eventName"='level_completed')::bigint AS completed
      FROM events
      WHERE "projectId" = ${projectId} AND "eventName" IN ('level_started','level_completed')
        AND properties ? 'level' AND timestamp >= ${since}
      GROUP BY 1 ORDER BY 1`),
    prisma.$queryRaw<{ currency: string; earned: number; spent: number }[]>(Prisma.sql`
      SELECT properties->>'currency' AS currency,
        COALESCE(SUM(CASE WHEN "eventName"='currency_earned' THEN (properties->>'amount')::numeric END),0)::float AS earned,
        COALESCE(SUM(CASE WHEN "eventName"='currency_spent'  THEN (properties->>'amount')::numeric END),0)::float AS spent
      FROM events
      WHERE "projectId" = ${projectId} AND "eventName" IN ('currency_earned','currency_spent')
        AND timestamp >= ${since}
      GROUP BY 1`),
    prisma.$queryRaw<{ currency: string; first_half: number; second_half: number }[]>(Prisma.sql`
      SELECT properties->>'currency' AS currency,
        COALESCE(SUM(CASE WHEN timestamp < ${midpoint(since)} THEN (properties->>'amount')::numeric END),0)::float AS first_half,
        COALESCE(SUM(CASE WHEN timestamp >= ${midpoint(since)} THEN (properties->>'amount')::numeric END),0)::float AS second_half
      FROM events
      WHERE "projectId" = ${projectId} AND "eventName"='currency_earned' AND timestamp >= ${since}
      GROUP BY 1`),
  ]);

  const levels = levelRows
    .filter((r) => r.lvl != null)
    .map((r) => {
      const reached = Number(r.started) || Number(r.completed);
      const completed = Number(r.completed);
      return { level: r.lvl, reached, dropOff: reached > 0 ? 1 - completed / reached : 0 };
    });

  // --- evaluate ---
  const specs: InsightSpec[] = [
    ...evaluateDeadContent(upgrades, "upgrade"),
    ...evaluateDeadContent(generators, "generator"),
    ...evaluateLevelDropoff(levels),
    ...evaluateUnspentCurrency(flowRows.filter((f) => f.currency)),
    ...evaluateInflation(
      inflationRows.filter((r) => r.currency).map((r) => ({ currency: r.currency, firstHalf: r.first_half, secondHalf: r.second_half })),
    ),
  ];

  // --- persist (upsert by fingerprint so re-runs refresh, not duplicate) ---
  for (const s of specs) {
    await prisma.insight.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint: s.fingerprint } },
      create: { projectId, type: s.type, severity: s.severity, title: s.title, body: s.body, fingerprint: s.fingerprint, data: s.data as Prisma.InputJsonValue },
      update: { severity: s.severity, title: s.title, body: s.body, data: s.data as Prisma.InputJsonValue, detectedAt: new Date() },
    });
  }

  logger.info({ projectId, insights: specs.length }, "balance analyzer complete");
  return specs.length;
}

function midpoint(since: Date): Date {
  return new Date((since.getTime() + Date.now()) / 2);
}

/** Run the analyzer (and rollups) for every project. */
export async function analyzeAllProjects(): Promise<void> {
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const p of projects) {
    await analyzeProject(p.id);
  }
}
