import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // env.ts validates + exits on missing vars at import time; supply test
    // defaults so unit tests can import modules that pull in config.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://gamepulse:gamepulse@localhost:5432/gamepulse_test?schema=public",
      REDIS_URL: "redis://localhost:6379",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789",
      JWT_REFRESH_SECRET: "test-refresh-secret-0123456789",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
