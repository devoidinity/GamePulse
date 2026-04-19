"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ProjectProvider } from "@/lib/project";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={client}>
        <ProjectProvider>{children}</ProjectProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
