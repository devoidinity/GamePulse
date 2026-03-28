import { describe, expect, it } from "vitest";
import {
  evaluateDeadContent,
  evaluateInflation,
  evaluateLevelDropoff,
  evaluateUnspentCurrency,
} from "./rules.js";

describe("evaluateDeadContent", () => {
  it("flags items below the 1% adoption threshold", () => {
    const out = evaluateDeadContent(
      [
        { name: "drill_mk1", adoptionRate: 0.6, players: 600 },
        { name: "legendary", adoptionRate: 0.004, players: 4 },
      ],
      "upgrade",
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.fingerprint).toBe("dead_upgrade:legendary");
    expect(out[0]!.type).toBe("DEAD_UPGRADE");
  });
});

describe("evaluateLevelDropoff", () => {
  it("flags an outlier level and marks >=60% as CRITICAL", () => {
    const out = evaluateLevelDropoff([
      { level: 6, reached: 100, dropOff: 0.1 },
      { level: 7, reached: 100, dropOff: 0.12 },
      { level: 8, reached: 100, dropOff: 0.65 },
      { level: 9, reached: 100, dropOff: 0.1 },
    ]);
    expect(out.map((o) => o.data.level)).toContain(8);
    expect(out.find((o) => o.data.level === 8)!.severity).toBe("CRITICAL");
  });

  it("ignores levels with too little traffic", () => {
    expect(
      evaluateLevelDropoff([{ level: 1, reached: 5, dropOff: 0.9 }]),
    ).toHaveLength(0);
  });
});

describe("evaluateUnspentCurrency", () => {
  it("flags hoarded currencies", () => {
    const out = evaluateUnspentCurrency([
      { currency: "gold", earned: 1000, spent: 700 },
      { currency: "gems", earned: 1000, spent: 10 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.data.currency).toBe("gems");
  });
});

describe("evaluateInflation", () => {
  it("flags >25% accumulation growth", () => {
    const out = evaluateInflation([
      { currency: "gold", firstHalf: 1000, secondHalf: 1430 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe("ECONOMY_INFLATION");
  });
});
