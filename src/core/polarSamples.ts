import { Sample, SampleSchema, SignalKind } from "./contract";
export type EcgPacket = {
  receivedAt: number;
  samples: { microVolts: number; sourceTimestamp: string }[];
};
export type AccPacket = {
  receivedAt: number;
  samples: { x: number; y: number; z: number; sourceTimestamp: string }[];
};
export const polarSignals = [
  "hr",
  "rr",
  "ecg",
  "h10acc",
  "h10accx",
  "h10accy",
  "h10accz",
] as const;
// PMD nanosecond timestamps exceed JS integer precision. Subtract as BigInt first.
// One sensor anchor aligns ECG and XYZ; receipt time is retained independently.
export class PolarSamples {
  private anchor: { sensor: bigint; elapsed: number } | null = null;
  private indices = new Map<SignalKind, number>();
  contact = true;
  constructor(readonly startedAt: number) {}
  resetClock() {
    this.anchor = null;
  }
  private append(
    signal: SignalKind,
    value: number,
    receivedAt: number,
    t: number,
    sensorTime?: string,
  ): Sample[] {
    if (t < 0) return []; // A first packet can include samples taken before Start.
    const sample = SampleSchema.parse({
      signal,
      value,
      receivedAt,
      t,
      index: this.indices.get(signal) ?? 0,
      sensorTime,
      quality:
        signal === "hr"
          ? this.contact && value > 0 && value <= 300
            ? "measured"
            : "suspect"
          : signal === "rr"
            ? this.contact && value > 0
              ? "measured"
              : "suspect"
            : signal === "ecg" && !this.contact
              ? "suspect"
              : "measured",
    });
    this.indices.set(signal, sample.index + 1);
    return [sample];
  }
  hr(value: number, timestamp: string, contact: boolean) {
    this.contact = contact;
    const receivedAt = Date.parse(timestamp);
    return this.append("hr", value, receivedAt, receivedAt - this.startedAt);
  }
  rr(value: number, timestamp: string, offset = 0) {
    const receivedAt = Date.parse(timestamp);
    return this.append(
      "rr",
      value,
      receivedAt,
      receivedAt - this.startedAt + offset,
    );
  }
  private times(packet: EcgPacket | AccPacket) {
    const last = packet.samples.at(-1);
    if (!last) return [];
    const sensor = BigInt(last.sourceTimestamp);
    if (!this.anchor)
      this.anchor = { sensor, elapsed: packet.receivedAt - this.startedAt };
    const anchor = this.anchor;
    return packet.samples.map(
      (s) =>
        anchor.elapsed +
        Number(BigInt(s.sourceTimestamp) - anchor.sensor) / 1e6,
    );
  }
  ecg(packet: EcgPacket) {
    const times = this.times(packet);
    return packet.samples.flatMap((s, i) =>
      this.append(
        "ecg",
        s.microVolts,
        packet.receivedAt,
        times[i],
        s.sourceTimestamp,
      ),
    );
  }
  acc(packet: AccPacket) {
    const times = this.times(packet);
    return packet.samples.flatMap((s, i) =>
      (
        [
          ["h10accx", s.x],
          ["h10accy", s.y],
          ["h10accz", s.z],
          ["h10acc", Math.hypot(s.x, s.y, s.z)],
        ] as [SignalKind, number][]
      ).flatMap(([kind, value]) =>
        this.append(
          kind,
          value,
          packet.receivedAt,
          times[i],
          s.sourceTimestamp,
        ),
      ),
    );
  }
}
