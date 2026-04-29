"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProjects } from "@/lib/project";
import { useFunnel } from "@/lib/hooks";
import { fmtInt, fmtPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { NoProject, PageHeader } from "@/components/common";

const DEFAULT_STEPS = ["session_start", "level_started", "level_completed", "upgrade_bought", "currency_spent"];

export default function FunnelsPage() {
  const { current } = useProjects();
  const [stepsText, setStepsText] = useState(DEFAULT_STEPS.join("\n"));
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS);
  const { data, isLoading } = useFunnel(current?.id, steps);

  if (!current) return <NoProject />;

  const chartData = data?.steps.map((s) => ({ ...s, label: s.name }));

  return (
    <>
      <PageHeader title="Funnels" subtitle="Define ordered steps to measure conversion & drop-off" />
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              className="h-48 w-full rounded-md border border-input bg-transparent p-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => setSteps(stepsText.split("\n").map((s) => s.trim()).filter(Boolean))}
            >
              Run funnel
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {chartData?.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                        <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 text-left font-medium">Step</th>
                      <th className="py-1 text-right font-medium">Users</th>
                      <th className="py-1 text-right font-medium">From start</th>
                      <th className="py-1 text-right font-medium">Drop-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.steps.map((s) => (
                      <tr key={s.name} className="border-t">
                        <td className="py-1.5 font-mono text-xs">{s.name}</td>
                        <td className="py-1.5 text-right">{fmtInt(s.count)}</td>
                        <td className="py-1.5 text-right">{fmtPct(s.conversionFromStart)}</td>
                        <td className="py-1.5 text-right text-amber-400">{fmtPct(s.dropOffFromPrev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
