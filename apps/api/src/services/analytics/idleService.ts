import { prisma, Prisma } from "@gamepulse/shared/prisma";
import type { IdleItemUsage, IdleResult } from "@gamepulse/shared";
import { resolveRange, ratio, round } from "./util.js";

interface UsageRow { label: string; players: bigint; purchases: bigint }

const DEAD_THRESHOLD = 0.01; // adopted by < 1% of active players

async function activePlayerCount(projectId: string, from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "playerId")::bigint AS n
    FROM player_days
    WHERE "projectId" = ${projectId} AND date >= ${from} AND date <= ${to}
  `);
  return Number(rows[0]?.n ?? 0);
}

async function usage(
  projectId: string,
  eventName: string,
  prop: string,
  range: { from: Date; to: Date },
  denom: number,
): Promise<IdleItemUsage[]> {
  const rows = await prisma.$queryRaw<UsageRow[]>(Prisma.sql`
    SELECT properties->>${prop} AS label,
           COUNT(DISTINCT "playerId")::bigint AS players,
           COUNT(*)::bigint AS purchases
    FROM events
    WHERE "projectId" = ${projectId} AND "eventName" = ${eventName}
      AND properties ? ${prop}
      AND timestamp >= ${range.from} AND timestamp <= ${range.to}
    GROUP BY 1 ORDER BY 2 DESC
  `);
  return rows
    .filter((r) => r.label)
    .map((r) => {
      const players = Number(r.players);
      const adoptionRate = round(ratio(players, denom));
      return {
        name: r.label,
        players,
        purchases: Number(r.purchases),
        adoptionRate,
        dead: adoptionRate < DEAD_THRESHOLD,
      };
    });
}

/** Idle-game content analytics: generator + upgrade adoption, dead content. */
export async function getIdle(opts: {
  projectId: string;
  from?: string;
  to?: string;
}): Promise<IdleResult> {
  const range = resolveRange(opts.from, opts.to, 30);
  const denom = await activePlayerCount(opts.projectId, range.from, range.to);
  const [generators, upgrades] = await Promise.all([
    usage(opts.projectId, "generator_bought", "generator", range, denom),
    usage(opts.projectId, "upgrade_bought", "upgrade", range, denom),
  ]);
  return { generators, upgrades };
}
