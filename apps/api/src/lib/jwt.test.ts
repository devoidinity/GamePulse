import { describe, expect, it } from "vitest";
import { UnauthorizedError } from "@gamepulse/shared";
import { signAccessToken, verifyAccessToken } from "./jwt.js";

describe("jwt", () => {
  it("round-trips claims", () => {
    const token = signAccessToken({ sub: "user_1", email: "a@b.c" });
    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe("user_1");
    expect(claims.email).toBe("a@b.c");
  });

  it("rejects tampered tokens", () => {
    const token = signAccessToken({ sub: "u", email: "e" });
    expect(() => verifyAccessToken(token + "x")).toThrow(UnauthorizedError);
  });

  it("rejects garbage", () => {
    expect(() => verifyAccessToken("not.a.jwt")).toThrow(UnauthorizedError);
  });
});
