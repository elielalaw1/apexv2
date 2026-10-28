import Polar from "../modules/apex-polar";
import { randomUUID } from "expo-crypto";
import {
  Session,
  Sample,
  defaultTemplate,
  Template,
} from "../../../src/core/contract";
import { PolarSamples } from "../../../src/core/polarSamples";
import { stopStreams, startPreview } from "./livePolar";
import { SampleWriter, saveSession, seal, saveLocalTemplate } from "./storage";
let session: Session | null = null,
  writer: SampleWriter | null = null,
  converter: PolarSamples | null = null,
  lastSampleTime = 0,
  workspace = "",
  subs: { remove: () => void }[] = [],
  lastContact = true,
  closing = false,
  activeTemplate: Template = defaultTemplate,
  fatalError: string | null = null;
export function snapshot() {
  return {
    session,
    persisted: writer?.persisted ?? 0,
    buffered: writer?.buffered ?? 0,
    error: fatalError ?? writer?.error,
    contact: lastContact,
  };
}
export async function start(
  participant: string,
  ws: string,
  answers: Record<string, number>,
  template = defaultTemplate,
) {
  if (session) throw Error("Finish or recover the current session first");
  if (!Polar)
    throw Error(
      "Polar requires a native development build; Expo Go does not include the bridge.",
    );
  const state = await Polar.getConnectionState();
  if (!state.isConnected) throw Error("Connect Polar H10 first");
  if (!state.hrReady || !state.streamingReady)
    throw Error(
      "Wait for H10 signal services to become ready, then try again.",
    );
  await saveLocalTemplate(ws, template);
  workspace = ws;
  converter = new PolarSamples(Date.now());
  lastSampleTime = 0;
  closing = false;
  fatalError = null;
  lastContact = true;
  activeTemplate = structuredClone(template);
  const now = Date.now();
  converter = new PolarSamples(now);
  const created: Session = {
    id: randomUUID(),
    participantId: participant,
    participantLabel: participant,
    title: `${template.title} · ${participant}`,
    typeId: template.id,
    typeVersion: template.version,
    startedAt: now,
    durationMs: 1,
    demo: false,
    source: `polar-h10:${state.id}`,
    timePolicy: "sensor-relative-v1",
    state: "recording",
    events: template.questions
      .filter((q) => q.phase === "pre")
      .map((q) => ({
        id: randomUUID(),
        t: 0,
        type: "self-report",
        label: q.label,
        value: answers[q.id],
        formId: template.id,
        questionId: q.id,
        formVersion: template.version,
      })),
  };
  await saveSession(created, ws);
  session = created;
  writer = new SampleWriter(created.id);
  let wasConnected = true;
  function add(read: () => Sample[]) {
    if (!session || !writer || closing) return;
    try {
      for (const sample of read()) {
        writer.append(sample);
        lastSampleTime = Math.max(lastSampleTime, sample.t);
      }
    } catch (e) {
      fatalError = e instanceof Error ? e.message : "Recording stopped";
      closing = true;
      void stopStreams();
    }
  }
  subs = [
    Polar.addListener("heartRateSampleReceived", (s) => {
      lastContact = !s.contactSupported || s.contactDetected;
      add(() => converter!.hr(s.bpm, s.timestamp, lastContact));
    }),
    Polar.addListener("rrSampleReceived", (s) =>
      add(() => converter!.rr(s.rrMs, s.timestamp, s.rrOffsetMs ?? 0)),
    ),
    Polar.addListener("ecgBatchReceived", (s) => add(() => converter!.ecg(s))),
    Polar.addListener("accelerometerBatchReceived", (s) =>
      add(() => converter!.acc(s)),
    ),
    Polar.addListener("connectionStateChanged", (s) => {
      if (session && !closing && s.isConnected !== wasConnected) {
        wasConnected = s.isConnected;
        if (session.events.length >= 970) {
          fatalError =
            "Too many connection interruptions. Finish and save the session.";
          closing = true;
          void stopStreams();
          return;
        }
        session.events.push({
          id: randomUUID(),
          t: Date.now() - session.startedAt,
          type: s.isConnected ? "reconnect" : "disconnect",
          label: s.isConnected ? "H10 connected" : "H10 disconnected",
        });
        void saveSession(
          {
            ...session,
            durationMs: Math.max(1, Date.now() - session.startedAt),
          },
          workspace,
        ).catch((e) => {
          fatalError = e.message;
        });
        converter?.resetClock();
      }
      if (session && !closing && s.isConnected)
        void startPreview().catch((e) => {
          fatalError = e instanceof Error ? e.message : "Reconnection failed";
        });
    }),
  ];
  try {
    await startPreview();
  } catch (e) {
    await finish({});
    throw e;
  }
}
export async function event(label: string) {
  if (!session) throw Error("No active session");
  if (session.events.length >= 970)
    throw Error("Event limit reached. Finish the session.");
  session.events.push({
    id: randomUUID(),
    t: Date.now() - session.startedAt,
    type: "event",
    label,
  });
  session.durationMs = Math.max(1, Date.now() - session.startedAt);
  await saveSession(session, workspace);
}
export async function finish(answers: Record<string, number>) {
  if (!session || !writer) return;
  closing = true;
  await stopStreams();
  subs.forEach((s) => s.remove());
  subs = [];
  await writer.close();
  if (session.state !== "ended") {
    const recording = session;
    session = {
      ...recording,
      state: "ended",
      durationMs: Math.max(1, Date.now() - recording.startedAt, lastSampleTime),
      events: [
        ...recording.events,
        ...activeTemplate.questions
          .filter((q) => q.phase === "post" && answers[q.id] !== undefined)
          .map((q) => ({
            id: randomUUID(),
            t: Date.now() - recording.startedAt,
            type: "self-report" as const,
            label: q.label,
            value: answers[q.id],
            formId: recording.typeId,
            questionId: q.id,
            formVersion: recording.typeVersion,
          })),
      ],
    };
  }
  await seal(session, workspace);
  const ended = session;
  session = null;
  writer = null;
  return ended;
}
