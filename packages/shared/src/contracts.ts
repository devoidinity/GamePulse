import { z } from "zod";
import { MAX_PAGE_SIZE } from "./constants.js";

// ---------------------------------------------------------------------------
// Event ingestion — the canonical wire contract shared by the SDK and the API.
// ---------------------------------------------------------------------------

/** A single property value allowed in an event payload. */
export const propertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const eventPropertiesSchema = z
  .record(propertyValueSchema)
  .default({});

export const ingestEventSchema = z.object({
  eventName: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_.:-]+$/, "eventName may only contain a-z0-9_.:-"),
  playerId: z.string().min(1).max(256),
  sessionId: z.string().min(1).max(256).optional(),
  timestamp: z
    .string()
    .datetime({ offset: true })
    .optional(), // server stamps now() when absent
  properties: eventPropertiesSchema,
  /** Optional client-generated id for cross-batch idempotency. */
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export type IngestEvent = z.infer<typeof ingestEventSchema>;

export const ingestBatchSchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(MAX_PAGE_SIZE),
});

export type IngestBatch = z.infer<typeof ingestBatchSchema>;

export const ingestResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  batchId: z.string(),
});

export type IngestResponse = z.infer<typeof ingestResponseSchema>;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(120).optional(),
  organizationName: z.string().min(1).max(120),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int(),
});

export type AuthTokens = z.infer<typeof authTokensSchema>;

// ---------------------------------------------------------------------------
// Shared query params
// ---------------------------------------------------------------------------

export const dateRangeSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

export const projectScopedQuery = z.object({
  projectId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Analytics query contracts
// ---------------------------------------------------------------------------

export const retentionQuerySchema = projectScopedQuery.merge(dateRangeSchema);

export const funnelQuerySchema = projectScopedQuery.merge(dateRangeSchema).extend({
  // Either reference a saved funnel by id, or pass ad-hoc ordered steps.
  funnelId: z.string().optional(),
  steps: z
    .union([z.array(z.string().min(1)).min(2), z.string()])
    .optional(),
});

export const progressionQuerySchema = projectScopedQuery
  .merge(dateRangeSchema)
  .extend({
    /** Event name that carries a numeric `level` property. */
    eventName: z.string().default("level_completed"),
    levelProperty: z.string().default("level"),
  });

export const economyQuerySchema = projectScopedQuery.merge(dateRangeSchema).extend({
  currency: z.string().optional(),
});

export const insightsQuerySchema = projectScopedQuery.extend({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]).optional(),
});

export const eventsQuerySchema = projectScopedQuery
  .merge(dateRangeSchema)
  .merge(paginationSchema)
  .extend({
    eventName: z.string().optional(),
    playerId: z.string().optional(),
  });

export const playersQuerySchema = projectScopedQuery.merge(paginationSchema);
