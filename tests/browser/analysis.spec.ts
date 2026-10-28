import { test, expect } from "@playwright/test";
import { demoBatches } from "../../src/core/demo";

test("Session-first analysis, signals, comparison, interval, exports and saved views", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.goto("/advanced");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your overview" }),
  ).toBeVisible();
  await expect(page.locator(".overview-summary")).toContainText("72");
  await expect(page.locator(".recent-session-button")).toHaveCount(4);
  await page.screenshot({
    path: test.info().outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: /P-014 Intervals · morning/ }).click();
  await expect(page.locator(".chart")).toHaveCount(1);
  await expect(page.locator(".legend")).toContainText("Heart rate");
  await expect(page.locator(".legend")).toContainText("bpm");
  await page.screenshot({
    path: test.info().outputPath("analysis-default.png"),
    fullPage: true,
  });
  await expect(page.getByTestId("data-gap").first()).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Customize chart" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Add signal", exact: true }).click();
  const picker = page.getByRole("region", { name: "Add signal" });
  await expect(picker).toContainText("RR interval");
  await expect(picker).not.toContainText("ECG");
  await expect(picker).not.toContainText("H10 acceleration");
  await picker
    .locator("div")
    .filter({ hasText: "RR interval" })
    .getByRole("button", { name: "Same chart", exact: true })
    .click();
  await expect(page.locator(".legend")).toContainText("ms");
  await page
    .getByRole("button", { name: "Compare sessions", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search comparison sessions" })
    .fill("P-014");
  await page
    .getByRole("checkbox", { name: /P-014 · Intervals · follow-up/ })
    .check();
  await page.getByRole("button", { name: "Done comparing" }).click();
  await expect(page.locator(".legend")).toContainText("Intervals · morning");
  await expect(page.locator(".legend")).toContainText("Intervals · follow-up");
  await page.getByRole("button", { name: "Add signal", exact: true }).click();
  await picker
    .locator("div")
    .filter({ hasText: "Phone acceleration" })
    .getByRole("button", { name: "Separate chart", exact: true })
    .click();
  await expect(page.locator(".chart")).toHaveCount(2);
  const chart = page.locator(".chart").first();
  await chart.hover({ position: { x: 300, y: 90 } });
  await expect(page.getByTestId("shared-cursor")).toHaveCount(2);
  await expect(page.locator(".cursor-values").first()).toContainText("bpm");
  const bounds = await chart.boundingBox();
  const markerX = await chart
    .locator('[data-testid="shared-cursor"] line')
    .evaluate((el) => el.getBoundingClientRect().x);
  expect(Math.abs(markerX - (bounds!.x + 300))).toBeLessThan(2);
  const range = await page.getByTestId("time-range").textContent();
  await page.mouse.move(bounds!.x + 180, bounds!.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 400, bounds!.y + 80);
  await page.mouse.up();
  await expect(
    page.getByRole("region", { name: "Selected interval statistics" }).first(),
  ).toContainText("Mean");
  await expect(page.getByTestId("time-range")).toHaveText(range!);
  await page.getByRole("button", { name: "Zoom to interval" }).first().click();
  await expect(page.getByTestId("time-range")).not.toHaveText(range!);
  await page.getByRole("button", { name: "Full session", exact: true }).click();
  await chart.locator('[role="button"]').first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".event-popover").first()).toContainText("Work");
  await page.getByRole("button", { name: "Close event" }).click();
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Customize chart" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close customization" }).click();
  await expect(page.getByTestId("time-range")).toHaveText(range!);
  await page.locator(".view-menu summary").click();
  await page
    .getByRole("textbox", { name: "Saved view name" })
    .fill("Coach comparison");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(page.locator(".alert[role=status]")).toContainText("saved");
  const jsonDownload = page.waitForEvent("download");
  await page
    .locator(".view-menu")
    .getByRole("button", { name: "Export view JSON" })
    .click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);
  await page.locator(".view-menu summary").click();
  await page.screenshot({
    path: test.info().outputPath("analysis-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Session details", exact: true })
    .first()
    .click();
  await expect(page.locator(".technical-details")).not.toHaveAttribute("open");
  await page.locator(".technical-details > summary").click();
  await expect(page.locator(".quality-grid")).toContainText("recorded gaps");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export raw CSV" }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/-raw\.csv$/);
  await page.getByRole("button", { name: "Back to sessions" }).click();
  await expect(page.locator(".chart")).toHaveCount(2);
  await page.reload();
  await page
    .getByRole("button", { name: "Open analysis", exact: true })
    .click();
  await expect(page.locator(".chart")).toHaveCount(1);
  await page.locator(".view-menu summary").click();
  await page
    .locator(".view-menu")
    .getByRole("combobox", { name: "Open saved view" })
    .selectOption({ label: "Coach comparison" });
  await expect(page.locator(".chart")).toHaveCount(2);
  const login = await request.post("/api/auth/login", {
    data: { email: "other@apexvip.local", password: "apex-demo-2026" },
  });
  const token = (await login.json()).token;
  expect(
    (
      await request.get("/api/sessions/demo-session-1/signals", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).status(),
  ).toBe(404);
  const own = await request.post("/api/auth/login", {
    data: { email: "demo@apexvip.local", password: "apex-demo-2026" },
  });
  const ownToken = (await own.json()).token;
  const retry = await request.post("/api/ingest", {
    data: demoBatches()[0],
    headers: { Authorization: `Bearer ${ownToken}` },
  });
  expect((await retry.json()).duplicate).toBe(true);
  await page.locator(".view-menu summary").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Loading…", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("analysis-mobile-web.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath("dashboard-mobile-web.png"),
    fullPage: true,
  });
  // Keyboard-only opening from the overview.
  await page.locator(".recent-session-button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".chart")).toHaveCount(1);
});

