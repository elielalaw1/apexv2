import type { NextConfig } from "next";
const config: NextConfig = {
  distDir:
    process.env.APEX_E2E_ISOLATED === "1" ? ".next-browser-tests" : ".next",
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["node:sqlite"],
  experimental: { cpus: 2 },
};
export default config;
