import { createHash, randomBytes } from "node:crypto";
import { prisma, type User } from "@gamepulse/shared/prisma";
import {
  ConflictError,
  UnauthorizedError,
  type AuthTokens,
} from "@gamepulse/shared";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccessToken } from "../lib/jwt.js";
import { env } from "../config/env.js";

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function issueTokens(user: Pick<User, "id" | "email">): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email });

  const refreshToken = randomBytes(48).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL * 1000),
    },
  });

  return { accessToken, refreshToken, expiresIn: env.JWT_ACCESS_TTL };
}

export const authService = {
  async register(input: {
    email: string;
    password: string;
    name?: string;
    organizationName: string;
  }): Promise<AuthTokens> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing) throw new ConflictError("Email already registered");

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        name: input.name,
        // First user owns a freshly created organization.
        memberships: {
          create: {
            role: "OWNER",
            organization: { create: { name: input.organizationName } },
          },
        },
      },
    });

    return issueTokens(user);
  },

  async login(input: { email: string; password: string }): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Always run a hash compare to avoid user-enumeration timing leaks.
    const ok = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, "$2a$10$invalidinvalidinvalidinvalidinv");
    if (!user || !ok) throw new UnauthorizedError("Invalid credentials");
    return issueTokens(user);
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(refreshToken);
    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
    // Rotate: revoke the used token, issue a fresh pair.
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return issueTokens(record.user);
  },

  async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
