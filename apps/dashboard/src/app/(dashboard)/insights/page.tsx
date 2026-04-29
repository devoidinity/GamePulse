"use client";

import { AlertTriangle, Info, Lightbulb } from "lucide-react";
import { useProjects } from "@/lib/project";
import { useInsights, type Insight } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/misc";
import { LoadingGrid, NoProject, PageHeader } from "@/components/common";

const severityIcon = {
  CRITICAL: <AlertTriangle className="h-5 w-5 text-red-400" />,
  WARNING: <AlertTriangle className="h-5 w-5 text-amber-400" />,
  INFO: <Info className="h-5 w-5 text-primary" />,
} as const;

const severityBadge = { CRITICAL: "critical", WARNING: "warning", INFO: "default" } as const;

export default function InsightsPage() {
  const { current } = useProjects();
  const { data, isLoading } = useInsights(current?.id);

  if (!current) return <NoProject />;

  return (
    <>
      <PageHeader title="Insights" subtitle="Automated, rule-based findings (refreshed nightly)" />
      {isLoading || !data ? (
        <LoadingGrid n={3} />
      ) : data.data.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Lightbulb className="h-8 w-8" />
          <p>No insights yet. They appear after the nightly analyzer runs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.data.map((i) => (
            <InsightRow key={i.id} insight={i} />
          ))}
        </div>
      )}
    </>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const sev = (insight.severity as keyof typeof severityIcon) ?? "INFO";
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="mt-0.5">{severityIcon[sev]}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold">{insight.title}</p>
            <Badge variant={severityBadge[sev]}>{insight.severity}</Badge>
            <Badge variant="muted">{insight.type.replaceAll("_", " ").toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{insight.body}</p>
        </div>
        <time className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(insight.detectedAt).toLocaleDateString()}
        </time>
      </CardContent>
    </Card>
  );
}
