import { prisma, Prisma } from "@gamepulse/shared/prisma";
import { NotFoundError, type FunnelResult, type FunnelStep } from "@gamepulse/shared";
import { resolveRange, ratio, round } from "./util.js";

interface FirstRow {
  playerId: string;
  eventName: string;
  t: Date;
}

/** Resolve the ordered step list from a saved funnel or ad-hoc input. */
async function resolveSteps(
  projectId: string,
  funnelId?: string,
  steps?: string[] | string,
): Promise<string[]> {
  if (funnelId) {
    const funnel = await prisma.funnel.findFirst({ where: { id: funnelId, projectId } });
    if (!funnel) throw new NotFoundError("Funnel not found");
    return funnel.steps as string[];
  }
  if (Array.isArray(steps)) return steps;
  if (typeof steps === "string") return steps.split(",").map((s) => s.trim()).filter(Boolean);
  throw new NotFoundError("Provide funnelId or steps");
}

/**
 * Ordered funnel: a player passes step k if they triggered each prior step at
 * a time <= the next step's first occurrence (monotonic progression).
 */
export async function getFunnel(opts: {
  projectId: string;
  funnelId?: string;
  steps?: string[] | string;
  from?: string;
  to?: string;
}): Promise<FunnelResult & { stepNames: string[] }> {
  const stepNames = await resolveSteps(opts.projectId, opts.funnelId, opts.steps);
  const range = resolveRange(opts.from, opts.to, 90);

  const firsts = await prisma.$queryRaw<FirstRow[]>(Prisma.sql`
    SELECT "playerId", "eventName", MIN(timestamp) AS t
    FROM events
    WHERE "projectId" = ${opts.projectId}
      AND "eventName" IN (${Prisma.join(stepNames)})
      AND timestamp >= ${range.from} AND timestamp <= ${range.to}
    GROUP BY "playerId", "eventName"
  `);

  // player -> { eventName -> firstTimestampMs }
  const byPlayer = new Map<string, Map<string, number>>();
  for (const r of firsts) {
    let m = byPlayer.get(r.playerId);
    if (!m) byPlayer.set(r.playerId, (m = new Map()));
    m.set(r.eventName, r.t.getTime());
  }

  const counts = new Array<number>(stepNames.length).fill(0);
  for (const m of byPlayer.values()) {
    let prevT = -Infinity;
    for (let i = 0; i < stepNames.length; i++) {
      const t = m.get(stepNames[i]!);
      if (t === undefined || t < prevT) break;
      counts[i]!++;
      prevT = t;
    }
  }

  const totalEntered = counts[0] ?? 0;
  const steps: FunnelStep[] = stepNames.map((name, i) => {
    const count = counts[i]!;
    const prev = i === 0 ? count : counts[i - 1]!;
    const fromPrev = round(ratio(count, prev));
    return {
      name,
      count,
      conversionFromStart: round(ratio(count, totalEntered)),
      conversionFromPrev: fromPrev,
      dropOffFromPrev: round(1 - fromPrev),
    };
  });

  return { steps, totalEntered, stepNames };
}
