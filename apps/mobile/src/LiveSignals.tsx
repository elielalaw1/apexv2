import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { signals } from "../../../src/core/contract";
import { polarSignals } from "../../../src/core/polarSamples";
import type { LiveSignal } from "./livePolar";
function Trace({
  points,
  color,
}: {
  points: LiveSignal["points"];
  color: string;
}) {
  const [width, setWidth] = useState(0);
  const height = 64;
  // Screen preview is bounded; all raw samples are saved by the separate collector.
  const values = points.filter(
    (_, i) => i % Math.max(1, Math.ceil(points.length / 90)) === 0,
  );
  const min = Math.min(...values.map((p) => p.value)),
    max = Math.max(...values.map((p) => p.value));
  const from = values[0]?.t ?? 0,
    span = Math.max(1, (values.at(-1)?.t ?? from) - from);
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.trace}
    >
      {values.slice(1).map((p, i) => {
        const previous = values[i];
        if (p.t - previous.t > 500) return null;
        const x = ((previous.t - from) / span) * width;
        const y =
          height -
          4 -
          ((previous.value - min) / Math.max(1, max - min)) * (height - 8);
        const dx = ((p.t - previous.t) / span) * width;
        const dy =
          (-(p.value - previous.value) / Math.max(1, max - min)) * (height - 8);
        const length = Math.hypot(dx, dy);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x + dx / 2 - length / 2,
              top: y + dy / 2,
              width: length,
              height: 1.5,
              backgroundColor: color,
              transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
            }}
          />
        );
      })}
    </View>
  );
}
export default function LiveSignals({
  data,
  recording,
}: {
  data: Record<string, LiveSignal>;
  recording: boolean;
}) {
  const now = Date.now();
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>
        {recording ? "Live recording" : "Signal preview"}
      </Text>
      <Text style={styles.hint}>
        {recording
          ? "Raw data is saved locally. Finish the session to upload it."
          : "Preview only. Tap Start recording to save a session."}
      </Text>
      {polarSignals.map((kind) => {
        const s = data[kind];
        const fresh = !!s?.receivedAt && now - s.receivedAt < 3500;
        const label = signals[kind];
        return (
          <View key={kind} style={styles.signal}>
            <View style={styles.row}>
              <Text style={styles.label}>{label.name}</Text>
              <Text style={[styles.status, !fresh && styles.waiting]}>
                {s?.error
                  ? "Signal error"
                  : fresh
                    ? "Receiving"
                    : s?.count
                      ? "No recent data"
                      : "Waiting"}
              </Text>
            </View>
            <Text style={styles.value}>
              {fresh && s?.value !== null
                ? s.value.toFixed(kind === "h10acc" ? 1 : 0)
                : "—"}
              <Text style={styles.unit}> {label.unit}</Text>
            </Text>
            {(kind === "ecg" || kind === "h10acc") && fresh && (
              <Trace points={s.points} color={label.color} />
            )}
            <Text style={styles.hint}>
              {s?.error ??
                `${s?.count ?? 0} samples received${kind === "h10acc" ? " · magnitude, including gravity" : ""}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 12 },
  heading: { fontSize: 16, fontWeight: "600", color: "#303c32" },
  hint: { fontSize: 12, lineHeight: 18, color: "#596553" },
  signal: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: "#e2e8dd",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#303c32" },
  status: { fontSize: 12, color: "#2b766b" },
  waiting: { color: "#87683a" },
  value: {
    fontSize: 28,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#26392e",
  },
  unit: { fontSize: 14, fontWeight: "400", color: "#596553" },
  trace: { height: 64, overflow: "hidden", backgroundColor: "#f5f7f2" },
});
