import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX } from "@gamepulse/shared";
import { generateApiKey, hashApiKey, safeHashEqual } from "./apiKey.js";

describe("apiKey", () => {
  it("generates a prefixed key whose hash verifies", () => {
    const key = generateApiKey();
    expect(key.raw.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.prefix).toBe(key.raw.slice(0, API_KEY_PREFIX.length + 4));
    expect(hashApiKey(key.raw)).toBe(key.hashedKey);
  });

  it("produces unique keys", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });

  it("safeHashEqual compares digests in constant time", () => {
    const h = hashApiKey("gp_live_abc");
    expect(safeHashEqual(h, h)).toBe(true);
    expect(safeHashEqual(h, hashApiKey("gp_live_xyz"))).toBe(false);
  });
});
