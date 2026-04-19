"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { tokenStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/misc";
import { Activity } from "lucide-react";

type Tokens = { accessToken: string; refreshToken: string };

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@gamepulse.dev");
  const [password, setPassword] = useState("password123");
  const [org, setOrg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens =
        mode === "login"
          ? await api<Tokens>("/api/v1/auth/login", { auth: false, method: "POST", body: { email, password } })
          : await api<Tokens>("/api/v1/auth/register", {
              auth: false,
              method: "POST",
              body: { email, password, organizationName: org || "My Studio" },
            });
      tokenStore.set(tokens.accessToken, tokens.refreshToken);
      router.replace("/overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6" />
            <span className="text-lg font-bold">GamePulse</span>
          </div>
          <CardTitle>{mode === "login" ? "Sign in" : "Create account"}</CardTitle>
          <CardDescription>Game telemetry & analytics dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode === "register" && (
              <Input placeholder="Organization name" value={org} onChange={(e) => setOrg(e.target.value)} />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
