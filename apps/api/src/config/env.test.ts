import { describe, expect, it } from "vitest";
import { apiEnvSchemaChecked } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
};

describe("production JWT secret guard", () => {
  it("rejects the example/default secrets in production", () => {
    const res = apiEnvSchemaChecked.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "dev-access-secret-change-me-in-production-please",
      JWT_REFRESH_SECRET: "dev-refresh-secret-change-me-in-production-please",
    });
    expect(res.success).toBe(false);
  });

  it("rejects short or duplicated secrets in production", () => {
    const short = apiEnvSchemaChecked.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "tooshort",
      JWT_REFRESH_SECRET: "tooshort",
    });
    expect(short.success).toBe(false);

    const dup = "x".repeat(40);
    const duplicated = apiEnvSchemaChecked.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: dup,
      JWT_REFRESH_SECRET: dup,
    });
    expect(duplicated.success).toBe(false);
  });

  it("accepts strong, distinct secrets in production", () => {
    const res = apiEnvSchemaChecked.safeParse({
      ...base,
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(48),
      JWT_REFRESH_SECRET: "b".repeat(48),
    });
    expect(res.success).toBe(true);
  });

  it("stays lenient in development", () => {
    const res = apiEnvSchemaChecked.safeParse({
      ...base,
      NODE_ENV: "development",
      JWT_ACCESS_SECRET: "short-dev-secret-16ch",
      JWT_REFRESH_SECRET: "short-dev-secret-16ch",
    });
    expect(res.success).toBe(true);
  });
});
