/**
 * End-to-end API tests with Supertest. These need a live Postgres + Redis and
 * an applied schema, so they only run when RUN_INTEGRATION=1:
 *
 *   docker compose up -d postgres redis
 *   npm run db:deploy -w @gamepulse/shared
 *   RUN_INTEGRATION=1 npm test -w @gamepulse/api
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

const run = process.env.RUN_INTEGRATION === "1";

describe.runIf(run)("API integration", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let projectId: string;
  let apiKey: string;
  const email = `test+${Date.now()}@gamepulse.dev`;

  beforeAll(async () => {
    const { buildApp } = await import("../src/app.js");
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("registers a new user + org", async () => {
    const res = await request(app.server)
      .post("/api/v1/auth/register")
      .send({ email, password: "password123", organizationName: "Test Studio" });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
  });

  it("rejects unauthenticated project listing", async () => {
    const res = await request(app.server).get("/api/v1/projects");
    expect(res.status).toBe(401);
  });

  it("creates a project and reveals the API key once", async () => {
    const me = await request(app.server)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${accessToken}`);
    const orgId = me.body.organizations[0].id;

    const res = await request(app.server)
      .post("/api/v1/projects")
      .set("authorization", `Bearer ${accessToken}`)
      .send({ organizationId: orgId, name: "My Game" });
    expect(res.status).toBe(201);
    expect(res.body.apiKey).toMatch(/^gp_live_/);
    projectId = res.body.id;
    apiKey = res.body.apiKey;
  });

  it("ingests a batch (202) and validates the body", async () => {
    const ok = await request(app.server)
      .post("/api/v1/events")
      .set("x-api-key", apiKey)
      .send({ events: [{ eventName: "ore_mined", playerId: "p1", properties: { amount: 10 } }] });
    expect(ok.status).toBe(202);
    expect(ok.body.accepted).toBe(1);

    const bad = await request(app.server)
      .post("/api/v1/events")
      .set("x-api-key", apiKey)
      .send({ events: [{ eventName: "bad name!", playerId: "p1" }] });
    expect(bad.status).toBe(400);
  });

  it("rejects ingestion with a bad API key", async () => {
    const res = await request(app.server)
      .post("/api/v1/events")
      .set("x-api-key", "gp_live_nope")
      .send({ events: [{ eventName: "x", playerId: "p1" }] });
    expect(res.status).toBe(401);
  });

  it("serves overview metrics for the project", async () => {
    const res = await request(app.server)
      .get("/api/v1/overview")
      .query({ projectId })
      .set("authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("dau");
    expect(res.body).toHaveProperty("retention");
  });
});
