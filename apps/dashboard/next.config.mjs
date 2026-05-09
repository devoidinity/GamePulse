import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@gamepulse/shared"],
  output: "standalone",
  // Trace from the monorepo root so the standalone bundle resolves workspace
  // packages and emits server.js at apps/dashboard/server.js.
  outputFileTracingRoot: join(__dirname, "../../"),
};

export default nextConfig;
