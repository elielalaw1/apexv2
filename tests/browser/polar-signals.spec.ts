import { test, expect } from "@playwright/test";
import {
  fullSignalFixture,
  fullSignalCounts,
} from "../../src/core/polarFixture";
import { defaultTemplate, Session, signals } from "../../src/core/contract";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
test("Uploaded full-signal mobile session opens every raw H10 axis, ECG and CSV", async ({
  page,
  request,
}) => {
  // Separate workspace prevents interference with the empty-workspace browser tests.
  await request.post("/api/auth/login", {
    data: { email: "demo@apexvip.local", password: "apex-demo-2026" },
  });
  execFileSync(process.execPath, [
    "-e",
    `
    const { DatabaseSync } = require('node:sqlite');
    const { scryptSync } = require('node:crypto');
    const db = new DatabaseSync('data/browser-test.sqlite');
    db.exec('PRAGMA busy_timeout=5000');
    const password = 'polar-test-salt:' + scryptSync('apex-demo-2026', 'polar-test-salt', 64).toString('hex');
    db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?)').run('polar-browser', 'polar-test@apexvip.local', password, 'polar-browser-lab');
    db.close();
  `,
  ]);
  const login = await request.post("/api/auth/login", {
    data: { email: "polar-test@apexvip.local", password: "apex-demo-2026" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const definition = await request.post("/api/templates", {
    headers,
    data: defaultTemplate,
  });
  expect(definition.ok()).toBeTruthy();
  const startedAt = 1700000000000;
  const session: Session = {
    id: "browser-polar-full",
    participantId: "POLAR-TEST",
    participantLabel: "POLAR-TEST",
    title: "H10 full signal transfer test",
    typeId: defaultTemplate.id,
    typeVersion: defaultTemplate.version,
    startedAt,
    durationMs: 60000,
    demo: true,
    source: "mobile-synthetic-v2",
    timePolicy: "sensor-relative-v1",
    state: "ended",
    events: [],
  };
  const samples = fullSignalFixture(startedAt);
  for (let offset = 0; offset < samples.length; offset += 500) {
    const response = await request.post("/api/ingest", {
      headers,
      data: {
        version: 1,
        batchId: `browser-polar-${offset}`,
        session,
        samples: samples.slice(offset, offset + 500),
      },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.goto(`/?session=${session.id}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill("polar-test@apexvip.local");
  await page.getByLabel("Password", { exact: true }).fill("apex-demo-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: session.title, exact: true }),
  ).toBeVisible();
  for (const kind of Object.keys(
    fullSignalCounts,
  ) as (keyof typeof fullSignalCounts)[]) {
    await page
      .getByRole("tab", { name: signals[kind].name, exact: true })
      .click();
    await expect(page.locator(".legend")).toContainText(signals[kind].name);
    await expect(page.locator(".simple-signal-stats")).not.toContainText("—");
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await pending;
  const csv = await readFile((await download.path())!, "utf8");
  const rows = csv.trim().split(/\r?\n/);
  expect(rows.length).toBe(samples.length + 1);
  for (const kind of Object.keys(fullSignalCounts)) expect(csv).toContain(kind);
  expect(csv).toContain("900000000");
});
