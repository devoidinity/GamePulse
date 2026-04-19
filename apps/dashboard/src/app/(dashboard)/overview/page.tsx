"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useProjects } from "@/lib/project";
import { useOverview } from "@/lib/hooks";
import { fmtDuration, fmtInt, fmtPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingGrid, NoProject, PageHeader, StatCard } from "@/components/common";

export default function OverviewPage() {
  const { current } = useProjects();
  const { data, isLoading } = useOverview(current?.id);

  if (!current) return <NoProject />;

  return (
    <>
      <PageHeader title="Overview" subtitle={current.name} />
      {isLoading || !data ? (
        <LoadingGrid />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="DAU" value={fmtInt(data.dau)} hint="active in last 24h" />
            <StatCard label="WAU" value={fmtInt(data.wau)} hint="active in last 7d" />
            <StatCard label="MAU" value={fmtInt(data.mau)} hint="active in last 30d" />
            <StatCard label="Total players" value={fmtInt(data.totalPlayers)} />
            <StatCard label="Total events" value={fmtInt(data.totalEvents)} />
            <StatCard label="Avg session" value={fmtDuration(data.avgSessionSeconds)} />
            <StatCard label="D1 / D7 / D30" value={`${fmtPct(data.retention.d1, 0)} / ${fmtPct(data.retention.d7, 0)} / ${fmtPct(data.retention.d30, 0)}`} hint="retention" />
            <StatCard label="Stickiness" value={data.mau ? fmtPct(data.dau / data.mau, 0) : "—"} hint="DAU / MAU" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Active players">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="active" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="activePlayers" stroke="hsl(var(--primary))" fill="url(#active)" strokeWidth={2} />
                <ChartAxes />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Events per day">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="events" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="events" stroke="#22d3ee" fill="url(#events)" strokeWidth={2} />
                <ChartAxes />
              </AreaChart>
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartAxes() {
  return (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={36} />
      <Tooltip
        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
        labelStyle={{ color: "hsl(var(--foreground))" }}
      />
    </>
  );
}
