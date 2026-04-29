"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useProjects } from "@/lib/project";
import { useEconomy } from "@/lib/hooks";
import { fmtInt } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/misc";
import { NoProject, PageHeader, StatCard } from "@/components/common";
import type { CurrencyFlow } from "@gamepulse/shared";

const COLORS = ["#8b5cf6", "#22d3ee", "#f59e0b", "#34d399", "#f472b6", "#60a5fa"];

export default function EconomyPage() {
  const { current } = useProjects();
  const { data, isLoading } = useEconomy(current?.id);

  if (!current) return <NoProject />;
  if (isLoading || !data) return <><PageHeader title="Economy" /><Skeleton className="h-64" /></>;

  return (
    <>
      <PageHeader title="Economy" subtitle="Currency sources, sinks, balances & inflation" />
      {data.currencies.length === 0 && (
        <p className="text-sm text-muted-foreground">No currency events yet. Emit currency_earned / currency_spent.</p>
      )}
      <div className="space-y-6">
        {data.currencies.map((c) => (
          <CurrencyBlock key={c.currency} c={c} />
        ))}
      </div>
    </>
  );
}

function CurrencyBlock({ c }: { c: CurrencyFlow }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base capitalize">{c.currency}</CardTitle>
        {c.inflationDetected && <Badge variant="critical">Inflation detected</Badge>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Earned" value={fmtInt(c.earned)} />
          <StatCard label="Spent" value={fmtInt(c.spent)} />
          <StatCard label="Net flow" value={fmtInt(c.net)} hint={c.net > 0 ? "accumulating" : "draining"} />
          <StatCard label="Median balance" value={fmtInt(c.balance.median)} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4 text-sm">
          <Stat label="Avg balance" value={fmtInt(c.balance.avg)} />
          <Stat label="p90 balance" value={fmtInt(c.balance.p90)} />
          <Stat label="p99 balance" value={fmtInt(c.balance.p99)} />
          <Stat label="Sink/earn ratio" value={c.earned ? `${Math.round((c.spent / c.earned) * 100)}%` : "—"} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <FlowPie title="Sources" data={c.sources} />
          <FlowPie title="Sinks" data={c.sinks} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function FlowPie({ title, data }: { title: string; data: Array<{ name: string; amount: number }> }) {
  if (!data.length) return <div className="text-sm text-muted-foreground">No {title.toLowerCase()}.</div>;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="flex items-center gap-4">
        <div className="h-40 w-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="amount" nameKey="name" innerRadius={36} outerRadius={64} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-sm">
          {data.slice(0, 6).map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-muted-foreground">{d.name}</span>
              <span className="font-medium">{fmtInt(d.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
