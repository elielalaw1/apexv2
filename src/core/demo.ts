import { Batch, Session, Sample } from "./contract";
// Deterministic synthetic signals. Same contract and ingestion path as device recordings.
export function demoBatches(): Batch[] {
  const result: Batch[] = [];
  const labels = ["P-014", "P-028", "P-014", "P-041"];
  for (let n = 0; n < 4; n++) {
    const duration = 900000 + n * 120000;
    const session: Session = {
      id: `demo-session-${n + 1}`,
      participantId: labels[n],
      participantLabel: labels[n],
      title: [
        "Intervaller · morgon",
        "Uthållighet · test",
        "Intervaller · uppföljning",
        "Teknik · återhämtning",
      ][n],
      typeId: "interval",
      typeVersion: 1,
      startedAt: Date.UTC(2026, 9, 5, 7 + n, 15),
      durationMs: duration,
      demo: true,
      source: "synthetic-v1",
      timePolicy: "receipt-relative-v1",
      state: "ended",
      events: [
        { id: "start-work", t: 120000, type: "event", label: "Arbete" },
        { id: "recovery", t: 360000, type: "event", label: "Återhämtning" },
        { id: "note-1", t: 480000, type: "note", label: "Tempo förändrat" },
        {
          id: "rpe",
          t: duration - 10000,
          type: "self-report",
          label: "Upplevd ansträngning",
          value: 7,
          formId: "interval",
          formVersion: 1,
        },
      ],
    };
    const samples: Sample[] = [];
    let hrIndex = 0,
      rrIndex = 0,
      accIndex = 0;
    for (let t = 0; t <= duration; t += 1000) {
      // A real break in synthetic acquisition; never filled or interpolated.
      if (t >= 540000 && t <= 562000) continue;
      const hr =
        112 +
        n * 5 +
        26 * Math.sin(t / 82000) +
        12 * Math.sin(t / 27000) +
        4 * Math.sin(t / 2300);
      samples.push({
        signal: "hr",
        index: hrIndex++,
        t,
        receivedAt: session.startedAt + t,
        value: Math.round(hr),
        quality: "measured",
      });
      const rr = 60000 / hr + 24 * Math.sin(t / 2600);
      samples.push({
        signal: "rr",
        index: rrIndex++,
        t: t + 180,
        receivedAt: session.startedAt + t + 180,
        value: rr,
        quality: "measured",
      });
      samples.push({
        signal: "phoneacc",
        index: accIndex++,
        t,
        receivedAt: session.startedAt + t,
        value: 1 + Math.abs(Math.sin(t / 23000)) * 0.8,
        quality: "measured",
      });
    }
    for (let i = 0; i < samples.length; i += 1000)
      result.push({
        version: 1,
        batchId: `demo-${n + 1}-${i / 1000}`,
        session,
        samples: samples.slice(i, i + 1000),
      });
  }
  return result;
}
