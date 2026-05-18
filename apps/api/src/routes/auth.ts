import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "@gamepulse/shared/prisma";
import {
  authTokensSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "@gamepulse/shared";
import { authService } from "../services/authService.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    "/register",
    {
      schema: {
        tags: ["auth"],
        summary: "Register a new user + organization",
        body: registerSchema,
        response: { 201: authTokensSchema },
        config: { public: true },
      },
    },
    async (req, reply) => {
      const tokens = await authService.register(req.body);
      return reply.status(201).send(tokens);
    },
  );

  r.post(
    "/login",
    {
      schema: {
        tags: ["auth"],
        summary: "Exchange credentials for tokens",
        body: loginSchema,
        response: { 200: authTokensSchema },
        config: { public: true },
      },
    },
    async (req) => authService.login(req.body),
  );

  r.post(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        summary: "Rotate refresh token for a new access token",
        body: refreshSchema,
        response: { 200: authTokensSchema },
        config: { public: true },
      },
    },
    async (req) => authService.refresh(req.body.refreshToken),
  );

  r.post(
    "/logout",
    {
      schema: {
        tags: ["auth"],
        summary: "Revoke a refresh token",
        body: refreshSchema,
        response: { 204: z.null() },
        config: { public: true },
      },
    },
    async (req, reply) => {
      await authService.logout(req.body.refreshToken);
      return reply.status(204).send(null);
    },
  );

  r.get(
    "/me",
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ["auth"],
        summary: "Current user + organizations",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable(),
            organizations: z.array(
              z.object({ id: z.string(), name: z.string(), role: z.string() }),
            ),
          }),
        },
      },
    },
    async (req) => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user!.userId },
        include: { memberships: { include: { organization: true } } },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        organizations: user.memberships.map((m) => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role,
        })),
      };
    },
  );
}
