import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("Simple review: filters, signals, zoom, export, history and reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Sessions 4" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "Customize", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "docs/simple-sessions-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Participant", exact: true })
    .selectOption("P-014");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Clear filters" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search sessions" })
    .fill("unknown");
  await expect(
    page.getByRole("heading", { name: "No matching sessions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search sessions" }),
  ).toBeFocused();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  // The whole session row opens the recording, including its participant cell.
  const participantCell = await page
    .getByRole("row")
    .filter({
      has: page.getByRole("link", { name: "Intervals · morning", exact: true }),
    })
    .getByRole("cell")
    .nth(1)
    .boundingBox();
  await page.mouse.click(
    participantCell!.x + 20,
    participantCell!.y + participantCell!.height / 2,
  );
  await expect(page).toHaveURL(/session=demo-session-1/);
  await expect(
    page.getByRole("heading", { name: "Intervals · morning" }),
  ).toBeFocused();
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(
    page.getByRole("tab", { name: "Heart rate", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".simple-signal-stats")).not.toContainText("—");
  await expect(page.locator(".simple-range-label")).toContainText("0:00–15:00");
  await expect(page.getByTestId("data-gap").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Self-reports" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Session timeline" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/simple-review-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "RR interval", exact: true }).click();
  await expect(page.locator(".legend")).toContainText("ms");
  await expect(
    page.getByText(
      "Time between consecutive heartbeats, measured in milliseconds (ms).",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "RR interval", exact: true })
    .press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Movement" })).toBeFocused();
  await expect(page.locator(".legend")).toContainText("Phone acceleration");
  await page.getByRole("tab", { name: "Heart rate", exact: true }).click();
  await expect(page.locator(".legend")).toContainText("Heart rate");
  const chart = page.locator(".chart");
  const panel = page.locator(".simple-signal-panel");
  const initialHeight = (await panel.boundingBox())!.height;
  await chart.hover({ position: { x: 250, y: 100 } });
  await expect(page.locator(".compact-readout")).toContainText("bpm");
  expect(
    Math.abs((await panel.boundingBox())!.height - initialHeight),
  ).toBeLessThan(1);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".simple-range-label")).toContainText("Zoomed in");
  await page.getByRole("button", { name: "Full session", exact: true }).click();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + 180, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 440, box.y + 100);
  await expect(page.getByTestId("zoom-preview")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".simple-range-label")).toContainText("Zoomed in");
  await expect(page.getByTestId("zoom-preview")).toHaveCount(0);
  await page.getByRole("button", { name: "Full session", exact: true }).click();
  await chart.focus();
  await chart.press("+");
  await expect(
    page.getByRole("button", { name: "Full session", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full session", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Full session", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All sessions" }).click();
  await expect(
    page.getByRole("link", { name: "Intervals · morning", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/session=demo-session-1/);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await pending;
  const contents = await readFile((await download.path())!, "utf8");
  const lines = contents.trim().split("\n");
  expect(lines[0]).toBe(
    "signal,index,t_ms,received_at_unix_ms,sensor_time,value,quality",
  );
  // More than one API page, all three signals, no downsampling or duplicate samples.
  expect(lines.length).toBe(2635);
  expect(
    new Set(lines.slice(1).map((line) => line.split(",").slice(0, 2).join(":")))
      .size,
  ).toBe(2634);
  expect(new Set(lines.slice(1).map((line) => line.split(",")[0]))).toEqual(
    new Set(["hr", "rr", "phoneacc"]),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Intervals · morning" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "All sessions" }).click();
  await expect(page).not.toHaveURL(/session=/);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Intervals · morning" }),
  ).toBeVisible();
});

test("Narrow layout, empty workspace, unknown session and sign out", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(
    page.locator(".simple-mobile-session-meta").first(),
  ).toBeVisible();
  await expect(
    page.locator(".simple-mobile-session-meta").first(),
  ).toContainText("5 Oct 2026");
  await expect(
    page.locator(".simple-mobile-session-meta").first(),
  ).toContainText("Demo");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/simple-sessions-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Intervals · morning", exact: true })
    .click();
  await expect(page.locator(".chart")).toBeVisible();
  await expect(page.locator(".simple-signal-stats")).not.toContainText("—");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/simple-review-mobile.png",
    fullPage: true,
  });
  await page.goto("/?session=unavailable");
  await expect(
    page.getByRole("heading", { name: "Session unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to sessions" }).click();
  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill("other@apexvip.local");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your first session starts on mobile" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
