"use client";

import { useProjects } from "@/lib/project";
import { useRetention } from "@/lib/hooks";
import { fmtInt, fmtPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingGrid, NoProject, PageHeader } from "@/components/common";

/** Blue-ish heatmap colour scaled by retention value (0..1). */
function cellStyle(v: number): React.CSSProperties {
  const alpha = Math.min(1, v * 1.4);
  return {
    backgroundColor: `hsla(250, 84%, 60%, ${alpha})`,
    color: alpha > 0.5 ? "white" : "hsl(var(--foreground))",
  };
}

export default function RetentionPage() {
  const { current } = useProjects();
  const { data, isLoading } = useRetention(current?.id);

  if (!current) return <NoProject />;

  return (
    <>
      <PageHeader title="Retention" subtitle="Cohort retention by signup day" />
      {isLoading || !data ? (
        <LoadingGrid n={4} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort heatmap</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="px-2 py-1 text-left font-medium">Cohort</th>
                  <th className="px-2 py-1 text-right font-medium">Size</th>
                  {data.days.map((d) => (
                    <th key={d} className="px-2 py-1 text-center font-medium">D{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-2 py-1 font-medium">Overall</td>
                  <td />
                  {data.days.map((d) => (
                    <td key={d} className="rounded px-2 py-1 text-center font-semibold" style={cellStyle(data.overall[d] ?? 0)}>
                      {fmtPct(data.overall[d] ?? 0, 0)}
                    </td>
                  ))}
                </tr>
                {data.cohorts.slice().reverse().map((c) => (
                  <tr key={c.cohort}>
                    <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{c.cohort}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{fmtInt(c.size)}</td>
                    {data.days.map((d) => (
                      <td key={d} className="rounded px-2 py-1 text-center" style={cellStyle(c.retention[d] ?? 0)}>
                        {c.retention[d] != null ? fmtPct(c.retention[d]!, 0) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
