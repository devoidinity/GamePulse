import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@gamepulse/shared/prisma";
import { insightsQuerySchema } from "@gamepulse/shared";

const insightSchema = z.object({
  id: z.string(),
  type: z.string(),
  severity: z.string(),
  status: z.string(),
  title: z.string(),
  body: z.string(),
  data: z.any(),
  detectedAt: z.date(),
});

export async function insightRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/insights",
    {
      preHandler: [app.authenticate, app.requireRole("READONLY")],
      schema: {
        tags: ["insights"],
        summary: "List automated insights for a project",
        security: [{ bearerAuth: [] }],
        querystring: insightsQuerySchema,
        response: { 200: z.object({ data: z.array(insightSchema) }) },
      },
    },
    async (req) => {
      const data = await prisma.insight.findMany({
        where: {
          projectId: req.query.projectId,
          ...(req.query.status ? { status: req.query.status } : {}),
        },
        orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      });
      return { data };
    },
  );

  r.patch(
    "/insights/:id",
    {
      preHandler: [app.authenticate, app.requireRole("ANALYST")],
      schema: {
        tags: ["insights"],
        summary: "Acknowledge or resolve an insight",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        body: z.object({ projectId: z.string(), status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]) }),
        response: { 200: insightSchema },
      },
    },
    async (req) => {
      // updateMany scopes by projectId so the RBAC guard's project applies.
      await prisma.insight.updateMany({
        where: { id: req.params.id, projectId: req.body.projectId },
        data: { status: req.body.status },
      });
      return prisma.insight.findUniqueOrThrow({ where: { id: req.params.id } });
    },
  );
}
