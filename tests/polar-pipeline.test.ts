import test from "node:test";
import assert from "node:assert/strict";
process.env.APEX_DB_PATH = ":memory:";
import { PolarSamples } from "../src/core/polarSamples";
import { fullSignalFixture, fullSignalCounts } from "../src/core/polarFixture";
import { ingest, readSeries, rawPage, saveTemplate } from "../src/server/store";
import { defaultTemplate, Session, Sample } from "../src/core/contract";
test("PMD nanoseconds retain ECG timing and raw XYZ without receipt-time compression", () => {
  const c = new PolarSamples(1000),
    origin = 900000000000000000n;
  const samples = c.ecg({
    receivedAt: 2000,
    samples: [
      { microVolts: -123, sourceTimestamp: String(origin) },
      { microVolts: 456, sourceTimestamp: String(origin + 7692308n) },
    ],
  });
  assert.ok(Math.abs(samples[1].t - samples[0].t - 7.692308) < 1e-8);
  assert.equal(samples[0].sensorTime, String(origin));
  assert.equal(samples[0].receivedAt, 2000);
  const acc = c.acc({
    receivedAt: 2100,
    samples: [{ x: -300, y: 400, z: 0, sourceTimestamp: String(origin) }],
  });
  assert.deepEqual(
    acc.map((s) => [s.signal, s.value]),
    [
      ["h10accx", -300],
      ["h10accy", 400],
      ["h10accz", 0],
      ["h10acc", 500],
    ],
  );
  assert.equal(acc[0].t, samples[0].t);
  c.resetClock();
  const reconnect = c.ecg({
    receivedAt: 5000,
    samples: [{ microVolts: 1, sourceTimestamp: "1" }],
  });
  assert.equal(reconnect[0].t, 4000);
  assert.equal(reconnect[0].index, 2);
});
test("Pre-start packet samples are excluded and contact loss is marked suspect", () => {
  const c = new PolarSamples(1000);
  assert.equal(c.rr(500, new Date(1100).toISOString(), -500).length, 0);
  assert.equal(
    c.hr(100, new Date(1100).toISOString(), false)[0].quality,
    "suspect",
  );
  assert.equal(
    c.ecg({
      receivedAt: 1100,
      samples: [{ microVolts: 50, sourceTimestamp: "123" }],
    })[0].quality,
    "suspect",
  );
});
test("Full Polar recording survives ingest retries, per-signal chart reads and paginated raw export", () => {
  const startedAt = 1700000000000,
    workspace = "polar-pipeline-test";
  const session: Session = {
    id: "polar-all-signals",
    participantId: "TEST",
    participantLabel: "TEST",
    title: "Full signal test",
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
  saveTemplate(workspace, defaultTemplate);
  const samples = fullSignalFixture(startedAt);
  assert.equal(samples.length, 4770);
  for (let i = 0; i < samples.length; i += 500) {
    const batch = {
      version: 1,
      batchId: `polar-${i}`,
      session,
      samples: samples.slice(i, i + 500),
    };
    assert.equal(ingest(workspace, batch).duplicate, false);
    assert.equal(ingest(workspace, batch).duplicate, true);
  }
  for (const [signal, count] of Object.entries(fullSignalCounts)) {
    const series = readSeries(
      workspace,
      session.id,
      signal as Sample["signal"],
      0,
      60000,
      100,
    );
    assert.equal(series.rawCount, count);
    assert.equal(series.summary.count, count);
    assert.equal(series.gaps.length, 0);
  }
  const exported: Sample[] = [];
  let cursor = -1;
  for (;;) {
    const page = rawPage(
      workspace,
      session.id,
      cursor,
      237,
    ) as unknown as (Sample & { cursor: number })[];
    if (!page.length) break;
    exported.push(...page);
    cursor = page.at(-1)!.cursor;
  }
  assert.equal(exported.length, samples.length);
  for (let i = 0; i < samples.length; i++) {
    const { cursor: _, ...sample } = exported[i] as Sample & { cursor: number };
    assert.deepEqual(
      { ...sample, sensorTime: sample.sensorTime ?? undefined },
      samples[i],
    );
  }
});
