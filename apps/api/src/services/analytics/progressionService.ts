import { prisma, Prisma } from "@gamepulse/shared/prisma";
import type { ProgressionLevel, ProgressionResult } from "@gamepulse/shared";
import { resolveRange, ratio, round } from "./util.js";

interface LevelRow {
  event_name: string;
  lvl: number;
  players: bigint;
}

/**
 * Progression funnel by numeric level. Uses level_started (reached) and
 * level_completed (completed) when available; falls back to the prior level's
 * completions as the denominator. Flags levels whose drop-off is an outlier.
 */
export async function getProgression(opts: {
  projectId: string;
  eventName?: string;
  levelProperty?: string;
  from?: string;
  to?: string;
}): Promise<ProgressionResult> {
  const completedEvent = opts.eventName ?? "level_completed";
  const startedEvent =
    completedEvent === "level_completed" ? "level_started" : `${completedEvent}_started`;
  const levelProp = opts.levelProperty ?? "level";
  const range = resolveRange(opts.from, opts.to, 90);

  const rows = await prisma.$queryRaw<LevelRow[]>(Prisma.sql`
    SELECT "eventName" AS event_name,
           (properties->>${levelProp})::int AS lvl,
           COUNT(DISTINCT "playerId")::bigint AS players
    FROM events
    WHERE "projectId" = ${opts.projectId}
      AND "eventName" IN (${completedEvent}, ${startedEvent})
      AND properties ? ${levelProp}
      AND timestamp >= ${range.from} AND timestamp <= ${range.to}
    GROUP BY 1, 2
    ORDER BY 2
  `);

  const started = new Map<number, number>();
  const completed = new Map<number, number>();
  for (const r of rows) {
    if (r.lvl == null) continue;
    const map = r.event_name === completedEvent ? completed : started;
    map.set(r.lvl, Number(r.players));
  }

  const levelNumbers = [...new Set([...started.keys(), ...completed.keys()])].sort((a, b) => a - b);
  const levels: ProgressionLevel[] = [];
  let prevCompleted = 0;

  for (const lvl of levelNumbers) {
    const comp = completed.get(lvl) ?? 0;
    // reached = explicit starts, else prior level completions, else this level's completions.
    const reached = started.get(lvl) ?? (prevCompleted || comp);
    const completionRate = round(ratio(comp, reached));
    levels.push({
      level: lvl,
      reached,
      completed: comp,
      completionRate,
      dropOff: round(1 - completionRate),
      problematic: false,
    });
    prevCompleted = comp || prevCompleted;
  }

  // Outlier detection: drop-off above mean + 1*stddev (min floor 0.3).
  const drops = levels.map((l) => l.dropOff);
  const mean = drops.reduce((a, b) => a + b, 0) / (drops.length || 1);
  const variance = drops.reduce((a, b) => a + (b - mean) ** 2, 0) / (drops.length || 1);
  const std = Math.sqrt(variance);
  const threshold = Math.max(0.3, mean + std);

  for (const l of levels) l.problematic = l.dropOff >= threshold && l.reached > 0;

  return {
    levels,
    problematicLevels: levels.filter((l) => l.problematic).map((l) => l.level),
  };
}
