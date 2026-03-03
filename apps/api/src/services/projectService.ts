import { prisma } from "@gamepulse/shared/prisma";
import { ForbiddenError, NotFoundError, roleSatisfies, type Role } from "@gamepulse/shared";
import { generateApiKey } from "../lib/apiKey.js";

/** Throws unless the user has >= `min` role in the organization. */
async function assertOrgRole(userId: string, organizationId: string, min: Role) {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { role: true },
  });
  if (!membership) throw new ForbiddenError("Not a member of this organization");
  if (!roleSatisfies(membership.role, min)) {
    throw new ForbiddenError(`Requires ${min} role or higher`);
  }
}

export const projectService = {
  async listForUser(userId: string) {
    return prisma.project.findMany({
      where: { organization: { memberships: { some: { userId } } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        organizationId: true,
        apiKeyPrefix: true,
        createdAt: true,
      },
    });
  },

  async create(userId: string, input: { organizationId: string; name: string }) {
    await assertOrgRole(userId, input.organizationId, "ADMIN");
    const key = generateApiKey();
    const project = await prisma.project.create({
      data: {
        name: input.name,
        organizationId: input.organizationId,
        apiKeyPrefix: key.prefix,
        apiKeys: { create: { name: "default", prefix: key.prefix, hashedKey: key.hashedKey } },
      },
      select: { id: true, name: true, organizationId: true, apiKeyPrefix: true, createdAt: true },
    });
    // Raw key returned exactly once.
    return { ...project, apiKey: key.raw };
  },

  async rotateApiKey(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundError("Project not found");
    await assertOrgRole(userId, project.organizationId, "ADMIN");

    const key = generateApiKey();
    await prisma.$transaction([
      prisma.apiKey.updateMany({
        where: { projectId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.apiKey.create({
        data: { projectId, name: "default", prefix: key.prefix, hashedKey: key.hashedKey },
      }),
      prisma.project.update({ where: { id: projectId }, data: { apiKeyPrefix: key.prefix } }),
    ]);
    return { apiKey: key.raw, prefix: key.prefix };
  },
};
