import { describe, expect, it } from "vitest";
import { ratio, resolveRange, round } from "./util.js";

describe("analytics util", () => {
  it("ratio guards divide-by-zero", () => {
    expect(ratio(5, 10)).toBe(0.5);
    expect(ratio(5, 0)).toBe(0);
  });

  it("round respects decimal places", () => {
    expect(round(0.123456, 2)).toBe(0.12);
    expect(round(0.123456, 4)).toBe(0.1235);
  });

  it("resolveRange defaults to a trailing window", () => {
    const { from, to } = resolveRange(undefined, undefined, 7);
    expect(to.getTime() - from.getTime()).toBeCloseTo(7 * 86_400_000, -3);
  });

  it("resolveRange honours explicit bounds", () => {
    const { from, to } = resolveRange("2026-01-01T00:00:00Z", "2026-01-08T00:00:00Z");
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});
