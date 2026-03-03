import jwt from "jsonwebtoken";
import { UnauthorizedError } from "@gamepulse/shared";
import { env } from "../config/env.js";

export interface AccessTokenClaims {
  sub: string; // userId
  email: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === "string") throw new Error("unexpected token");
    return { sub: decoded.sub as string, email: decoded.email as string };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
