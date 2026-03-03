import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { projectService } from "../services/projectService.js";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  organizationId: z.string(),
  apiKeyPrefix: z.string().nullable(),
  createdAt: z.date(),
});

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["projects"],
        summary: "List projects in the caller's organizations",
        security: [{ bearerAuth: [] }],
        response: { 200: z.object({ data: z.array(projectSchema) }) },
      },
    },
    async (req) => ({ data: await projectService.listForUser(req.user!.userId) }),
  );

  r.post(
    "/",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["projects"],
        summary: "Create a project (returns the API key once)",
        security: [{ bearerAuth: [] }],
        body: z.object({ organizationId: z.string(), name: z.string().min(1).max(120) }),
        response: { 201: projectSchema.extend({ apiKey: z.string() }) },
      },
    },
    async (req, reply) => {
      const project = await projectService.create(req.user!.userId, req.body);
      return reply.status(201).send(project);
    },
  );

  r.post(
    "/:projectId/rotate-key",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["projects"],
        summary: "Rotate the project ingestion API key",
        security: [{ bearerAuth: [] }],
        params: z.object({ projectId: z.string() }),
        response: { 200: z.object({ apiKey: z.string(), prefix: z.string() }) },
      },
    },
    async (req) => projectService.rotateApiKey(req.user!.userId, req.params.projectId),
  );
}
