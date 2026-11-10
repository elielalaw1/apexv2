import { Sample, signals, SignalKind } from "./contract";
// Min/max envelopes preserve local extremes. Never used as input to statistics.
export function envelope(points: Sample[], budget = 900): Sample[] {
  if (points.length <= budget) return points;
  const bucket = Math.ceil(points.length / Math.max(1, Math.floor(budget / 4)));
  const out: Sample[] = [];
  for (let i = 0; i < points.length; i += bucket) {
    const part = points.slice(i, i + bucket);
    const min = part.reduce((a, b) => (a.value < b.value ? a : b));
    const max = part.reduce((a, b) => (a.value > b.value ? a : b));
    out.push(
      ...[
        ...new Map(
          [part[0], min, max, part[part.length - 1]].map((p) => [p.index, p]),
        ).values(),
      ].sort((a, b) => a.t - b.t || a.index - b.index),
    );
  }
  return out;
}
export function gaps(points: Sample[], signal: SignalKind) {
  const out: { from: number; to: number }[] = [];
  for (let i = 1; i < points.length; i++)
    if (points[i].t - points[i - 1].t > signals[signal].gapMs)
      out.push({ from: points[i - 1].t, to: points[i].t });
  return out;
}
export function summarize(points: Sample[]) {
  const good = points.filter((p) => p.quality === "measured");
  return {
    count: good.length,
    mean: good.length
      ? good.reduce((s, p) => s + p.value, 0) / good.length
      : null,
    min: good.length
      ? good.reduce((v, p) => Math.min(v, p.value), Infinity)
      : null,
    max: good.length
      ? good.reduce((v, p) => Math.max(v, p.value), -Infinity)
      : null,
  };
}
// Explicit, versioned HRV method. No stress labels; suspect points split valid runs.
export function rmssd(points: Sample[], window = 30) {
  if (!Number.isInteger(window) || window < 2)
    throw Error("RMSSD kräver minst två RR-samples");
  const input = points
    .filter((p) => p.signal === "rr")
    .sort((a, b) => a.index - b.index)
    .slice(-window);
  if (input.length < window)
    return {
      version: "rmssd-v1",
      value: null,
      reason: "Otillräcklig täckning",
      coverage: input.length / window,
    };
  if (
    input.some(
      (p) => p.quality !== "measured" || p.value < 250 || p.value > 2000,
    ) ||
    input.some(
      (p, i) =>
        i > 0 &&
        (p.index !== input[i - 1].index + 1 ||
          p.t <= input[i - 1].t ||
          p.t - input[i - 1].t > 3500),
    )
  )
    return {
      version: "rmssd-v1",
      value: null,
      reason: "Datakvaliteten är otillräcklig",
      coverage: 0,
    };
  const sum = input
    .slice(1)
    .reduce((s, p, i) => s + (p.value - input[i].value) ** 2, 0);
  return {
    version: "rmssd-v1",
    value: Math.sqrt(sum / (input.length - 1)),
    reason: null,
    coverage: 1,
  };
}