test("Filters, four-session comparison, advanced controls and immutable questionnaire versions", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.goto("/advanced");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await page.getByRole("button", { name: /^Sessions/ }).click();
  await page
    .getByRole("combobox", { name: "Participant filter" })
    .selectOption("P-014");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Intervals · morning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare sessions", exact: true })
    .click();
  for (const name of [
    /Endurance · test/,
    /Intervals · follow-up/,
    /Technique · recovery/,
  ])
    await page.getByRole("checkbox", { name }).check();
  await expect(page.locator(".compare-choice input:checked")).toHaveCount(4);
  await page.getByRole("button", { name: "Done comparing" }).click();
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page.getByLabel("Time alignment").selectOption("event");
  await page.getByLabel("Event", { exact: true }).fill("Missing event");
  await expect(
    page.getByText(/The event “Missing event” is missing/),
  ).toBeVisible();
  await page.getByLabel("Time alignment").selectOption("elapsed");
  await page
    .getByRole("dialog", { name: "Customize chart" })
    .getByText("Style and layout", { exact: true })
    .click();
  await page.getByLabel("Show chart", { exact: true }).uncheck();
  await expect(page.getByText(/This chart is hidden/)).toBeVisible();
  await page.getByLabel("Show chart", { exact: true }).check();
  await page.getByRole("button", { name: "Close customization" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Questionnaire definition JSON" }),
  ).not.toBeVisible();
  await page.locator(".template-row").first().click();
  await page
    .getByRole("textbox", { name: "Question text" })
    .first()
    .fill("Readiness before exercise");
  await page
    .getByRole("button", { name: "Save questionnaire version" })
    .click();
  await expect(page.locator(".alert[role=status]")).toContainText("saved");
  const credentials = await request.post("/api/auth/login", {
    data: { email: "demo@apexvip.local", password: "apex-demo-2026" },
  });
  const authToken = (await credentials.json()).token;
  const templates = await (
    await request.get("/api/templates", {
      headers: { Authorization: `Bearer ${authToken}` },
    })
  ).json();
  expect(
    templates.some(
      (t: any) => t.version === 1 && t.questions[0].label === "Beredskap",
    ),
  ).toBe(true);
  expect(
    templates.some(
      (t: any) =>
        t.version > 1 && t.questions[0].label === "Readiness before exercise",
    ),
  ).toBe(true);
});
