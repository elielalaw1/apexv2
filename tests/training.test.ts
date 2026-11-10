import { test } from "node:test";
import assert from "node:assert/strict";
import { Sample, Session, defaultTemplate } from "../src/core/contract";
import { trainingSeries, trainingMetrics } from "../src/core/training";
import { PhoneSamples } from "../src/core/phoneSamples";
import { comparisonInfo, signalInfo } from "../src/core/signalInfo";
import { signals } from "../src/core/contract";
const s: Session = {
  id: "training",
  participantId: "test",
  participantLabel: "Test",
  title: "Training test",
  typeId: defaultTemplate.id,
  typeVersion: 1,
  startedAt: 1700000000000,
  durationMs: 180000,
  demo: true,
  source: "synthetic",
  timePolicy: "receipt-relative-v1",
  state: "ended",
  events: [{ id: "rest", t: 10000, label: "Rest", type: "event" }],
  training: { phoneSensors: true, maxHeartRate: 200 },
};
const point = (
  signal: Sample["signal"],
  i: number,
  t: number,
  value: number,
  quality: Sample["quality"] = "measured",
): Sample => ({
  signal,
  index: i,
  t,
  value,
  quality,
  receivedAt: s.startedAt + t,
});
test("Zones use entered max HR, explicit boundaries and only covered valid intervals", () => {
  const hr = [99, 100, 120, 140, 160, 180, 205].map((value, i) =>
    point("hr", i, i * 1000, value),
  );
  assert.deepEqual(
    trainingSeries(s, "hrzone", hr, []).map((p) => p.value),
    [0, 1, 2, 3, 4, 5, 5],
  );
  assert.deepEqual(
    trainingSeries({ ...s, training: undefined }, "hrzone", hr, []),
    [],
  );
  const stats = trainingMetrics(s, hr);
  assert.equal(stats.zoneCoverageMs, 6000);
  assert.equal(
    stats.zones.reduce((n, z) => n + z.durationMs, 0),
    6000,
  );
  hr[2].quality = "suspect";
  assert.equal(trainingMetrics(s, hr).zoneCoverageMs, 4000);
  hr[2].t = 50000;
  assert.ok(trainingMetrics(s, hr).zoneCoverageMs < 5000);
});
test("Rolling RMSSD uses consecutive raw beats and rejects gaps, ectopic-like jumps and suspect data", () => {
  const rr = Array.from({ length: 80 }, (_, i) =>
    point("rr", i, i * 1000, 1000 + (i % 2) * 10),
  );
  const result = trainingSeries(s, "hrv", [], rr);
  assert.equal(result[0].t, 29000);
  assert.equal(result[0].value, 10);
  assert.equal(result[0].quality, "measured");
  assert.equal(trainingSeries(s, "hrv", [], rr.slice(0, 29)).length, 0);
  const bad = structuredClone(rr);
  bad[15].quality = "suspect";
  assert.equal(trainingSeries(s, "hrv", [], bad)[0].quality, "missing");
  const jump = structuredClone(rr);
  jump[15].value = 1500;
  assert.equal(trainingSeries(s, "hrv", [], jump)[0].quality, "missing");
  const gap = structuredClone(rr);
  gap.splice(15, 1);
  assert.equal(trainingSeries(s, "hrv", [], gap)[0].quality, "missing");
});
test("Recovery is relative to Rest, does not extrapolate and ends at another interval", () => {
  const hr = Array.from({ length: 180 }, (_, i) =>
    point("hr", i, i * 1000, 150 - i / 2),
  );
  const metrics = trainingMetrics(s, hr);
  assert.equal(metrics.recoveries[0].after60, 30);
  assert.equal(metrics.recoveries[0].after120, 60);
  const short = { ...s, durationMs: 60000 };
  assert.equal(
    trainingMetrics(
      short,
      hr.filter((p) => p.t <= 60000),
    ).recoveries[0].after60,
    null,
  );
  const interrupted = {
    ...s,
    events: [
      ...s.events,
      { id: "work", type: "event" as const, label: "Work", t: 70000 },
    ],
  };
  assert.equal(trainingMetrics(interrupted, hr).recoveries[0].after60, null);
  const missing = hr.filter((p) => Math.abs(p.t - 70000) > 2000);
  assert.equal(trainingMetrics(s, missing).recoveries[0].after60, null);
  const derived = trainingSeries(s, "hrrecovery", hr, []);
  assert.equal(derived[0].value, 0);
  assert.equal(derived.at(-1)!.quality, "missing");
  const noMarker = { ...s, events: [] };
  assert.deepEqual(trainingSeries(noMarker, "hrrecovery", hr, []), []);
});
test("Phone samples share start time, keep independent indices and reject stale, invalid or unknown streams", () => {
  const phone = new PhoneSamples(s.startedAt);
  assert.deepEqual(
    phone.sample({ timestamp: s.startedAt - 1, signal: "speed", value: 5 }),
    [],
  );
  assert.deepEqual(
    phone.sample({ timestamp: s.startedAt + 1, signal: "hr", value: 100 }),
    [],
  );
  assert.deepEqual(
    phone.sample({ timestamp: s.startedAt + 1, signal: "speed", value: NaN }),
    [],
  );
  const first = phone.sample({
    timestamp: s.startedAt + 1000,
    signal: "speed",
    value: 10,
  });
  assert.equal(first[0].t, 1000);
  assert.equal(first[0].index, 0);
  assert.equal(
    phone.sample({ timestamp: s.startedAt + 1000, signal: "pace", value: 6 })[0]
      .index,
    0,
  );
  assert.deepEqual(
    phone.sample({ timestamp: s.startedAt + 999, signal: "speed", value: 10 }),
    [],
  );
  assert.equal(
    phone.sample({
      timestamp: s.startedAt + 2000,
      signal: "speed",
      value: 0,
      quality: "missing",
    })[0].quality,
    "missing",
  );
});
test("Every signal has a plain-English explanation and comparisons reflect source relationships and axis mode", () => {
  for (const key of Object.keys(signals) as (keyof typeof signals)[])
    assert.ok(signalInfo[key]?.description && signalInfo[key]?.limit, key);
  assert.match(
    comparisonInfo(["hr", "speed"]).join(" "),
    /heart rate may respond after/i,
  );
  assert.match(comparisonInfo(["speed", "pace"]).join(" "), /inverses/);
  assert.match(
    comparisonInfo(["hr", "speed", "phoneacc"]).join(" "),
    /z-score/,
  );
  assert.match(
    comparisonInfo(["h10acc", "phoneacc"]).join(" "),
    /includes gravity/,
  );
});

test("Workout values retain useful precision and pace is formatted as minutes:seconds", async () => {
  const { formatSignalValue } = await import("../src/core/format");
  assert.equal(formatSignalValue("pace", 6.5), "6:30");
  assert.equal(formatSignalValue("pace", 5.999), "6:00");
  assert.equal(formatSignalValue("pace", 0), "—");
  assert.equal(formatSignalValue("phonegyrox", 0.124), "0.12");
  assert.equal(formatSignalValue("phoneaccx", 0.004), "0.004");
  assert.equal(formatSignalValue("speed", 9.6), "9.6");
});
