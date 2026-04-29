"use client";

import { useProjects } from "@/lib/project";
import { useIdle } from "@/lib/hooks";
import { fmtInt, fmtPct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { LoadingGrid, NoProject, PageHeader } from "@/components/common";
import type { IdleItemUsage } from "@gamepulse/shared";

export default function IdlePage() {
  const { current } = useProjects();
  const { data, isLoading } = useIdle(current?.id);

  if (!current) return <NoProject />;

  return (
    <>
      <PageHeader title="Idle Content" subtitle="Generator & upgrade adoption — dead content auto-flagged" />
      {isLoading || !data ? (
        <LoadingGrid n={4} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <UsageTable title="Generators" rows={data.generators} />
          <UsageTable title="Upgrades" rows={data.upgrades} />
        </div>
      )}
    </>
  );
}

function UsageTable({ title, rows }: { title: string; rows: IdleItemUsage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Name</th>
                <th className="py-1 text-right font-medium">Players</th>
                <th className="py-1 text-right font-medium">Purchases</th>
                <th className="py-1 text-right font-medium">Adoption</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t">
                  <td className="py-1.5">
                    <span className="font-mono text-xs">{r.name}</span>
                    {r.dead && <Badge variant="critical" className="ml-2">dead</Badge>}
                  </td>
                  <td className="py-1.5 text-right">{fmtInt(r.players)}</td>
                  <td className="py-1.5 text-right">{fmtInt(r.purchases)}</td>
                  <td className="py-1.5 text-right">{fmtPct(r.adoptionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
