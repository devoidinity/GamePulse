"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface Project {
  id: string;
  name: string;
  organizationId: string;
  apiKeyPrefix: string | null;
}

interface ProjectCtx {
  projects: Project[];
  current: Project | null;
  setCurrent: (id: string) => void;
  isLoading: boolean;
}

const Ctx = createContext<ProjectCtx | null>(null);
const SELECTED_KEY = "gp_project";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ data: Project[] }>("/api/v1/projects"),
  });
  const projects = data?.data ?? [];
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!projects.length) return;
    const saved = localStorage.getItem(SELECTED_KEY);
    setCurrentId(saved && projects.some((p) => p.id === saved) ? saved : projects[0]!.id);
  }, [projects]);

  const setCurrent = (id: string) => {
    localStorage.setItem(SELECTED_KEY, id);
    setCurrentId(id);
  };

  const current = projects.find((p) => p.id === currentId) ?? null;
  return <Ctx.Provider value={{ projects, current, setCurrent, isLoading }}>{children}</Ctx.Provider>;
}

export function useProjects(): ProjectCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider");
  return ctx;
}
