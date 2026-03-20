import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@gamepulse/shared/prisma";
import { playersQuerySchema } from "@gamepulse/shared";

export async function playerRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/",
    {
      preHandler: [app.authenticate, app.requireRole("READONLY")],
      schema: {
        tags: ["players"],
        summary: "List players for a project (cursor paginated)",
        security: [{ bearerAuth: [] }],
        querystring: playersQuerySchema,
        response: {
          200: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                externalPlayerId: z.string(),
                firstSeenAt: z.date(),
                lastSeenAt: z.date(),
              }),
            ),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const { projectId, cursor, limit } = req.query;
      const rows = await prisma.player.findMany({
        where: { projectId },
        orderBy: { lastSeenAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, externalPlayerId: true, firstSeenAt: true, lastSeenAt: true },
      });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      return { data, nextCursor: hasMore ? data[data.length - 1]!.id : null };
    },
  );
}
