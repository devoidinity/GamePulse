import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { API_KEY_PREFIX } from "@gamepulse/shared";

export interface GeneratedApiKey {
  /** Full secret, shown to the user exactly once. */
  raw: string;
  /** Public prefix stored for display + indexed lookup. */
  prefix: string;
  /** sha256(raw) stored in the DB. */
  hashedKey: string;
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const raw = `${API_KEY_PREFIX}${randomBytes(18).toString("hex")}`;
  return {
    raw,
    prefix: raw.slice(0, API_KEY_PREFIX.length + 4),
    hashedKey: hashApiKey(raw),
  };
}

/** Constant-time comparison of two hex digests. */
export function safeHashEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
