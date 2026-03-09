import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma, Prisma } from "@gamepulse/shared/prisma";
import {
  ingestBatchSchema,
  ingestResponseSchema,
  eventsQuerySchema,
} from "@gamepulse/shared";
import { env } from "../config/env.js";
import { ingestionService } from "../services/ingestionService.js";

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // --- Ingestion: SDK-facing, API-key auth, rate limited, async ---
  r.post(
    "/events",
    {
      preHandler: [app.authenticateApiKey],
      config: {
        rateLimit: {
          max: env.INGEST_RATE_LIMIT_MAX,
          timeWindow: env.INGEST_RATE_LIMIT_WINDOW,
        },
      },
      schema: {
        tags: ["ingestion"],
        summary: "Ingest a batch of events (async, returns 202)",
        description:
          "Authenticated with the project API key via the `x-api-key` header. " +
          "Send an optional `Idempotency-Key` header to make retries safe.",
        security: [{ apiKey: [] }],
        headers: z.object({ "idempotency-key": z.string().optional() }).passthrough(),
        body: ingestBatchSchema,
        response: { 202: ingestResponseSchema },
      },
    },
    async (req, reply) => {
      const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
      const { response, replayed } = await ingestionService.enqueueBatch(
        req.apiKey!.projectId,
        req.body,
        idempotencyKey,
      );
      return reply.status(replayed ? 200 : 202).send(response);
    },
  );

  // --- Query: dashboard-facing, JWT auth, cursor paginated ---
  r.get(
    "/events",
    {
      preHandler: [app.authenticate, app.requireRole("READONLY")],
      schema: {
        tags: ["events"],
        summary: "List events for a project (cursor paginated)",
        security: [{ bearerAuth: [] }],
        querystring: eventsQuerySchema,
        response: {
          200: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                eventName: z.string(),
                playerId: z.string(),
                sessionId: z.string().nullable(),
                properties: z.any(),
                timestamp: z.date(),
              }),
            ),
            nextCursor: z.string().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const q = req.query;
      const where: Prisma.EventWhereInput = {
        projectId: q.projectId,
        ...(q.eventName ? { eventName: q.eventName } : {}),
        ...(q.playerId ? { player: { externalPlayerId: q.playerId } } : {}),
        ...(q.from || q.to
          ? { timestamp: { gte: q.from ? new Date(q.from) : undefined, lte: q.to ? new Date(q.to) : undefined } }
          : {}),
      };

      const rows = await prisma.event.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          eventName: true,
          playerId: true,
          sessionId: true,
          properties: true,
          timestamp: true,
        },
      });

      const hasMore = rows.length > q.limit;
      const data = hasMore ? rows.slice(0, q.limit) : rows;
      return { data, nextCursor: hasMore ? data[data.length - 1]!.id : null };
    },
  );
}
