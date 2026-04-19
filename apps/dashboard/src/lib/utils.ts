import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const fmtInt = (n: number): string => new Intl.NumberFormat().format(Math.round(n));
export const fmtPct = (x: number, dp = 1): string => `${(x * 100).toFixed(dp)}%`;

export function fmtDuration(seconds: number): string {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
