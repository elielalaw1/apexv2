import { PolarSamples } from "./polarSamples";
import type { Sample } from "./contract";
// Explicitly synthetic: 60 HR/RR observations plus 5 s of 130 Hz ECG and 200 Hz XYZ.
export const fullSignalCounts = {
  hr: 60,
  rr: 60,
  ecg: 650,
  h10acc: 1000,
  h10accx: 1000,
  h10accy: 1000,
  h10accz: 1000,
} as const;
export function fullSignalFixture(startedAt: number): Sample[] {
  const converter = new PolarSamples(startedAt);
  const result: Sample[] = [];
  for (let i = 0; i < 60; i++) {
    const timestamp = new Date(startedAt + i * 1000).toISOString();
    result.push(
      ...converter.hr(100 + Math.round(15 * Math.sin(i / 8)), timestamp, true),
      ...converter.rr(600 + i, timestamp),
    );
  }
  const origin = 900000000000000000n;
  for (let second = 0; second < 5; second++) {
    // Anchor the last ECG sample on packet receipt; XYZ shares that sensor clock.
    const receivedAt = startedAt + (second + 1) * 1000;
    result.push(
      ...converter.ecg({
        receivedAt,
        samples: Array.from({ length: 130 }, (_, i) => ({
          microVolts: Math.round(150 * Math.sin(i / 4)),
          sourceTimestamp: String(
            origin +
              BigInt(second) * 1000000000n +
              BigInt(Math.round(((i + 1) / 130) * 1e9)),
          ),
        })),
      }),
    );
    result.push(
      ...converter.acc({
        receivedAt,
        samples: Array.from({ length: 200 }, (_, i) => ({
          x: i - 100,
          y: -(second + 1) * 10,
          z: 1000,
          sourceTimestamp: String(
            origin + BigInt(second) * 1000000000n + BigInt(i + 1) * 5000000n,
          ),
        })),
      }),
    );
  }
  return result;
}
