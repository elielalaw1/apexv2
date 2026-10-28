import { z } from "zod";
import { SignalKind, signalKinds, signals } from "./contract";

const CardSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string().min(1).max(128),
      kind: z.literal("signal"),
      signals: z.array(z.enum(signalKinds)).min(1).max(2),
    })
    .strict(),
  z
    .object({
      id: z.string().min(1).max(128),
      kind: z.enum(["reports", "timeline"]),
    })
    .strict(),
]);
export type ReviewCard = z.infer<typeof CardSchema>;
const PreferenceSchema = z
  .object({ version: z.literal(1), cards: z.array(CardSchema).min(1).max(7) })
  .strict();
export function cardTitle(card: ReviewCard) {
  return card.kind === "signal"
    ? card.signals
        .map((k) => (k === "phoneacc" ? "Movement" : signals[k].name))
        .join(" + ")
    : card.kind === "reports"
      ? "Self-reports"
      : "Session timeline";
}
export function defaultCards(
  signal: SignalKind,
  reports: boolean,
  timeline: boolean,
): ReviewCard[] {
  return [
    { id: `chart-${signal}`, kind: "signal", signals: [signal] },
    ...(reports ? [{ id: "reports", kind: "reports" } as ReviewCard] : []),
    ...(timeline ? [{ id: "timeline", kind: "timeline" } as ReviewCard] : []),
  ];
}
export function readCards(
  raw: string,
  available: SignalKind[],
  reports: boolean,
  timeline: boolean,
): ReviewCard[] | null {
  try {
    const result = PreferenceSchema.parse(JSON.parse(raw));
    const ids = new Set<string>(),
      kinds = new Set<string>();
    for (const c of result.cards) {
      if (ids.has(c.id)) return null;
      ids.add(c.id);
      for (const k of c.kind === "signal" ? c.signals : [c.kind]) {
        if (kinds.has(k)) return null;
        kinds.add(k);
        if (c.kind === "signal" && !available.includes(k as SignalKind))
          return null;
      }
      if (
        (c.kind === "reports" && !reports) ||
        (c.kind === "timeline" && !timeline)
      )
        return null;
    }
    return result.cards;
  } catch {
    return null;
  }
}
export function canCombine(a: ReviewCard, b: ReviewCard) {
  return (
    a.id !== b.id &&
    a.kind === "signal" &&
    b.kind === "signal" &&
    a.signals.length + b.signals.length <= 2
  );
}
export function combineCards(
  cards: ReviewCard[],
  source: string,
  target: string,
): ReviewCard[] {
  const a = cards.find((c) => c.id === source),
    b = cards.find((c) => c.id === target);
  if (
    !a ||
    !b ||
    !canCombine(a, b) ||
    a.kind !== "signal" ||
    b.kind !== "signal"
  )
    return cards;
  return cards
    .filter((c) => c.id !== a.id)
    .map((c) =>
      c.id === b.id ? { ...b, signals: [...b.signals, ...a.signals] } : c,
    );
}
export function moveCard(
  cards: ReviewCard[],
  source: string,
  target: string,
): ReviewCard[] {
  const from = cards.findIndex((c) => c.id === source),
    to = cards.findIndex((c) => c.id === target);
  if (from < 0 || to < 0 || from === to) return cards;
  const result = [...cards];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}
