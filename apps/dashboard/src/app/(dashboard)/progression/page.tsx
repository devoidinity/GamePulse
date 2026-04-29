"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useProjects } from "@/lib/project";
import { useProgression } from "@/lib/hooks";
import { fmtInt, fmtPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { LoadingGrid, NoProject, PageHeader } from "@/components/common";

export default function ProgressionPage() {
  const { current } = useProjects();
  const { data, isLoading } = useProgression(current?.id);

  if (!current) return <NoProject />;

  const chartData = data?.levels.map((l) => ({
    level: `L${l.level}`,
    reached: l.reached,
    completionRate: Math.round(l.completionRate * 100),
    problematic: l.problematic,
  }));

  return (
    <>
      <PageHeader title="Progression" subtitle="Level completion & drop-off — problematic levels auto-flagged" />
      {isLoading || !data ? (
        <LoadingGrid n={4} />
      ) : (
        <>
          {data.problematicLevels.length > 0 && (
            <Card className="mb-4 border-amber-500/40">
              <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
                <span className="text-muted-foreground">Problematic levels:</span>
                {data.problematicLevels.map((l) => (
                  <Badge key={l} variant="warning">Level {l}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Players reaching each level vs. completion rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="level" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={44} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={44} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="reached" radius={[4, 4, 0, 0]}>
                      {chartData?.map((d, i) => (
                        <Cell key={i} fill={d.problematic ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="completionRate" stroke="#22d3ee" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <table className="mt-4 w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">Level</th>
                    <th className="py-1 text-right font-medium">Reached</th>
                    <th className="py-1 text-right font-medium">Completed</th>
                    <th className="py-1 text-right font-medium">Completion</th>
                    <th className="py-1 text-right font-medium">Drop-off</th>
                  </tr>
                </thead>
                <tbody>
                  {data.levels.map((l) => (
                    <tr key={l.level} className="border-t">
                      <td className="py-1.5">{l.level} {l.problematic && <Badge variant="warning" className="ml-1">!</Badge>}</td>
                      <td className="py-1.5 text-right">{fmtInt(l.reached)}</td>
                      <td className="py-1.5 text-right">{fmtInt(l.completed)}</td>
                      <td className="py-1.5 text-right">{fmtPct(l.completionRate)}</td>
                      <td className="py-1.5 text-right text-amber-400">{fmtPct(l.dropOff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
