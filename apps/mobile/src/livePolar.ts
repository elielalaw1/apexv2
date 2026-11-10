import Polar from "../modules/apex-polar";
import { Sample, SignalKind, signals } from "../../../src/core/contract";
import { polarSignals, PolarSamples } from "../../../src/core/polarSamples";
export type LiveSignal = {
  value: number | null;
  receivedAt: number;
  count: number;
  points: { t: number; value: number }[];
  error?: string;
};
const empty = (): Record<string, LiveSignal> =>
  Object.fromEntries(
    (Object.keys(signals) as SignalKind[]).map((s) => [
      s,
      { value: null, receivedAt: 0, count: 0, points: [] },
    ]),
  );
let latest = empty();
let previewKey = "";
export function resetPhoneLive() {
  const blank = empty();
  for (const kind of Object.keys(signals))
    if (!(polarSignals as readonly string[]).includes(kind)) latest[kind] = blank[kind];
}
export function liveSnapshot() {
  return { ...latest };
}
export function recordLive(samples: Sample[]) {
  const bySignal = new Map<SignalKind, Sample[]>();
  for (const sample of samples) {
    const items = bySignal.get(sample.signal) ?? [];
    items.push(sample);
    bySignal.set(sample.signal, items);
  }
  for (const [kind, items] of bySignal) {
    const last = items.at(-1)!;
    const previous = latest[kind];
    latest[kind] = {
      value: last.value,
      receivedAt: last.receivedAt,
      count: previous.count + items.length,
      points: [
        ...previous.points,
        ...items.map((s) => ({ t: s.t, value: s.value })),
      ]
        .filter((p) => p.t >= last.t - 4000)
        .slice(-180),
    };
  }
}
export function observePolar() {
  if (!Polar) return () => {};
  const converter = new PolarSamples(Date.now());
  const safe = (fn: () => Sample[]) => {
    try {
      recordLive(fn());
    } catch (e) {
      setLiveError(
        "ecg",
        e instanceof Error ? e.message : "Invalid sensor data",
      );
    }
  };
  const subs = [
    Polar.addListener("heartRateSampleReceived", (s) =>
      safe(() =>
        converter.hr(
          s.bpm,
          s.timestamp,
          !s.contactSupported || s.contactDetected,
        ),
      ),
    ),
    Polar.addListener("rrSampleReceived", (s) =>
      safe(() => converter.rr(s.rrMs, s.timestamp, s.rrOffsetMs)),
    ),
    Polar.addListener("ecgBatchReceived", (s) => safe(() => converter.ecg(s))),
    Polar.addListener("accelerometerBatchReceived", (s) =>
      safe(() => converter.acc(s)),
    ),
    Polar.addListener("connectionStateChanged", (s) => {
      if (!s.isConnected) {
        converter.resetClock();
        latest = empty();
        previewKey = "";
      }
    }),
    Polar.addListener("nativeError", (e) => {
      const kind = e.code.includes("ECG")
        ? "ecg"
        : e.code.includes("ACCEL")
          ? "h10acc"
          : "hr";
      setLiveError(kind, e.message);
    }),
  ];
  return () => subs.forEach((s) => s.remove());
}
function setLiveError(kind: string, error: string) {
  latest[kind] = { ...latest[kind], error };
}
export async function startPreview() {
  if (!Polar) return;
  const state = await Polar.getConnectionState();
  if (!state.isConnected) return;
  const key = `${state.id}:${state.hrReady}:${state.streamingReady}`;
  if (previewKey === key) return;
  previewKey = key;
  if (state.hrReady) {
    await Polar.startHeartRateStream();
    await Polar.startRRStream();
  }
  if (state.streamingReady) {
    await Polar.startECGStream();
    await Polar.startPolarAccelerometerStream();
  }
}
export async function stopStreams() {
  previewKey = "";
  await Promise.allSettled([
    Polar?.stopHeartRateStream(),
    Polar?.stopRRStream(),
    Polar?.stopECGStream(),
    Polar?.stopPolarAccelerometerStream(),
  ]);
}
