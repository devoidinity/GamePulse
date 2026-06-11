import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "@gamepulse/shared/prisma";
import {
  ForbiddenError,
  UnauthorizedError,
  roleSatisfies,
  type Role,
} from "@gamepulse/shared";
import { verifyAccessToken } from "../lib/jwt.js";
import { hashApiKey, safeHashEqual } from "../lib/apiKey.js";
import { API_KEY_PREFIX } from "@gamepulse/shared";

export interface AuthedUser {
  userId: string;
  email: string;
}
export interface ApiKeyContext {
  projectId: string;
  organizationId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthedUser;
    apiKey?: ApiKeyContext;
    membershipRole?: Role;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateApiKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      min: Role,
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7);
}

/** Pull a projectId from params, query, or body for RBAC scoping. */
function extractProjectId(req: FastifyRequest): string | null {
  const fromParams = (req.params as Record<string, string> | undefined)?.projectId;
  const fromQuery = (req.query as Record<string, string> | undefined)?.projectId;
  const fromBody = (req.body as Record<string, string> | undefined)?.projectId;
  return fromParams ?? fromQuery ?? fromBody ?? null;
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  // --- Dashboard user auth (JWT bearer) ---
  app.decorate("authenticate", async (req: FastifyRequest) => {
    const token = bearer(req);
    if (!token) throw new UnauthorizedError("Missing bearer token");
    const claims = verifyAccessToken(token);
    req.user = { userId: claims.sub, email: claims.email };
  });

  // --- RBAC: requires a role >= min within the org owning the project ---
  app.decorate("requireRole", (min: Role) => async (req: FastifyRequest) => {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const projectId = extractProjectId(req);

    if (!projectId) {
      // No project scope (e.g. listing own projects): any membership passes,
      // but the route handler must still scope queries to the user's orgs.
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new ForbiddenError("Project not found or not accessible");

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.userId,
          organizationId: project.organizationId,
        },
      },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenError("Not a member of this organization");
    if (!roleSatisfies(membership.role, min)) {
      throw new ForbiddenError(`Requires ${min} role or higher`);
    }
    req.membershipRole = membership.role;
  });

  // --- SDK ingestion auth (API key) ---
  app.decorate("authenticateApiKey", async (req: FastifyRequest) => {
    const raw =
      (req.headers["x-api-key"] as string | undefined) ?? bearer(req) ?? "";
    if (!raw.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedError("Missing or malformed API key");
    }
    const prefix = raw.slice(0, API_KEY_PREFIX.length + 4);
    // Narrow by indexed prefix, then verify the full hash.
    const candidates = await prisma.apiKey.findMany({
      where: { prefix, revokedAt: null },
      select: { id: true, hashedKey: true, projectId: true, project: { select: { organizationId: true } } },
    });
    const hashed = hashApiKey(raw);
    // Constant-time hash comparison to avoid leaking key bytes via timing.
    const match = candidates.find((c) => safeHashEqual(c.hashedKey, hashed));
    if (!match) throw new UnauthorizedError("Invalid API key");

    req.apiKey = {
      projectId: match.projectId,
      organizationId: match.project.organizationId,
    };
    // Best-effort last-used stamp; never blocks ingestion.
    void prisma.apiKey
      .update({ where: { id: match.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  });
});
