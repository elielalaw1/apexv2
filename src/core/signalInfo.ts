import { SignalKind, signals } from "./contract";
export type SignalInfo = {
  source: string;
  description: string;
  use: string;
  limit: string;
};
const axis = (name: string): SignalInfo => ({
  source: "Phone · Core Motion",
  description: `Phone ${name}-axis acceleration caused by movement, in g. Gravity is removed.`,
  use: "Inspect movement patterns with the phone fixed in the same position.",
  limit: "This describes the phone, not a body joint or exercise technique.",
});
const rotation = (name: string): SignalInfo => ({
  source: "Phone · gyroscope",
  description: `Angular speed around the phone’s ${name} axis, in radians per second.`,
  use: "Compare turning and rotation with acceleration and heart rate.",
  limit:
    "Changing phone placement changes the meaning of the axes. This is not joint-angle measurement.",
});
const h10axis = (name: string): SignalInfo => ({
  source: "Polar H10 · accelerometer",
  description: `Acceleration along the chest strap’s ${name} axis, in milligravity (mg), including gravity.`,
  use: "Inspect the timing and direction of chest-strap movement.",
  limit:
    "Strap orientation matters. This is not a validated measure of force, repetitions or technique.",
});
export const signalInfo: Record<SignalKind, SignalInfo> = {
  hr: {
    source: "Polar H10",
    description:
      "Heartbeats per minute (bpm), measured electrically by the chest strap.",
    use: "Follow cardiovascular effort and how heart rate responds to work and rest.",
    limit:
      "Heart rate can lag behind changes in pace. It does not directly measure power or fatigue.",
  },
  rr: {
    source: "Polar H10",
    description: "Time between consecutive heartbeats, in milliseconds.",
    use: "Inspect beat-to-beat timing. RR intervals are the input for HRV calculations.",
    limit:
      "Poor contact and missed beats can distort RR. Different from heart rate and not itself a recovery score.",
  },
  ecg: {
    source: "Polar H10",
    description:
      "A single-channel recording of the heart’s electrical activity, in microvolts (µV).",
    use: "See individual heartbeat waveforms and inspect recording quality.",
    limit:
      "Movement can cause artefacts. This view does not diagnose heart conditions.",
  },
  h10acc: {
    source: "Derived from Polar H10 XYZ",
    description:
      "Acceleration magnitude √(X² + Y² + Z²), in mg, including gravity.",
    use: "Compare overall chest movement with heart rate and workout phases.",
    limit:
      "Rest can be close to 1000 mg because gravity is included. Not a calorie, load or technique score.",
  },
  h10accx: h10axis("X"),
  h10accy: h10axis("Y"),
  h10accz: h10axis("Z"),
  phoneacc: {
    source: "Phone · accelerometer",
    description:
      "Magnitude of phone acceleration, in g. New phone recordings exclude gravity; older demo data may include it.",
    use: "Compare overall phone movement with chest movement and effort.",
    limit:
      "Phone placement matters. Do not compare its numeric magnitude directly with H10 mg values.",
  },
  phoneaccx: axis("X"),
  phoneaccy: axis("Y"),
  phoneaccz: axis("Z"),
  phonegyrox: rotation("X"),
  phonegyroy: rotation("Y"),
  phonegyroz: rotation("Z"),
  speed: {
    source: "Phone · GPS",
    description:
      "Estimated travel speed in kilometres per hour, converted from the phone’s location speed.",
    use: "Compare external pace of movement with heart rate.",
    limit:
      "Requires location permission and a usable GPS signal. Indoor and poor-accuracy readings are omitted.",
  },
  pace: {
    source: "Derived from phone GPS speed",
    description:
      "Minutes needed to travel one kilometre. Lower values mean faster movement.",
    use: "Compare running pace with heart rate, cadence and elevation.",
    limit:
      "Stationary or slower than 0.5 m/s is shown as missing pace, not zero. GPS estimates may fluctuate.",
  },
  distance: {
    source: "Derived from phone GPS positions",
    description:
      "Cumulative accepted travel distance in metres since recording started. Coordinates are processed on the phone and not uploaded.",
    use: "Track progress during an outdoor session.",
    limit:
      "Poor GPS and gaps are excluded; this can underestimate distance. Position jitter is filtered, but distance remains an estimate.",
  },
  cadence: {
    source: "Phone · pedometer",
    description:
      "Estimated steps per minute, converted from the phone’s cadence estimate.",
    use: "Compare stepping rhythm with speed and effort.",
    limit:
      "Requires Motion & Fitness permission. Phone placement matters; this is not cycling cadence or repetition counting.",
  },
  steps: {
    source: "Phone · pedometer",
    description: "Cumulative detected steps since the session started.",
    use: "See stepping volume across a workout.",
    limit:
      "Not all exercises produce detectable steps. Missing updates are not evidence of no movement.",
  },
  altitude: {
    source: "Phone · barometer",
    description:
      "Change in elevation in metres relative to the start of barometer recording.",
    use: "Give context to changes in pace and heart rate on hills or stairs.",
    limit:
      "Not altitude above sea level. Air-pressure changes and indoor environments can affect the estimate.",
  },
  hrv: {
    source: "Calculated · H10 RR",
    description:
      "RMSSD: the root mean square of successive RR differences across 30 consecutive beats, updated about every 5 seconds, in ms.",
    use: "Explore beat-to-beat variability. Compare resting measurements under consistent conditions.",
    limit:
      "Windows with gaps, uncertain beats, RR outside 250–2000 ms or abrupt RR changes above 20% are omitted. Not a stress or readiness score; exercise changes HRV.",
  },
  hrzone: {
    source: "Calculated · heart rate + your max HR",
    description:
      "Heart rate zone using your entered maximum: Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 ≥90%. Values below 50% are zone 0.",
    use: "See time at different relative intensities.",
    limit:
      "Zone boundaries depend on the maximum you entered. No age-based maximum or automatic medical interpretation is assumed.",
  },
  hrrecovery: {
    source: "Calculated · heart rate + Rest markers",
    description:
      "Heart-rate drop from the last valid reading at or just before a Rest marker. Positive means a fall in heart rate; negative means it rose.",
    use: "Compare the response during rest between work intervals. The summary reports drops at 60 and 120 seconds when available.",
    limit:
      "Needs marked rest and valid HR at the relevant time. Missing data or a new Work interval makes the corresponding summary unavailable. Not a fitness diagnosis.",
  },
};
export function comparisonInfo(kinds: SignalKind[]) {
  const units = new Set(kinds.map((k) => signals[k].unit));
  const messages: string[] = [];
  if (kinds.length > 1)
    messages.push(
      units.size > 2
        ? "Normalized comparison: each signal is centred on its visible-interval mean and scaled by its standard deviation (z-score). Compare patterns, not original numeric heights. Hover values retain original units."
        : units.size === 2
          ? "Two labelled axes retain the original units. Similar line heights do not mean equal values."
          : "Signals share time and the same unit axis.",
    );
  const has = (...ks: SignalKind[]) => ks.some((k) => kinds.includes(k));
  if (has("hr") && has("speed", "pace"))
    messages.push(
      "Effort vs movement: heart rate may respond after a change in speed or pace; aligned peaks do not establish cause.",
    );
  if (has("speed") && has("pace"))
    messages.push(
      "Speed and pace come from the same GPS estimate and are inverses, not independent measurements.",
    );
  if (has("altitude") && has("hr", "speed", "pace"))
    messages.push(
      "Terrain context: compare elevation changes with pace and heart rate. Elevation is relative to the barometer start.",
    );
  if (has("cadence", "steps") && has("speed", "pace"))
    messages.push(
      "Rhythm vs travel: cadence describes stepping frequency; speed and pace describe movement over ground.",
    );
  if (has("hrv") && has("hr", "rr"))
    messages.push(
      "HRV is calculated from RR, and RR is related to heart rate. These traces are related signals, not independent evidence of stress or recovery.",
    );
  if (
    has("h10acc", "h10accx", "h10accy", "h10accz") &&
    has("phoneacc", "phoneaccx", "phoneaccy", "phoneaccz")
  )
    messages.push(
      "Two sensor locations: H10 acceleration includes gravity in mg; new phone acceleration excludes gravity in g. Placement and units differ.",
    );
  if (
    has("phonegyrox", "phonegyroy", "phonegyroz") &&
    has("phoneacc", "phoneaccx", "phoneaccy", "phoneaccz")
  )
    messages.push(
      "Rotation vs acceleration: turning the phone and moving it linearly are different kinds of motion. Keep its placement consistent.",
    );
  if (kinds.length > 1)
    messages.push(
      "All traces use the same elapsed recording time. Sensor delivery and response delays can still differ.",
    );
  return messages;
}
