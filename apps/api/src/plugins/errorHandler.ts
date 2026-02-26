import type { FastifyInstance } from "fastify";
import { AppError } from "@gamepulse/shared";
import { ZodError } from "zod";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

/** Maps domain + validation errors to a stable JSON envelope. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    // Zod request-validation errors (from the type provider).
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request does not match schema",
          details: error.validation,
        },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: error.issues,
        },
      });
    }

    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error });
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    // Fastify's own rate-limit error carries statusCode 429.
    if (error.statusCode === 429) {
      return reply.status(429).send({
        error: { code: "RATE_LIMITED", message: error.message },
      });
    }

    request.log.error({ err: error });
    return reply.status(error.statusCode ?? 500).send({
      error: {
        code: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : error.message,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: `Route ${request.method} ${request.url} not found` },
    });
  });
}
