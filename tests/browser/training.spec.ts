import { test, expect } from "@playwright/test";
import { Session, Sample, defaultTemplate } from "../../src/core/contract";
test("Phone streams, zones, recovery and dynamic multi-signal help survive upload and reload", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const definition = {
    ...defaultTemplate,
    id: "training-browser",
    questions: [],
    eventLabels: [],
  };
  expect(
    (await request.post("/api/mvp/templates", { data: definition })).ok(),
  ).toBeTruthy();
  const session: Session = {
    id: "training-browser",
    participantId: "training-test",
    participantLabel: "Training demo",
    title: "Outdoor intervals",
    typeId: definition.id,
    typeVersion: 1,
    startedAt: 1794340000000,
    durationMs: 180000,
    demo: true,
    source: "mobile-synthetic-v2",
    timePolicy: "sensor-relative-v1",
    state: "ended",
    training: { phoneSensors: true, maxHeartRate: 200 },
    events: [
      { id: "work1", type: "event", label: "Work", t: 0 },
      { id: "rest1", type: "event", label: "Rest", t: 10000 },
      { id: "work2", type: "event", label: "Work", t: 150000 },
    ],
  };
  const samples: Sample[] = [];
  for (let i = 0; i < 180; i++)
    for (const [signal, value] of Object.entries({
      hr: 150 - i / 2,
      rr: 1000 + (i % 2) * 10,
      speed: 9 + Math.sin(i / 12),
      pace: 60 / (9 + Math.sin(i / 12)),
      distance: i * 2.5,
      cadence: 170 + Math.sin(i / 8) * 4,
      steps: Math.floor((i * 170) / 60),
      altitude: i / 10,
      phoneacc: Math.abs(Math.sin(i)),
      phonegyrox: Math.sin(i / 10),
    }))
      samples.push({
        signal: signal as Sample["signal"],
        index: i,
        t: i * 1000,
        receivedAt: session.startedAt + i * 1000,
        value,
        quality: "measured",
      });
  for (let i = 0; i < samples.length; i += 500)
    expect(
      (
        await request.post("/api/mvp/ingest", {
          data: {
            version: 1,
            batchId: `training-${i}`,
            session,
            samples: samples.slice(i, i + 500),
          },
        })
      ).ok(),
    ).toBeTruthy();
  const inventory = await (
    await request.get(`/api/mvp/sessions/${session.id}/signals`)
  ).json();
  expect(inventory.map((r: { signal: string }) => r.signal)).toEqual(
    expect.arrayContaining([
      "hrv",
      "hrzone",
      "hrrecovery",
      "speed",
      "pace",
      "altitude",
      "phonegyrox",
    ]),
  );
  const metrics = await (
    await request.get(`/api/mvp/sessions/${session.id}/metrics`)
  ).json();
  expect(metrics.recoveries[0].after60).toBe(30);
  expect(metrics.recoveries[0].after120).toBe(60);
  expect(metrics.zoneCoverageMs).toBe(179000);
  await page.goto(`/?session=${session.id}`);
  await expect(page.locator(".canvas-card")).toHaveCount(inventory.length);
  await page.getByText("Training insights", { exact: true }).click();
  await expect(page.locator(".training-summary")).toContainText("30 bpm drop");
  await expect(page.locator(".training-summary")).toContainText("60 bpm drop");
  await page
    .getByRole("button", { name: "About Heart rate", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Signal information" }),
  ).toContainText("Heartbeats per minute");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Signal information" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Choose graphs", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Combine Heart rate with", exact: true })
    .selectOption("chart-speed");
  await page
    .locator('[data-card-id="chart-speed"]')
    .getByRole("button", { name: /^About / })
    .click();
  await expect(
    page.getByRole("region", { name: "Signal information" }),
  ).toContainText("Phone · GPS");
  await page
    .getByRole("combobox", { name: "Combine Movement with", exact: true })
    .selectOption("chart-speed");
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  const combined = page.locator('[data-card-id="chart-speed"]');
  await expect(combined).toContainText("Normalized · z-score");
  await expect(
    combined.getByRole("button", { name: /^About / }),
  ).toHaveAttribute("aria-expanded", "true");
  const info = combined.getByRole("region", { name: "Signal information" });
  await expect(info).toContainText("Phone · GPS");
  await expect(info).toContainText("Heartbeats per minute");
  await expect(info).toContainText("Phone · accelerometer");
  await expect(info).toContainText("heart rate may respond after");
  await expect(info).toContainText("z-score");
  await combined.scrollIntoViewIfNeeded();
  await combined.screenshot({
    path: test.info().outputPath("training-info-card.png"),
  });
  await page.screenshot({
    path: test.info().outputPath("training-info-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator(".canvas-card")).toHaveCount(inventory.length - 2);
  await expect(page.locator('[data-card-id="chart-speed"]')).toContainText(
    "Normalized · z-score",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator('[data-card-id="chart-speed"]')
    .getByRole("button", { name: /^About / })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: test.info().outputPath("training-info-mobile.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Signal information" }),
  ).toHaveCount(0);
});
