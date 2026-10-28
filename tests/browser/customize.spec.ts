import { test, expect, Page } from "@playwright/test";

async function openSession(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(page.getByRole("heading", { name: "Sessions 4" })).toBeVisible();
  await page.getByRole("button", { name: "Dismiss introduction" }).click();
  await page
    .getByRole("link", { name: "Intervals · morning", exact: true })
    .click();
  await expect(page.locator(".chart")).toBeVisible();
}

test("Optional animated tour, contextual steps, dismissal and replay", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Show me around" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show me around" }).click();
  const tour = page.getByRole("dialog");
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("heading")).toHaveText(
    "Find the recording you need.",
  );
  await expect(
    tour.getByRole("button", { name: "Next", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(tour).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show me around" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Quick tour" })).toBeFocused();
  await page
    .getByRole("link", { name: "Intervals · morning", exact: true })
    .click();
  await expect(page.locator(".chart")).toBeVisible();
  await page.getByRole("button", { name: "Quick tour" }).click();
  await expect(tour.getByRole("heading")).toHaveText("Start with the signals.");
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("heading")).toHaveText("Take a closer look.");
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("heading")).toHaveText("Your view, your way.");
  await page.screenshot({
    path: "docs/dashboard-tour.png",
    animations: "disabled",
  });
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("heading")).toHaveText(
    "Put the recording in context.",
  );
  await tour.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(tour).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".chart")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show me around" }),
  ).toHaveCount(0);
});

test("Choose, arrange, drag to combine, persist, split, cancel and restore", async ({
  page,
}) => {
  test.setTimeout(90000);
  await openSession(page);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  const editor = page.getByRole("region", { name: "Customize session layout" });
  await editor
    .getByRole("checkbox", { name: "RR interval", exact: true })
    .check();
  await editor.getByRole("checkbox", { name: "Movement", exact: true }).check();
  await editor
    .getByRole("checkbox", { name: "Self-reports", exact: true })
    .uncheck();
  const rr = page.getByRole("article", { name: "RR interval", exact: true });
  await rr.getByRole("button", { name: "Move RR interval earlier" }).click();
  // Now HR and RR are adjacent, so both drag targets remain visible together.
  await rr.getByRole("button", { name: "Move RR interval earlier" }).click();
  await expect(page.locator(".canvas-card").first()).toHaveAttribute(
    "aria-label",
    "RR interval",
  );
  const handle = rr.getByRole("button", {
    name: "Drag RR interval",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2 + 14,
    from.y + from.height / 2,
    { steps: 3 },
  );
  const heart = page.getByRole("article", { name: "Heart rate", exact: true });
  const drop = heart.locator(".canvas-combine-zone");
  await expect(drop).toBeVisible();
  const to = (await drop.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + 30, { steps: 10 });
  await page.mouse.up();
  const combined = page.getByRole("article", {
    name: "Heart rate + RR interval",
    exact: true,
  });
  await expect(combined).toBeVisible();
  await expect(combined.locator(".legend")).toContainText("bpm");
  await expect(combined.locator(".legend")).toContainText("ms");
  await expect(combined.locator(".canvas-axis-note")).toContainText(
    "on the left",
  );
  await expect(combined.locator(".canvas-axis-note")).toContainText(
    "on the right",
  );
  await expect(combined.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Customize", exact: true }),
  ).toBeFocused();
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Self-reports", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".canvas-announcement")).toContainText("saved");
  await page.screenshot({
    path: "docs/customized-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await expect(combined).toBeVisible();
  await expect(page.locator(".chart")).toHaveCount(2);
  await combined.locator(".chart").hover({ position: { x: 220, y: 100 } });
  await expect(page.getByTestId("shared-cursor")).toHaveCount(2);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await combined.getByRole("button", { name: "Separate graphs" }).click();
  await expect(page.locator(".chart")).toHaveCount(3);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(combined).toBeVisible();
  await expect(page.locator(".chart")).toHaveCount(2);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore default", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Heart rate", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chart")).toHaveCount(1);
});

test("Mobile and reduced motion: accessible customization and a dismissible guide", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSession(page);
  await page.getByRole("button", { name: "Customize", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "RR interval", exact: true })
    .check();
  const rr = page.getByRole("article", { name: "RR interval", exact: true });
  await rr
    .getByRole("combobox", { name: "Combine RR interval with" })
    .selectOption("chart-hr");
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(page.locator(".legend")).toContainText("bpm");
  await expect(page.locator(".legend")).toContainText("ms");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/customized-dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Quick tour" }).click();
  const tour = page.getByRole("dialog");
  await expect(tour).toBeVisible();
  expect(
    await tour
      .locator(".tour-step")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await tour.getByRole("button", { name: "Skip tour", exact: true }).click();
  await expect(tour).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Quick tour" })).toBeFocused();
});
