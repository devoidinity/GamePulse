import { prisma, Prisma } from "@gamepulse/shared/prisma";
import type { CurrencyFlow, EconomyResult } from "@gamepulse/shared";
import { resolveRange, round } from "./util.js";

interface FlowRow { currency: string; earned: number; spent: number }
interface BreakdownRow { currency: string; label: string; amount: number }
interface BalanceRow {
  currency: string;
  avg: number;
  median: number;
  p90: number;
  p99: number;
}
interface InflationRow { currency: string; first_half: number; second_half: number }

const INFLATION_THRESHOLD = 0.25; // +25% accumulation between halves

/** Currency sources, sinks, balances (avg/median/p90/p99) and inflation flag. */
export async function getEconomy(opts: {
  projectId: string;
  currency?: string;
  from?: string;
  to?: string;
}): Promise<EconomyResult> {
  const range = resolveRange(opts.from, opts.to, 30);
  const currencyFilter = opts.currency
    ? Prisma.sql`AND properties->>'currency' = ${opts.currency}`
    : Prisma.empty;

  const flows = await prisma.$queryRaw<FlowRow[]>(Prisma.sql`
    SELECT properties->>'currency' AS currency,
      COALESCE(SUM(CASE WHEN "eventName"='currency_earned' THEN (properties->>'amount')::numeric END),0)::float AS earned,
      COALESCE(SUM(CASE WHEN "eventName"='currency_spent'  THEN (properties->>'amount')::numeric END),0)::float AS spent
    FROM events
    WHERE "projectId" = ${opts.projectId}
      AND "eventName" IN ('currency_earned','currency_spent')
      AND timestamp >= ${range.from} AND timestamp <= ${range.to}
      ${currencyFilter}
    GROUP BY 1
  `);

  const sources = await prisma.$queryRaw<BreakdownRow[]>(Prisma.sql`
    SELECT properties->>'currency' AS currency,
           COALESCE(properties->>'source','unknown') AS label,
           SUM((properties->>'amount')::numeric)::float AS amount
    FROM events
    WHERE "projectId" = ${opts.projectId} AND "eventName"='currency_earned'
      AND timestamp >= ${range.from} AND timestamp <= ${range.to} ${currencyFilter}
    GROUP BY 1, 2 ORDER BY 3 DESC
  `);

  const sinks = await prisma.$queryRaw<BreakdownRow[]>(Prisma.sql`
    SELECT properties->>'currency' AS currency,
           COALESCE(properties->>'sink','unknown') AS label,
           SUM((properties->>'amount')::numeric)::float AS amount
    FROM events
    WHERE "projectId" = ${opts.projectId} AND "eventName"='currency_spent'
      AND timestamp >= ${range.from} AND timestamp <= ${range.to} ${currencyFilter}
    GROUP BY 1, 2 ORDER BY 3 DESC
  `);

  const balances = await prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
    WITH bal AS (
      SELECT "playerId", properties->>'currency' AS currency,
        SUM(CASE WHEN "eventName"='currency_earned' THEN (properties->>'amount')::numeric
                 ELSE -(properties->>'amount')::numeric END) AS balance
      FROM events
      WHERE "projectId" = ${opts.projectId}
        AND "eventName" IN ('currency_earned','currency_spent')
        AND timestamp <= ${range.to} ${currencyFilter}
      GROUP BY 1, 2
    )
    SELECT currency,
      AVG(balance)::float AS avg,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY balance)::float AS median,
      PERCENTILE_CONT(0.9)  WITHIN GROUP (ORDER BY balance)::float AS p90,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY balance)::float AS p99
    FROM bal GROUP BY currency
  `);

  // Inflation: compare total earned in the first vs second half of the window.
  const midpoint = new Date((range.from.getTime() + range.to.getTime()) / 2);
  const inflation = await prisma.$queryRaw<InflationRow[]>(Prisma.sql`
    SELECT properties->>'currency' AS currency,
      COALESCE(SUM(CASE WHEN timestamp < ${midpoint} THEN (properties->>'amount')::numeric END),0)::float AS first_half,
      COALESCE(SUM(CASE WHEN timestamp >= ${midpoint} THEN (properties->>'amount')::numeric END),0)::float AS second_half
    FROM events
    WHERE "projectId" = ${opts.projectId} AND "eventName"='currency_earned'
      AND timestamp >= ${range.from} AND timestamp <= ${range.to} ${currencyFilter}
    GROUP BY 1
  `);

  const balByCur = new Map(balances.map((b) => [b.currency, b]));
  const inflByCur = new Map(inflation.map((i) => [i.currency, i]));
  const groupBy = (rows: BreakdownRow[]) => {
    const m = new Map<string, Array<{ name: string; amount: number }>>();
    for (const r of rows) {
      if (!m.has(r.currency)) m.set(r.currency, []);
      m.get(r.currency)!.push({ name: r.label, amount: round(r.amount, 2) });
    }
    return m;
  };
  const srcBy = groupBy(sources);
  const sinkBy = groupBy(sinks);

  const currencies: CurrencyFlow[] = flows
    .filter((f) => f.currency)
    .map((f) => {
      const bal = balByCur.get(f.currency);
      const infl = inflByCur.get(f.currency);
      const inflationDetected =
        !!infl && infl.first_half > 0 &&
        infl.second_half / infl.first_half - 1 > INFLATION_THRESHOLD;
      return {
        currency: f.currency,
        earned: round(f.earned, 2),
        spent: round(f.spent, 2),
        net: round(f.earned - f.spent, 2),
        sources: srcBy.get(f.currency) ?? [],
        sinks: sinkBy.get(f.currency) ?? [],
        balance: {
          avg: round(bal?.avg ?? 0, 2),
          median: round(bal?.median ?? 0, 2),
          p90: round(bal?.p90 ?? 0, 2),
          p99: round(bal?.p99 ?? 0, 2),
        },
        inflationDetected,
      };
    });

  return { currencies };
}
