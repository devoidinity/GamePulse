"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Activity,
  Coins,
  Filter,
  Gauge,
  Layers,
  Lightbulb,
  LineChart,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tokenStore } from "@/lib/auth";
import { useProjects } from "@/lib/project";
import { Select } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/overview", label: "Overview", icon: Gauge },
  { href: "/retention", label: "Retention", icon: LineChart },
  { href: "/funnels", label: "Funnels", icon: Filter },
  { href: "/progression", label: "Progression", icon: TrendingUp },
  { href: "/economy", label: "Economy", icon: Coins },
  { href: "/idle", label: "Idle Content", icon: Layers },
  { href: "/insights", label: "Insights", icon: Lightbulb },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { projects, current, setCurrent } = useProjects();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/50 p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-primary">
          <Activity className="h-6 w-6" />
          <span className="text-lg font-bold tracking-tight">GamePulse</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-4">
          <Select
            value={current?.id ?? ""}
            onChange={(e) => setCurrent(e.target.value)}
            className="max-w-[14rem]"
          >
            {projects.length === 0 && <option value="">No projects</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme">
              <Sun className="h-4 w-4 dark:hidden" />
              <Moon className="hidden h-4 w-4 dark:block" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              onClick={() => {
                tokenStore.clear();
                router.replace("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
