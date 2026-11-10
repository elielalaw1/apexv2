import { Sample, SignalKind } from "./contract";
export type PhonePacket = {
  timestamp: number;
  signal: string;
  value: number;
  quality?: "measured" | "suspect" | "missing";
};
const allowed = new Set([
  "phoneacc",
  "phoneaccx",
  "phoneaccy",
  "phoneaccz",
  "phonegyrox",
  "phonegyroy",
  "phonegyroz",
  "speed",
  "pace",
  "distance",
  "cadence",
  "steps",
  "altitude",
]);
export class PhoneSamples {
  private indices = new Map<string, number>();
  private times = new Map<string, number>();
  constructor(private startedAt: number) {}
  sample(p: PhonePacket): Sample[] {
    if (
      !allowed.has(p.signal) ||
      !Number.isFinite(p.timestamp) ||
      !Number.isFinite(p.value) ||
      p.timestamp < this.startedAt
    )
      return [];
    const t = p.timestamp - this.startedAt;
    if (t <= (this.times.get(p.signal) ?? -1)) return [];
    this.times.set(p.signal, t);
    const index = this.indices.get(p.signal) ?? 0;
    this.indices.set(p.signal, index + 1);
    return [
      {
        signal: p.signal as SignalKind,
        index,
        t,
        receivedAt: p.timestamp,
        value: p.value,
        quality: p.quality ?? "measured",
      },
    ];
  }
}
