import test from "node:test";
import assert from "node:assert/strict";
process.env.APEX_DB_PATH = ":memory:";
import {
  ingest,
  readSeries,
  rawPage,
  saveLayout,
  saveTemplate,
  requireSession,
  ApiError,
} from "../src/server/store";
import { demoBatches } from "../src/core/demo";
import { Batch, Layout, Sample, defaultTemplate } from "../src/core/contract";
import { rmssd, envelope } from "../src/core/analysis";
const first = demoBatches()[0];
saveTemplate("lab-a", defaultTemplate);
saveTemplate("lab-b", defaultTemplate);
test("Same payload retries have one immutable copy; conflict transaction rolls back", () => {
  const ack = ingest("lab-a", first);
  assert.equal(ack.duplicate, false);
  assert.equal(ingest("lab-a", first).duplicate, true);
  const before = readSeries(
    "lab-a",
    first.session.id,
    "hr",
    0,
    first.session.durationMs,
  ).rawCount;
  assert.throws(
    () =>
      ingest("lab-a", {
        ...first,
        samples: first.samples.map((s, i) =>
          i === 0 ? { ...s, value: s.value + 1 } : s,
        ),
      }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  const conflicting: Batch = {
    ...first,
    batchId: "bad-batch",
    samples: [
      { ...first.samples[0], index: 99999, t: 100, value: 115 },
      { ...first.samples[0], value: first.samples[0].value + 1 },
    ],
  };
  assert.throws(() => ingest("lab-a", conflicting));
  assert.equal(
    readSeries("lab-a", first.session.id, "hr", 0, first.session.durationMs)
      .rawCount,
    before,
  );
});
test("Session, rendering, raw export and layout reject another workspace", () => {
  for (const fn of [
    () => requireSession("lab-b", first.session.id),
    () => readSeries("lab-b", first.session.id, "hr", 0, 1000),
    () => rawPage("lab-b", first.session.id),
    () => ingest("lab-b", { ...first, batchId: "cross" }),
  ])
    assert.throws(
      fn,
      (e: unknown) => e instanceof ApiError && e.status === 404,
    );
  const layout: Layout = {
    version: 1,
    id: "test-layout",
    title: "Test",
    alignment: "elapsed",
    anchorLabel: "Arbete",
    panels: [
      {
        id: "p",
        title: "Test",
        sessionIds: [first.session.id],
        signalKinds: ["hr", "rr"],
        axis: "separate",
        color: "#2b766b",
        lineWidth: 2,
        opacity: 1,
        visible: true,
        width: 2,
        height: 300,
      },
    ],
  };
  assert.throws(() => saveLayout("lab-b", layout));
  assert.equal(saveLayout("lab-a", layout).version, 1);
  assert.throws(() =>
    saveLayout("lab-a", {
      ...layout,
      panels: [{ ...layout.panels[0], axis: "shared" }],
    }),
  );
});
test("Irregular numeric time, gap and raw statistics survive render decimation", () => {
  const samples: Sample[] = Array.from({ length: 12000 }, (_, index) => ({
    signal: "hr",
    index,
    t: index < 6000 ? index * 23 : index * 23 + 22000,
    receivedAt: first.session.startedAt + index * 23,
    value: 90 + (index % 13),
    quality: "measured",
  }));
  samples[4000].value = 220;
  const session = { ...first.session, id: "dense-session", durationMs: 400000 };
  for (let i = 0; i < samples.length; i += 1000)
    ingest("lab-a", {
      version: 1,
      batchId: `dense-${i}`,
      session,
      samples: samples.slice(i, i + 1000),
    });
  const s = readSeries("lab-a", session.id, "hr", 0, 400000);
  assert.equal(s.rawCount, 12000);
  assert.ok(s.renderCount <= 904);
  assert.equal(s.summary.max, 220);
  assert.equal(s.summary.count, 12000);
  assert.equal(s.gaps.length, 1);
  assert.ok(s.gaps[0].to - s.gaps[0].from >= 22000);
  assert.equal(
    s.summary.mean,
    samples.reduce((a, p) => a + p.value, 0) / samples.length,
  );
});
test("RMSSD v1 rejects missing indices and artefacts instead of filling gaps", () => {
  const points: Sample[] = Array.from({ length: 30 }, (_, index) => ({
    signal: "rr",
    index,
    t: index * 1000,
    receivedAt: index * 1000,
    value: index % 2 ? 810 : 800,
    quality: "measured",
  }));
  assert.equal(rmssd(points).value, 10);
  assert.equal(rmssd(points.slice(1)).value, null);
  assert.equal(
    rmssd(points.map((p, i) => (i === 12 ? { ...p, index: 99 } : p))).value,
    null,
  );
  assert.equal(
    rmssd(points.map((p, i) => (i === 12 ? { ...p, quality: "suspect" } : p)))
      .value,
    null,
  );
  assert.ok(envelope(points, 12).length <= 12);
});
test("Form versions preserve old definitions", () => {
  saveTemplate("lab-a", defaultTemplate);
  assert.throws(
    () => saveTemplate("lab-a", { ...defaultTemplate, title: "Changed" }),
    (e: unknown) => e instanceof ApiError && e.status === 409,
  );
  assert.equal(
    saveTemplate("lab-a", { ...defaultTemplate, title: "Changed", version: 2 })
      .version,
    2,
  );
});
test("Out-of-order metadata retains duration and events; form references are validated", () => {
  const session = {
    ...first.session,
    id: "ordered-session",
    durationMs: 900000,
    events: [
      ...first.session.events,
      {
        id: "extra",
        t: 800000,
        type: "note" as const,
        label: "Sista händelse",
      },
    ],
  };
  ingest("lab-a", { version: 1, batchId: "ordered-new", session, samples: [] });
  ingest("lab-a", {
    version: 1,
    batchId: "ordered-old",
    session: {
      ...session,
      durationMs: 850000,
      events: session.events.filter((e) => e.id !== "extra"),
    },
    samples: [],
  });
  assert.equal(requireSession("lab-a", session.id).durationMs, 900000);
  assert.equal(
    requireSession("lab-a", session.id).events.some((e) => e.id === "extra"),
    true,
  );
  assert.throws(() =>
    ingest("lab-a", {
      version: 1,
      batchId: "bad-form",
      session: { ...first.session, id: "bad-form-session", typeVersion: 99 },
      samples: [],
    }),
  );
  assert.throws(() =>
    ingest("lab-a", {
      version: 1,
      batchId: "bad-report",
      session: {
        ...first.session,
        id: "bad-report-session",
        events: first.session.events.map((e) =>
          e.type === "self-report" ? { ...e, value: 999 } : e,
        ),
      },
      samples: [],
    }),
  );
});
test("Invalid measurements create visible breaks; windows inside a gap retain boundaries", () => {
  const session = {
    ...first.session,
    id: "quality-session",
    durationMs: 10000,
  };
  const samples: Sample[] = Array.from({ length: 10 }, (_, index) => ({
    signal: "hr",
    index,
    t: index * 1000,
    receivedAt: session.startedAt + index * 1000,
    value: index === 5 ? 0 : 100,
    quality: index === 5 ? "suspect" : "measured",
  }));
  ingest("lab-a", { version: 1, batchId: "quality-package", session, samples });
  const series = readSeries("lab-a", session.id, "hr", 0, 10000, 4);
  assert.equal(series.summary.count, 9);
  assert.equal(series.summary.mean, 100);
  assert.equal(series.gaps[0].reason, "quality");
  assert.deepEqual([series.gaps[0].from, series.gaps[0].to], [4000, 6000]);
  const inside = readSeries("lab-a", "dense-session", "hr", 140000, 150000);
  assert.equal(inside.rawCount, 0);
  assert.equal(inside.gaps.length, 1);
});
