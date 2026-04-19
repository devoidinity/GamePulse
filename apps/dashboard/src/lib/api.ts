"use client";

import { tokenStore } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  auth?: boolean;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokenStore.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true } = opts;
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const send = async (): Promise<Response> => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth && tokenStore.access) headers.authorization = `Bearer ${tokenStore.access}`;
    return fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await send();
  if (res.status === 401 && auth && (await tryRefresh())) {
    res = await send();
  }

  if (!res.ok) {
    let code = "ERROR";
    let message = res.statusText;
    try {
      const j = (await res.json()) as { error?: { code: string; message: string } };
      if (j.error) {
        code = j.error.code;
        message = j.error.message;
      }
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) tokenStore.clear();
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
