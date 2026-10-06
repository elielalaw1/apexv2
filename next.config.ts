import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["node:sqlite"],
  experimental: { cpus: 2 },
};
export default config;
