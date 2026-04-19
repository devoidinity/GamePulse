"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function LoadingGrid({ n = 8 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function NoProject() {
  return (
    <div className="flex h-64 items-center justify-center text-center text-muted-foreground">
      <div>
        <p className="font-medium">No project selected</p>
        <p className="text-sm">Create a project, then select it from the top bar.</p>
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-6 text-sm text-destructive">Failed to load: {message}</CardContent>
    </Card>
  );
}
