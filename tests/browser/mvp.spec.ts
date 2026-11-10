import { test, expect } from "@playwright/test";
import { defaultTemplate, Session } from "../../src/core/contract";
import { fullSignalFixture } from "../../src/core/polarFixture";
import { readFile } from "node:fs/promises";

test("No-login recording upload, session grouping, dashboard drag, preferences and CSV", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const template = {
    ...defaultTemplate,
    id: "mvp-browser",
    version: 1,
    questions: [],
    eventLabels: [],
  };
  expect(
    (await request.post("/api/mvp/templates", { data: template })).ok(),
  ).toBeTruthy();
  const startedAt = 1794340000000;
  const samples = fullSignalFixture(startedAt);
  for (const [id, name] of [
    ["mvp-eli", "Eli"],
    ["mvp-martins", "Martins"],
  ]) {
    const session: Session = {
      id,
      participantId: id,
      participantLabel: name,
      title: "MVP comparison",
      typeId: template.id,
      typeVersion: 1,
      startedAt,
      durationMs: 60000,
      demo: true,
      source: "mobile-synthetic-v2",
      timePolicy: "sensor-relative-v1",
      state: "ended",
      events: [],
    };
    for (let i = 0; i < samples.length; i += 500) {
      const r = await request.post("/api/mvp/ingest", {
        data: {
          version: 1,
          batchId: `${id}-${i}`,
          session,
          samples: samples.slice(i, i + 500),
        },
      });
      expect(r.ok(), await r.text()).toBeTruthy();
    }
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sessions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("mvp-sessions.png"),
    fullPage: true,
  });
  await page
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", { name: "MVP comparison", exact: true }),
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Eli", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Martins", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("mvp-participants.png"),
    fullPage: true,
  });
  await page
    .locator(".mvp-session-card")
    .filter({ has: page.getByRole("heading", { name: "Eli", exact: true }) })
    .getByRole("link")
    .click();
  await expect(page.locator(".canvas-card")).toHaveCount(8);
  await expect(page.locator(".chart")).toHaveCount(8);
  await expect(page.locator('.chart path[fill="none"]').first()).toBeVisible();
  // A real pointer drag is available without first entering customization.
  const handle = page.getByRole("button", {
    name: "Drag Heart rate",
    exact: true,
  });
  const target = page.locator('[data-card-id="chart-rr"]');
  await handle.scrollIntoViewIfNeeded();
  const a = await handle.boundingBox();
  const b = await target.boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + 180, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator(".canvas-card")).toHaveCount(7);
  await expect(
    page.getByRole("heading", {
      name: "RR interval + Heart rate",
      exact: true,
    }),
  ).toBeVisible();
  await expect(target.locator(".legend")).toContainText("bpm");
  await expect(target.locator(".legend")).toContainText("ms");
  await page.screenshot({
    path: test.info().outputPath("mvp-overlay.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".canvas-card")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Separate graphs", exact: true })
    .click();
  await expect(page.locator(".canvas-card")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page.screenshot({
    path: test.info().outputPath("mvp-customize.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox", { name: "ECG", exact: true }).uncheck();
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(page.locator(".canvas-card")).toHaveCount(7);
  await page.reload();
  await expect(page.locator(".canvas-card")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore default", exact: true })
    .click();
  await expect(page.locator(".canvas-card")).toHaveCount(8);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csv = await readFile((await (await pending).path())!, "utf8");
  expect(csv.trim().split("\n")).toHaveLength(samples.length + 1);
  expect(
    new Set(
      csv
        .trim()
        .split("\n")
        .slice(1)
        .map((row) => row.split(",").slice(0, 2).join(":")),
    ).size,
  ).toBe(samples.length);
  await page.screenshot({
    path: test.info().outputPath("mvp-dashboard.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Eli", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: test.info().outputPath("mvp-mobile-web.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "MVP comparison · Participants", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Martins", exact: true }),
  ).toBeVisible();
});

test("Direct links, missing samples, keyboard layout choices and cancel", async ({
  page,
  request,
}) => {
  await page.goto("/?session=not-a-session");
  await expect(
    page.getByRole("heading", { name: "Recording unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All sessions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sessions", exact: true }),
  ).toBeVisible();
  await page.goto("/?session=mvp-eli");
  await expect(page.locator(".canvas-card")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "ECG", exact: true }).uncheck();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator(".canvas-card")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Combine Heart rate with", exact: true })
    .selectOption("chart-rr");
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(page.locator(".canvas-card")).toHaveCount(7);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Full session", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full session", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore default", exact: true })
    .click();
  const rows = await (await request.get("/api/mvp/sessions")).json();
  const empty = {
    ...rows.find((s: Session) => s.id === "mvp-eli"),
    id: "mvp-empty",
    title: "Empty upload",
    events: [],
  };
  expect(
    (
      await request.post("/api/mvp/ingest", {
        data: {
          version: 1,
          batchId: "mvp-empty-0",
          session: empty,
          samples: [],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/?session=mvp-empty");
  await expect(
    page.getByRole("heading", { name: "No signals yet" }),
  ).toBeVisible();
});
