import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

/**
 * Registers OpenAPI generation (driven by the Zod route schemas) and the
 * Swagger UI at /docs. The raw document is at /docs/json.
 */
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "GamePulse API",
        description:
          "Self-hosted, game-focused telemetry & analytics. Ingest events with " +
          "a project API key; query analytics with a user JWT.",
        version: "0.1.0",
      },
      servers: [{ url: "/", description: "current host" }],
      tags: [
        { name: "auth", description: "Authentication & sessions" },
        { name: "projects", description: "Projects & API keys" },
        { name: "ingestion", description: "Event ingestion (SDK)" },
        { name: "events", description: "Event querying" },
        { name: "players", description: "Players" },
        { name: "analytics", description: "Retention, funnels, progression, economy, idle" },
        { name: "insights", description: "Automated insights" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
}
