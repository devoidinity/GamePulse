/** Response DTOs shared between the API and the dashboard. */

export interface OverviewMetrics {
  dau: number;
  wau: number;
  mau: number;
  totalEvents: number;
  totalPlayers: number;
  avgSessionSeconds: number;
  retention: { d1: number; d7: number; d30: number };
  /** Daily series for charts (ISO date -> counts). */
  series: Array<{ date: string; activePlayers: number; events: number }>;
}

export interface RetentionCohort {
  /** Cohort signup day (ISO date). */
  cohort: string;
  size: number;
  /** retention[d] = fraction (0..1) of the cohort active on day d. */
  retention: Record<number, number>;
}

export interface RetentionResult {
  days: number[]; // e.g. [1,3,7,14,30]
  cohorts: RetentionCohort[];
  /** Weighted average per day across all cohorts. */
  overall: Record<number, number>;
}

export interface FunnelStep {
  name: string;
  count: number;
  conversionFromStart: number; // 0..1
  conversionFromPrev: number; // 0..1
  dropOffFromPrev: number; // 0..1
}

export interface FunnelResult {
  steps: FunnelStep[];
  totalEntered: number;
}

export interface ProgressionLevel {
  level: number;
  reached: number;
  completed: number;
  completionRate: number; // 0..1
  dropOff: number; // 0..1, players reaching but not advancing
  problematic: boolean;
}

export interface ProgressionResult {
  levels: ProgressionLevel[];
  /** Levels flagged as unusually hard / lossy. */
  problematicLevels: number[];
}

export interface CurrencyFlow {
  currency: string;
  earned: number;
  spent: number;
  net: number;
  sources: Array<{ name: string; amount: number }>;
  sinks: Array<{ name: string; amount: number }>;
  balance: { avg: number; median: number; p90: number; p99: number };
  inflationDetected: boolean;
}

export interface EconomyResult {
  currencies: CurrencyFlow[];
}

export interface IdleItemUsage {
  name: string;
  players: number;
  purchases: number;
  adoptionRate: number; // 0..1 of active players
  dead: boolean;
}

export interface IdleResult {
  generators: IdleItemUsage[];
  upgrades: IdleItemUsage[];
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}
