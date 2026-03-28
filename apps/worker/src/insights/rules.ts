import type { InsightType, InsightSeverity } from "@gamepulse/shared/prisma";

export interface InsightSpec {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  body: string;
  fingerprint: string;
  data: Record<string, unknown>;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Generators/upgrades adopted by fewer than `threshold` of active players. */
export function evaluateDeadContent(
  items: Array<{ name: string; adoptionRate: number; players: number }>,
  kind: "upgrade" | "generator",
  threshold = 0.01,
): InsightSpec[] {
  const type: InsightType = kind === "upgrade" ? "DEAD_UPGRADE" : "DEAD_GENERATOR";
  return items
    .filter((i) => i.adoptionRate < threshold)
    .map((i) => ({
      type,
      severity: "WARNING" as InsightSeverity,
      title: `${kind === "upgrade" ? "Upgrade" : "Generator"} "${i.name}" is rarely used`,
      body: `${kind === "upgrade" ? "Upgrade" : "Generator"} ${i.name} is purchased by only ${pct(i.adoptionRate)} of players.`,
      fingerprint: `dead_${kind}:${i.name}`,
      data: { name: i.name, adoptionRate: i.adoptionRate, players: i.players },
    }));
}

/** Levels whose drop-off is an upper outlier (mean + 1 std, floored at 0.4). */
export function evaluateLevelDropoff(
  levels: Array<{ level: number; reached: number; dropOff: number }>,
): InsightSpec[] {
  const meaningful = levels.filter((l) => l.reached >= 20);
  if (meaningful.length < 3) return [];
  const drops = meaningful.map((l) => l.dropOff);
  const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
  const std = Math.sqrt(drops.reduce((a, b) => a + (b - mean) ** 2, 0) / drops.length);
  const threshold = Math.max(0.4, mean + std);
  return meaningful
    .filter((l) => l.dropOff >= threshold)
    .map((l) => ({
      type: "LEVEL_DROPOFF" as InsightType,
      severity: (l.dropOff >= 0.6 ? "CRITICAL" : "WARNING") as InsightSeverity,
      title: `Level ${l.level} causes high drop-off`,
      body: `Level ${l.level} causes ${pct(l.dropOff)} player drop-off.`,
      fingerprint: `level_dropoff:${l.level}`,
      data: { level: l.level, dropOff: l.dropOff, reached: l.reached },
    }));
}

/** Currencies that are earned but almost never spent (sink starvation). */
export function evaluateUnspentCurrency(
  flows: Array<{ currency: string; earned: number; spent: number }>,
  threshold = 0.05,
): InsightSpec[] {
  return flows
    .filter((f) => f.earned > 0 && f.spent / f.earned < threshold)
    .map((f) => ({
      type: "UNSPENT_CURRENCY" as InsightType,
      severity: "WARNING" as InsightSeverity,
      title: `Currency "${f.currency}" is hoarded`,
      body: `Players spend only ${pct(f.spent / f.earned)} of the ${f.currency} they earn — consider adding sinks.`,
      fingerprint: `unspent_currency:${f.currency}`,
      data: { currency: f.currency, earned: f.earned, spent: f.spent },
    }));
}

/** Currencies accumulating faster over time (possible inflation). */
export function evaluateInflation(
  rows: Array<{ currency: string; firstHalf: number; secondHalf: number }>,
  threshold = 0.25,
): InsightSpec[] {
  return rows
    .filter((r) => r.firstHalf > 0 && r.secondHalf / r.firstHalf - 1 > threshold)
    .map((r) => {
      const growth = r.secondHalf / r.firstHalf - 1;
      return {
        type: "ECONOMY_INFLATION" as InsightType,
        severity: (growth > 0.5 ? "CRITICAL" : "WARNING") as InsightSeverity,
        title: `${r.currency} accumulation is rising`,
        body: `${r.currency} accumulation increased ${pct(growth)} over the period.`,
        fingerprint: `economy_inflation:${r.currency}`,
        data: { currency: r.currency, growth },
      };
    });
}
