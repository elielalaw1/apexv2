import { SignalKind } from "./contract";
export function signalDigits(kind: SignalKind) {
  if (kind === "pace") return 2;
  if (kind.startsWith("phoneacc")) return 3;
  if (kind.startsWith("phonegyro")) return 2;
  if (["speed", "altitude", "hrv"].includes(kind)) return 1;
  return 0;
}
export function formatSignalValue(
  kind: SignalKind,
  value: number | null | undefined,
): string {
  if (value === undefined || value === null || !Number.isFinite(value))
    return "—";
  if (kind === "pace") {
    if (value <= 0) return "—";
    const seconds = Math.round(value * 60);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return value.toFixed(signalDigits(kind));
}
