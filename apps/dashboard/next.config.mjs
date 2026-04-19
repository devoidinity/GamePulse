/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // shared is a workspace TS package consumed directly.
  transpilePackages: ["@gamepulse/shared"],
  output: "standalone",
};

export default nextConfig;
