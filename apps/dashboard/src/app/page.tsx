"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { tokenStore } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(tokenStore.access ? "/overview" : "/login");
  }, [router]);
  return null;
}
