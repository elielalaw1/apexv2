import { defineConfig } from "@playwright/test";
const port = Number(process.env.APEX_E2E_PORT ?? 3003);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Ogiltig testport");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1080 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `next ${process.env.APEX_E2E_PRODUCTION === "1" ? "start" : "dev"} --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    env: { APEX_DB_PATH: "data/browser-test.sqlite" },
    timeout: 120000,
  },
  reporter: "list",
});
