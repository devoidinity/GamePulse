import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@gamepulse/shared/prisma";
import {
  economyQuerySchema,
  funnelQuerySchema,
  progressionQuerySchema,
  projectScopedQuery,
  retentionQuerySchema,
} from "@gamepulse/shared";
import { getOverview } from "../../services/analytics/overviewService.js";
import { getRetention } from "../../services/analytics/retentionService.js";
import { getFunnel } from "../../services/analytics/funnelService.js";
import { getProgression } from "../../services/analytics/progressionService.js";
import { getEconomy } from "../../services/analytics/economyService.js";
import { getIdle } from "../../services/analytics/idleService.js";

const dateRange = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  // Every analytics route is project-scoped, JWT-authed, ANALYST+.
  const guard = { preHandler: [app.authenticate, app.requireRole("READONLY")] };

  r.get(
    "/overview",
    { ...guard, schema: { tags: ["analytics"], summary: "Top-line metrics", security: [{ bearerAuth: [] }], querystring: projectScopedQuery.merge(dateRange), response: { 200: z.any() } } },
    async (req) => getOverview(req.query.projectId, req.query.from, req.query.to),
  );

  r.get(
    "/retention",
    { ...guard, schema: { tags: ["analytics"], summary: "Cohort retention (D1..D30)", security: [{ bearerAuth: [] }], querystring: retentionQuerySchema, response: { 200: z.any() } } },
    async (req) => getRetention(req.query.projectId, req.query.from, req.query.to),
  );

  r.get(
    "/funnels",
    { ...guard, schema: { tags: ["analytics"], summary: "Funnel conversion / drop-off", security: [{ bearerAuth: [] }], querystring: funnelQuerySchema, response: { 200: z.any() } } },
    async (req) =>
      getFunnel({
        projectId: req.query.projectId,
        funnelId: req.query.funnelId,
        steps: req.query.steps,
        from: req.query.from,
        to: req.query.to,
      }),
  );

  // Saved funnels CRUD (lightweight).
  r.post(
    "/funnels",
    { preHandler: [app.authenticate, app.requireRole("ANALYST")], schema: { tags: ["analytics"], summary: "Create a saved funnel", security: [{ bearerAuth: [] }], body: z.object({ projectId: z.string(), name: z.string().min(1), steps: z.array(z.string().min(1)).min(2) }), response: { 201: z.any() } } },
    async (req, reply) => {
      const f = await prisma.funnel.create({ data: { projectId: req.body.projectId, name: req.body.name, steps: req.body.steps } });
      return reply.status(201).send(f);
    },
  );

  r.get(
    "/progression",
    { ...guard, schema: { tags: ["analytics"], summary: "Level completion / drop-off", security: [{ bearerAuth: [] }], querystring: progressionQuerySchema, response: { 200: z.any() } } },
    async (req) =>
      getProgression({
        projectId: req.query.projectId,
        eventName: req.query.eventName,
        levelProperty: req.query.levelProperty,
        from: req.query.from,
        to: req.query.to,
      }),
  );

  r.get(
    "/economy",
    { ...guard, schema: { tags: ["analytics"], summary: "Currency sources/sinks/balances/inflation", security: [{ bearerAuth: [] }], querystring: economyQuerySchema, response: { 200: z.any() } } },
    async (req) =>
      getEconomy({ projectId: req.query.projectId, currency: req.query.currency, from: req.query.from, to: req.query.to }),
  );

  r.get(
    "/idle",
    { ...guard, schema: { tags: ["analytics"], summary: "Idle generator/upgrade adoption + dead content", security: [{ bearerAuth: [] }], querystring: projectScopedQuery.merge(dateRange), response: { 200: z.any() } } },
    async (req) => getIdle({ projectId: req.query.projectId, from: req.query.from, to: req.query.to }),
  );
}
