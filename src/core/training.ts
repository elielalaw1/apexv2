import { Sample, Session, SignalKind } from "./contract";
import { rmssd } from "./analysis";
export const derivedKinds: SignalKind[] = ["hrv", "hrzone", "hrrecovery"];
const derived = (
  s: Session,
  signal: SignalKind,
  t: number,
  value: number,
  index: number,
  quality: Sample["quality"] = "measured",
): Sample => ({
  signal,
  t,
  value,
  index,
  quality,
  receivedAt: s.startedAt + t,
});
export function trainingSeries(
  s: Session,
  signal: SignalKind,
  hr: Sample[],
  rr: Sample[],
): Sample[] {
  if (signal === "hrzone") {
    const max = s.training?.maxHeartRate;
    if (!max) return [];
    return hr.map((p, i) =>
      derived(
        s,
        signal,
        p.t,
        Math.min(5, Math.max(0, Math.floor((p.value / max) * 10) - 4)),
        i,
        p.quality,
      ),
    );
  }
  if (signal === "hrv") {
    const out: Sample[] = [];
    let next = 0;
    for (let i = 29; i < rr.length; i++) {
      if (rr[i].t < next) continue;
      next = rr[i].t + 5000;
      const window = rr.slice(i - 29, i + 1),
        result = rmssd(window, 30);
      const abrupt = window.some(
        (p, j) =>
          j > 0 &&
          Math.abs(p.value - window[j - 1].value) / window[j - 1].value > 0.2,
      );
      out.push(
        derived(
          s,
          signal,
          rr[i].t,
          result.value ?? 0,
          out.length,
          result.value === null || abrupt ? "missing" : "measured",
        ),
      );
    }
    return out;
  }
  if (signal === "hrrecovery") {
    const out: Sample[] = [];
    const rests = s.events.filter(
      (e) =>
        e.type === "event" &&
        ["rest", "recovery", "återhämtning"].includes(e.label.toLowerCase()),
    );
    for (const rest of rests) {
      const end =
        s.events
          .filter(
            (e) =>
              e.type === "event" &&
              ["work", "arbete", "rest", "recovery", "återhämtning"].includes(
                e.label.toLowerCase(),
              ) &&
              e.t > rest.t,
          )
          .sort((a, b) => a.t - b.t)[0]?.t ?? s.durationMs;
      const prior = hr
        .filter(
          (p) =>
            p.t <= rest.t && rest.t - p.t <= 3500 && p.quality === "measured",
        )
        .at(-1);
      if (!prior) continue;
      let last = rest.t;
      for (const p of hr.filter((p) => p.t >= rest.t && p.t < end)) {
        // Never draw an uninterrupted recovery curve through missing HR.
        const good = p.quality === "measured" && p.t - last <= 3500;
        out.push(
          derived(
            s,
            signal,
            p.t,
            prior.value - p.value,
            out.length,
            good ? "measured" : "missing",
          ),
        );
        last = p.t;
      }
      // Terminate each recovery segment so separate intervals are not joined.
      if (out.length && out.at(-1)!.t + 1 <= s.durationMs)
        out.push(
          derived(s, signal, out.at(-1)!.t + 1, 0, out.length, "missing"),
        );
    }
    return out;
  }
  return [];
}
export function trainingMetrics(s: Session, hr: Sample[]) {
  const zones = Array.from({ length: 6 }, (_, zone) => ({
    zone,
    durationMs: 0,
  }));
  let covered = 0;
  if (s.training?.maxHeartRate)
    for (let i = 0; i < hr.length - 1; i++) {
      const p = hr[i],
        next = hr[i + 1],
        dt = next.t - p.t;
      if (
        p.quality !== "measured" ||
        next.quality !== "measured" ||
        dt <= 0 ||
        dt > 3500
      )
        continue;
      const zone = Math.min(
        5,
        Math.max(0, Math.floor((p.value / s.training.maxHeartRate) * 10) - 4),
      );
      zones[zone].durationMs += dt;
      covered += dt;
    }
  const nearest = (t: number) =>
    hr
      .filter((p) => p.quality === "measured" && Math.abs(p.t - t) <= 2000)
      .sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  const recoveries = s.events
    .filter(
      (e) =>
        e.type === "event" &&
        ["rest", "recovery", "återhämtning"].includes(e.label.toLowerCase()),
    )
    .map((e) => {
      const baseline = hr
        .filter(
          (p) => p.quality === "measured" && p.t <= e.t && e.t - p.t <= 3500,
        )
        .at(-1);
      const nextWork =
        s.events
          .filter(
            (w) =>
              w.type === "event" &&
              ["work", "arbete", "rest", "recovery", "återhämtning"].includes(
                w.label.toLowerCase(),
              ) &&
              w.t > e.t,
          )
          .sort((a, b) => a.t - b.t)[0]?.t ?? Infinity;
      const drop = (ms: number) => {
        const target = e.t + ms;
        if (!baseline || target >= nextWork || target > s.durationMs)
          return null;
        const sample = nearest(target);
        return sample ? baseline.value - sample.value : null;
      };
      return {
        id: e.id,
        t: e.t,
        baseline: baseline?.value ?? null,
        after60: drop(60000),
        after120: drop(120000),
      };
    });
  return {
    maxHeartRate: s.training?.maxHeartRate ?? null,
    zones,
    zoneCoverageMs: covered,
    recoveries,
  };
}
