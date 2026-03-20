/** Resolve an optional {from,to} ISO range into concrete Dates. */
export function resolveRange(
  from?: string,
  to?: string,
  defaultDays = 30,
): { from: Date; to: Date } {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(toDate.getTime() - defaultDays * 86_400_000);
  return { from: fromDate, to: toDate };
}

/** Safe division returning 0 when the denominator is 0. */
export const ratio = (num: number, den: number): number =>
  den > 0 ? num / den : 0;

export const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
