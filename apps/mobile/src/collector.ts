import Polar from "../modules/apex-polar";
import { randomUUID } from "expo-crypto";
import {
  Session,
  Sample,
  SampleSchema,
  defaultTemplate,
  Template,
} from "../../../src/core/contract";
import { SampleWriter, saveSession, seal, saveLocalTemplate } from "./storage";
let session: Session | null = null,
  writer: SampleWriter | null = null,
  indices = { hr: 0, rr: 0 },
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
  if (session) throw Error("Avsluta eller återställ befintlig session först");
  if (!Polar)
    throw Error(
      "Polar kräver en native development build; Expo Go saknar bryggan.",
    );
  const state = await Polar.getConnectionState();
  if (!state.isConnected) throw Error("Anslut Polar H10 först");
  await saveLocalTemplate(ws, template);
  workspace = ws;
  indices = { hr: 0, rr: 0 };
  closing = false;
  fatalError = null;
  lastContact = true;
  activeTemplate = structuredClone(template);
  const now = Date.now();
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
    timePolicy: "receipt-relative-v1",
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
  function add(
    signal: "hr" | "rr",
    value: number,
    timestamp: string,
    rrOffsetMs = 0,
  ) {
    if (!session || !writer || closing) return;
    const receivedAt = Date.parse(timestamp);
    const t = Math.max(0, receivedAt - session.startedAt + rrOffsetMs);
    const s: Sample = {
      signal,
      value,
      index: indices[signal]++,
      t,
      receivedAt,
      quality:
        lastContact && (signal === "hr" ? value > 0 && value <= 300 : value > 0)
          ? "measured"
          : "suspect",
    };
    try {
      writer.append(SampleSchema.parse(s));
    } catch (e) {
      fatalError = e instanceof Error ? e.message : "Insamlingen stoppades";
      closing = true;
      void Polar?.stopHeartRateStream();
      void Polar?.stopRRStream();
    }
  }
  subs = [
    Polar.addListener("heartRateSampleReceived", (s) => {
      lastContact = !s.contactSupported || s.contactDetected;
      add("hr", s.bpm, s.timestamp);
    }),
    Polar.addListener("rrSampleReceived", (s) =>
      add("rr", s.rrMs, s.timestamp, s.rrOffsetMs ?? 0),
    ),
    Polar.addListener("connectionStateChanged", (s) => {
      if (session && !closing && s.isConnected !== wasConnected) {
        wasConnected = s.isConnected;
        if (session.events.length >= 970) {
          fatalError =
            "För många anslutningsavbrott. Avsluta och säkra sessionen.";
          closing = true;
          void Polar?.stopHeartRateStream();
          void Polar?.stopRRStream();
          return;
        }
        session.events.push({
          id: randomUUID(),
          t: Date.now() - session.startedAt,
          type: s.isConnected ? "reconnect" : "disconnect",
          label: s.isConnected ? "H10 ansluten" : "H10 frånkopplad",
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
        if (s.isConnected)
          void (async () => {
            try {
              await Polar?.startHeartRateStream();
              await Polar?.startRRStream();
            } catch (e) {
              fatalError =
                e instanceof Error ? e.message : "Återanslutning misslyckades";
            }
          })();
      }
    }),
  ];
  try {
    await Polar.startHeartRateStream();
    await Polar.startRRStream();
  } catch (e) {
    await finish({});
    throw e;
  }
}
export async function event(label: string) {
  if (!session) throw Error("Ingen aktiv session");
  if (session.events.length >= 970)
    throw Error("Gränsen för händelser är uppnådd. Avsluta sessionen.");
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
  await Promise.allSettled([
    Polar?.stopHeartRateStream(),
    Polar?.stopRRStream(),
  ]);
  closing = true;
  subs.forEach((s) => s.remove());
  subs = [];
  await writer.close();
  if (session.state !== "ended") {
    const recording = session;
    session = {
      ...recording,
      state: "ended",
      durationMs: Math.max(1, Date.now() - recording.startedAt),
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
