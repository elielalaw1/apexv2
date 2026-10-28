import { z } from "zod";
export const signalKinds = [
  "hr",
  "rr",
  "ecg",
  "h10acc",
  "h10accx",
  "h10accy",
  "h10accz",
  "phoneacc",
] as const;
export type SignalKind = (typeof signalKinds)[number];
export const signals: Record<
  SignalKind,
  { name: string; unit: string; color: string; gapMs: number }
> = {
  hr: { name: "Heart rate", unit: "bpm", color: "#2b766b", gapMs: 3500 },
  rr: { name: "RR interval", unit: "ms", color: "#9b6b32", gapMs: 3500 },
  ecg: { name: "ECG", unit: "µV", color: "#706bb0", gapMs: 80 },
  h10acc: {
    name: "H10 acceleration",
    unit: "mg",
    color: "#4a7097",
    gapMs: 200,
  },
  h10accx: {
    name: "H10 acceleration X",
    unit: "mg",
    color: "#4a7097",
    gapMs: 200,
  },
  h10accy: {
    name: "H10 acceleration Y",
    unit: "mg",
    color: "#8b6941",
    gapMs: 200,
  },
  h10accz: {
    name: "H10 acceleration Z",
    unit: "mg",
    color: "#7863a0",
    gapMs: 200,
  },
  phoneacc: {
    name: "Phone acceleration",
    unit: "g",
    color: "#aa666c",
    gapMs: 1500,
  },
};
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
export const SampleSchema = z
  .object({
    signal: z.enum(signalKinds),
    index: z.number().int().nonnegative(),
    t: z.number().finite().nonnegative(),
    receivedAt: z.number().finite().nonnegative(),
    sensorTime: z.string().max(64).optional(),
    value: z.number().finite(),
    quality: z.enum(["measured", "suspect", "missing"]).default("measured"),
  })
  .strict();
export type Sample = z.infer<typeof SampleSchema>;
export const EventSchema = z
  .object({
    id,
    t: z.number().finite().nonnegative(),
    type: z.enum(["event", "note", "self-report", "disconnect", "reconnect"]),
    label: z.string().min(1).max(300),
    value: z.number().finite().optional(),
    formId: z.string().optional(),
    formVersion: z.number().int().positive().optional(),
    questionId: id.optional(),
  })
  .strict();
export type SessionEvent = z.infer<typeof EventSchema>;
export const SessionSchema = z
  .object({
    id,
    participantId: id,
    participantLabel: z.string().min(1).max(100),
    title: z.string().min(1).max(160),
    typeId: id,
    typeVersion: z.number().int().positive(),
    startedAt: z.number().finite().nonnegative(),
    durationMs: z.number().finite().min(1).max(604800000),
    demo: z.boolean(),
    source: z.string().min(1).max(100),
    timePolicy: z.enum(["receipt-relative-v1", "sensor-relative-v1"]),
    state: z.enum(["recording", "ended"]),
    events: z.array(EventSchema).max(1000),
  })
  .strict();
export type Session = z.infer<typeof SessionSchema>;
export const BatchSchema = z
  .object({
    version: z.literal(1),
    batchId: id,
    session: SessionSchema,
    samples: z.array(SampleSchema).max(2000),
  })
  .strict()
  .superRefine((batch, ctx) => {
    const seen = new Set<string>();
    for (const s of batch.samples) {
      const key = `${s.signal}:${s.index}`;
      if (seen.has(key))
        ctx.addIssue({
          code: "custom",
          message: "Duplicate sample index in batch",
        });
      seen.add(key);
      if (s.t > batch.session.durationMs + 5000)
        ctx.addIssue({
          code: "custom",
          message: "Sample outside session time range",
        });
      if (
        s.quality === "measured" &&
        s.signal === "hr" &&
        (s.value <= 0 || s.value > 300)
      )
        ctx.addIssue({ code: "custom", message: "Invalid heart rate" });
      if (s.quality === "measured" && s.signal === "rr" && s.value <= 0)
        ctx.addIssue({ code: "custom", message: "Invalid RR interval" });
    }
  });
export type Batch = z.infer<typeof BatchSchema>;
export const PanelSchema = z
  .object({
    id,
    title: z.string().min(1).max(100),
    sessionIds: z.array(id).min(1).max(4),
    signalKinds: z.array(z.enum(signalKinds)).min(1).max(3),
    axis: z.enum(["shared", "separate", "normalized"]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    lineWidth: z.number().min(1).max(5),
    opacity: z.number().min(0.15).max(1),
    visible: z.boolean(),
    width: z.union([z.literal(1), z.literal(2)]),
    height: z.number().min(220).max(650),
  })
  .strict();
export type Panel = z.infer<typeof PanelSchema>;
export const LayoutSchema = z
  .object({
    version: z.literal(1),
    id,
    title: z.string().min(1).max(100),
    alignment: z.enum(["elapsed", "absolute", "event"]),
    anchorLabel: z.string().max(100),
    panels: z.array(PanelSchema).max(20),
  })
  .strict()
  .superRefine((layout, ctx) => {
    if (new Set(layout.panels.map((p) => p.id)).size !== layout.panels.length)
      ctx.addIssue({ code: "custom", message: "Chart IDs must be unique" });
    for (const p of layout.panels) {
      if (
        new Set(p.sessionIds).size !== p.sessionIds.length ||
        new Set(p.signalKinds).size !== p.signalKinds.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Duplicate session or signal in chart",
        });
      if (
        p.axis === "separate" &&
        new Set(p.signalKinds.map((s) => signals[s].unit)).size > 2
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Separate axes support at most two units. Use more charts or normalization.",
        });
      if (
        p.axis === "shared" &&
        new Set(p.signalKinds.map((s) => signals[s].unit)).size > 1
      )
        ctx.addIssue({
          code: "custom",
          message: "A shared axis requires the same unit",
        });
    }
  });
export type Layout = z.infer<typeof LayoutSchema>;
export type Series = {
  sessionId: string;
  signal: SignalKind;
  points: Sample[];
  rawCount: number;
  renderCount: number;
  summary: {
    count: number;
    mean: number | null;
    min: number | null;
    max: number | null;
    sd?: number | null;
  };
  gaps: { from: number; to: number; reason?: "gap" | "quality" }[];
};
export const TemplateSchema = z
  .object({
    version: z.number().int().positive(),
    id,
    title: z.string().min(1).max(100),
    eventLabels: z.array(z.string().min(1).max(80)).max(20),
    questions: z
      .array(
        z
          .object({
            id,
            label: z.string().min(1).max(100),
            phase: z.enum(["pre", "post"]),
            min: z.number(),
            max: z.number(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict()
  .superRefine((template, ctx) => {
    if (
      new Set(template.questions.map((q) => q.id)).size !==
      template.questions.length
    )
      ctx.addIssue({ code: "custom", message: "Question IDs must be unique" });
    for (const q of template.questions)
      if (q.min >= q.max)
        ctx.addIssue({
          code: "custom",
          message: "Question minimum must be lower than maximum",
        });
  });
export type Template = z.infer<typeof TemplateSchema>;
export const defaultTemplate: Template = {
  version: 1,
  id: "interval",
  title: "Intervallpass",
  eventLabels: ["Arbete", "Återhämtning", "Avbrott"],
  questions: [
    { id: "readiness", label: "Beredskap", phase: "pre", min: 1, max: 10 },
    {
      id: "rpe",
      label: "Upplevd ansträngning",
      phase: "post",
      min: 1,
      max: 10,
    },
  ],
};
