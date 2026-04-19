"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.access) router.replace("/login");
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return <Shell>{children}</Shell>;
}
