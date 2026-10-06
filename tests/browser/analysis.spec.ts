import { test, expect } from "@playwright/test";
import { demoBatches } from "../../src/core/demo";
test("API ingestion, linked charts, layout reload and workspace isolation", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Öppna demoprojekt" }).click();
  await expect(
    page.getByRole("heading", { name: "Analysyta", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chart")).toHaveCount(3);
  await expect(page.locator('[data-testid="data-gap"]').first()).toBeVisible();
  await expect(page.locator(".legend").first()).toContainText("bpm");
  await expect(page.locator(".legend").first()).toContainText("ms");
  await expect(page.locator(".chart").first()).toContainText("Arbete");
  const chart = page.locator(".chart").first();
  await chart.hover({ position: { x: 300, y: 90 } });
  await expect(page.locator('[data-testid="shared-cursor"]')).toHaveCount(3);
  const bounds = await chart.boundingBox();
  const markerX = await chart
    .locator('[data-testid="shared-cursor"] line')
    .evaluate((el) => el.getBoundingClientRect().x);
  expect(Math.abs(markerX - (bounds!.x + 300))).toBeLessThan(2);
  const before = await page.getByTestId("time-range").textContent();
  await page.getByRole("button", { name: "Zooma in", exact: true }).click();
  await expect(page.getByTestId("time-range")).not.toHaveText(before!);
  await page.getByRole("button", { name: "Hela passet", exact: true }).click();
  await page.getByLabel("Uppläggets namn").fill("Verifierat upplägg");
  await page
    .getByRole("button", { name: "Spara upplägg", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("sparat");
  await page.reload();
  await expect(page.getByLabel("Uppläggets namn")).toHaveValue(
    "Verifierat upplägg",
  );
  await expect(page.getByText("Hämtar…", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".chart").first().locator("path[vector-effect]"),
  ).toHaveCount(2);
  await page.screenshot({ path: "docs/analysis-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /^Sessioner/ }).click();
  await page
    .getByRole("button", { name: "Intervaller · morgon", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Datakvalitet" }),
  ).toBeVisible();
  await expect(page.locator(".quality-grid")).toContainText(
    "registrerade luckor",
  );
  const login = await request.post("/api/auth/login", {
    data: { email: "other@apexvip.local", password: "apex-demo-2026" },
  });
  const token = (await login.json()).token;
  const denied = await request.get(
    "/api/sessions/demo-session-1/series?signal=hr",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(denied.status()).toBe(404);
  const own = await request.post("/api/auth/login", {
    data: { email: "demo@apexvip.local", password: "apex-demo-2026" },
  });
  const ownToken = (await own.json()).token;
  const a = await request.post("/api/ingest", {
    data: demoBatches()[0],
    headers: { Authorization: `Bearer ${ownToken}` },
  });
  expect(a.ok()).toBeTruthy();
  expect((await a.json()).duplicate).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Analysyta", exact: true }).click();
  await expect(page.getByText("Hämtar…", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: "docs/analysis-mobile-web.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("Panel editing, duplication and time alignment retain configuration", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await page.getByRole("button", { name: "Öppna demoprojekt" }).click();
  await expect(page.locator(".chart")).toHaveCount(3);
  await page.getByRole("button", { name: "Duplicera", exact: true }).click();
  await page.getByLabel("Uppläggets namn").fill("Panelkontroll · kopia");
  await page
    .getByRole("button", { name: "Lägg till panel", exact: true })
    .click();
  await expect(page.locator(".panel-grid > section")).toHaveCount(4);
  await page.getByLabel("Panelnamn").fill("Tillfällig panel");
  await page
    .getByRole("combobox", { name: "Bredd", exact: true })
    .selectOption("2");
  await page.getByLabel("Visa panel", { exact: true }).uncheck();
  await expect(
    page.getByText("Panelen är dold.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ta bort panel", exact: true })
    .click();
  await expect(page.locator(".panel-grid > section")).toHaveCount(3);
  await page.getByLabel("Tidsjustering").selectOption("event");
  await page.getByLabel("Händelse", { exact: true }).fill("Saknad händelse");
  await expect(
    page.getByText(/Händelsen ”Saknad händelse” saknas/),
  ).toHaveCount(3);
  await page.getByLabel("Tidsjustering").selectOption("elapsed");
  await page
    .getByRole("button", { name: "Spara upplägg", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("sparat");
  await page.reload();
  await expect(page.getByLabel("Uppläggets namn")).toHaveValue(
    "Panelkontroll · kopia",
  );
  await expect(page.locator(".chart")).toHaveCount(3);
});
