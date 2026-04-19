"use client";

import { useQuery } from "@tanstack/react-query";
import type {
  EconomyResult,
  FunnelResult,
  IdleResult,
  OverviewMetrics,
  ProgressionResult,
  RetentionResult,
} from "@gamepulse/shared";
import { api } from "./api";

const analytics =
  <T,>(path: string) =>
  (projectId: string, extra: Record<string, string | undefined> = {}) =>
    api<T>(path, { query: { projectId, ...extra } });

export function useOverview(projectId?: string) {
  return useQuery({
    queryKey: ["overview", projectId],
    queryFn: () => analytics<OverviewMetrics>("/api/v1/overview")(projectId!),
    enabled: !!projectId,
  });
}

export function useRetention(projectId?: string) {
  return useQuery({
    queryKey: ["retention", projectId],
    queryFn: () => analytics<RetentionResult>("/api/v1/retention")(projectId!),
    enabled: !!projectId,
  });
}

export function useProgression(projectId?: string) {
  return useQuery({
    queryKey: ["progression", projectId],
    queryFn: () => analytics<ProgressionResult>("/api/v1/progression")(projectId!),
    enabled: !!projectId,
  });
}

export function useEconomy(projectId?: string) {
  return useQuery({
    queryKey: ["economy", projectId],
    queryFn: () => analytics<EconomyResult>("/api/v1/economy")(projectId!),
    enabled: !!projectId,
  });
}

export function useIdle(projectId?: string) {
  return useQuery({
    queryKey: ["idle", projectId],
    queryFn: () => analytics<IdleResult>("/api/v1/idle")(projectId!),
    enabled: !!projectId,
  });
}

export function useFunnel(projectId?: string, steps?: string[]) {
  return useQuery({
    queryKey: ["funnel", projectId, steps],
    queryFn: () =>
      api<FunnelResult & { stepNames: string[] }>("/api/v1/funnels", {
        query: { projectId: projectId!, steps: steps!.join(",") },
      }),
    enabled: !!projectId && !!steps && steps.length >= 2,
  });
}

export interface Insight {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  detectedAt: string;
}

export function useInsights(projectId?: string) {
  return useQuery({
    queryKey: ["insights", projectId],
    queryFn: () => api<{ data: Insight[] }>("/api/v1/insights", { query: { projectId: projectId! } }),
    enabled: !!projectId,
  });
}
