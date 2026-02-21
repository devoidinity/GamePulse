import { describe, expect, it } from "vitest";
import { ingestBatchSchema, ingestEventSchema } from "./contracts.js";
import { roleSatisfies, ROLE_RANK } from "./roles.js";

describe("ingestEventSchema", () => {
  it("accepts a valid event and defaults properties to {}", () => {
    const parsed = ingestEventSchema.parse({
      eventName: "ore_mined",
      playerId: "player-123",
    });
    expect(parsed.properties).toEqual({});
  });

  it("rejects illegal event names", () => {
    expect(() =>
      ingestEventSchema.parse({ eventName: "bad name!", playerId: "p1" }),
    ).toThrow();
  });

  it("rejects nested object properties", () => {
    expect(() =>
      ingestEventSchema.parse({
        eventName: "x",
        playerId: "p1",
        properties: { nested: { a: 1 } },
      }),
    ).toThrow();
  });
});

describe("ingestBatchSchema", () => {
  it("requires at least one event", () => {
    expect(() => ingestBatchSchema.parse({ events: [] })).toThrow();
  });
});

describe("roles", () => {
  it("orders privileges OWNER > ADMIN > ANALYST > READONLY", () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.ANALYST);
    expect(ROLE_RANK.ANALYST).toBeGreaterThan(ROLE_RANK.READONLY);
  });

  it("roleSatisfies respects the hierarchy", () => {
    expect(roleSatisfies("ADMIN", "ANALYST")).toBe(true);
    expect(roleSatisfies("READONLY", "ANALYST")).toBe(false);
    expect(roleSatisfies("OWNER", "OWNER")).toBe(true);
  });
});
