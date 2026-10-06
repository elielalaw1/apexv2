"use client";
import { useEffect, useRef, useState } from "react";
import { displayText } from "@/core/presentation";
import { Panel, Series, Session, Layout, signals } from "@/core/contract";
export type Range = [number, number];
export function offset(session: Session, layout: Layout) {
  return layout.alignment === "absolute"
    ? session.startedAt
    : layout.alignment === "event"
      ? -(session.events.find((e) => e.label === layout.anchorLabel)?.t ?? 0)
      : 0;
}
export function timeLabel(t: number, absolute = false) {
  if (absolute)
    return new Date(t).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const sign = t < 0 ? "−" : "";
  t = Math.abs(t);
  return `${sign}${Math.floor(t / 60000)}:${String(Math.floor(t / 1000) % 60).padStart(2, "0")}`;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "The request failed");
  return data;
}
export default function Chart({
  panel,
  sessions,
  layout,
  range,
  cursor,
  onCursor,
  onRange,
  selection,
  onSelect,
  dragMode,
}: {
  panel: Panel;
  sessions: Session[];
  layout: Layout;
  range: Range;
  cursor: number | null;
  onCursor: (t: number) => void;
  onRange: (r: Range) => void;
  selection: Range | null;
  onSelect: (r: Range | null) => void;
  dragMode: "select" | "zoom" | "pan";
}) {
  const [result, setResult] = useState<{ signature: string; series: Series[] }>(
      { signature: "", series: [] },
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [eventDetail, setEventDetail] = useState<string | null>(null);
  const [selectedStats, setSelectedStats] = useState<{
    key: string;
    series: Series[];
  }>({ key: "", series: [] });
  const [statsError, setStatsError] = useState("");
  const start = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(900);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(svg);
      setChartWidth(
        Math.max(
          300,
          svg.getBoundingClientRect().width -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight),
        ),
      );
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [panel.visible, error, layout.alignment, layout.anchorLabel]);
  const picked = sessions.filter((s) => panel.sessionIds.includes(s.id));
  const signature = JSON.stringify([
    panel.sessionIds,
    panel.signalKinds,
    range,
    layout.alignment,
    layout.anchorLabel,
    picked.map((s) => [s.id, s.startedAt, s.durationMs, offset(s, layout)]),
  ]);
  const series = result.signature === signature ? result.series : [];
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all(
      picked.flatMap((session) =>
        panel.signalKinds.map((signal) => {
          const o = offset(session, layout),
            from = Math.max(0, range[0] - o),
            to = Math.max(from, Math.min(session.durationMs, range[1] - o));
          return api<Series>(
            `sessions/${session.id}/series?signal=${signal}&from=${from}&to=${to}`,
          );
        }),
      ),
    )
      .then((data) => {
        if (active) setResult({ signature, series: data });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [signature]); // scalar signature prevents redundant requests on shared cursor moves
  const statsKey = JSON.stringify([
    selection,
    panel.sessionIds,
    panel.signalKinds,
    layout.alignment,
    layout.anchorLabel,
  ]);
  useEffect(() => {
    let active = true;
    setStatsError("");
    if (!selection) return;
    Promise.all(
      picked.flatMap((session) =>
        panel.signalKinds.map((signal) => {
          const o = offset(session, layout),
            from = Math.max(0, selection[0] - o),
            to = Math.max(from, Math.min(session.durationMs, selection[1] - o));
          return api<Series>(
            `sessions/${session.id}/series?signal=${signal}&from=${from}&to=${to}`,
          );
        }),
      ),
    )
      .then((data) => {
        if (active) setSelectedStats({ key: statsKey, series: data });
      })
      .catch((e) => {
        if (active) setStatsError(e.message);
      });
    return () => {
      active = false;
    };
  }, [statsKey]);
  const width = chartWidth,
    left = 48,
    right = panel.axis === "separate" ? 72 : 24,
    top = 23,
    bottom = 42,
    h = Math.max(130, panel.height - 140),
    plot = width - left - right;
  const x = (t: number) =>
    left + ((t - range[0]) / (range[1] - range[0])) * plot;
  const domains = series.map((s) => {
    const group =
      panel.axis === "normalized"
        ? series
        : series.filter(
            (a) => signals[a.signal].unit === signals[s.signal].unit,
          );
    const vals = group.flatMap((g) =>
      g.summary.min === null
        ? []
        : panel.axis === "normalized"
          ? [
              (g.summary.min - (g.summary.mean ?? 0)) / (g.summary.sd || 1),
              (g.summary.max! - (g.summary.mean ?? 0)) / (g.summary.sd || 1),
            ]
          : [g.summary.min, g.summary.max!],
    );
    const lo = vals.length ? Math.min(...vals) : 0,
      hi = vals.length ? Math.max(...vals) : 1,
      pad = Math.max((hi - lo) * 0.12, 0.1);
    return [lo - pad, hi + pad];
  });
  const y = (v: number, i: number) => {
    const [lo, hi] = domains[i] ?? [0, 1];
    return top + h - ((v - lo) / (hi - lo)) * h;
  };
  const color = (i: number) => {
    const signal = series[i].signal;
    const ids = panel.sessionIds;
    const sessionIndex = ids.indexOf(series[i].sessionId);
    if (sessionIndex <= 0)
      return signal === panel.signalKinds[0]
        ? panel.color
        : signals[signal].color;
    const variants: Record<string, string[]> = {
      hr: [panel.color, "#4a7097", "#706bb0", "#687149"],
      rr: [signals.rr.color, "#b28954", "#6f562e", "#a65539"],
      phoneacc: [signals.phoneacc.color, "#845a8f", "#b28456", "#617e70"],
    };
    return (variants[signal] ?? [
      signals[signal].color,
      "#4a7097",
      "#9b6b32",
      "#706bb0",
    ])[sessionIndex % 4];
  };
  const sessionLabel = (id: string) => {
    const s = picked.find((p) => p.id === id);
    return s
      ? `${s.participantLabel} · ${displayText(s.title)} · ${new Date(s.startedAt).toLocaleDateString("en-GB")}${s.demo ? " · Demo" : ""}`
      : "";
  };
  const pointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const style = getComputedStyle(e.currentTarget);
    const padLeft = parseFloat(style.paddingLeft),
      padRight = parseFloat(style.paddingRight);
    const svgX =
      ((e.clientX - rect.left - padLeft) * width) /
      (rect.width - padLeft - padRight);
    return (
      range[0] +
      Math.max(0, Math.min(1, (svgX - left) / plot)) * (range[1] - range[0])
    );
  };
  const zoom = (factor: number) => {
    const mid = cursor ?? (range[0] + range[1]) / 2;
    onRange([mid - (mid - range[0]) * factor, mid + (range[1] - mid) * factor]);
  };
  const missing = picked.filter(
    (s) =>
      layout.alignment === "event" &&
      !s.events.some((e) => e.label === layout.anchorLabel),
  );
  if (!panel.visible)
    return (
      <div className="hidden-panel">
        This chart is hidden. Open Customize to show it.
      </div>
    );
  if (missing.length)
    return (
      <div className="empty">
        The event “{displayText(layout.anchorLabel)}” is missing in{" "}
        {missing.map((s) => s.participantLabel).join(", ")}. Choose another
        event or time alignment.
      </div>
    );
  return (
    <>
      <div className="legend">
        {series.map((s, i) => (
          <span key={`${s.sessionId}-${s.signal}`}>
            <i
              style={{
                background: "transparent",
                borderBottom: `2px ${i >= panel.signalKinds.length ? "dashed" : "solid"} ${color(i)}`,
              }}
            />
            {sessionLabel(s.sessionId)} · {signals[s.signal].name}{" "}
            <b>
              {panel.axis === "normalized"
                ? "z (normalized)"
                : signals[s.signal].unit}
            </b>
          </span>
        ))}
        {loading && <small>Loading…</small>}
      </div>
      {!loading &&
        !error &&
        series.length > 0 &&
        series.every((s) => s.rawCount === 0) && (
          <p className="chart-warning">
            No data in this interval. Return to Full session or choose another
            signal.
          </p>
        )}
      {error ? (
        <div role="alert" className="empty">
          {error}
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="chart"
          role="group"
          aria-label={`${panel.title}. Drag to select an interval, plus and minus to zoom, arrow keys to pan.`}
          tabIndex={0}
          viewBox={`0 0 ${width} ${h + top + bottom}`}
          onPointerMove={(e) => onCursor(pointer(e))}
          onPointerDown={(e) => {
            start.current = pointer(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const end = pointer(e);
            if (
              start.current !== null &&
              Math.abs(end - start.current) > 1000
            ) {
              if (dragMode === "pan") {
                const d = start.current - end;
                onRange([range[0] + d, range[1] + d]);
              } else {
                const r: Range = [
                  Math.min(start.current, end),
                  Math.max(start.current, end),
                ];
                if (dragMode === "zoom") onRange(r);
                else onSelect(r);
              }
            }
            start.current = null;
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onSelect(null);
            }
            if (e.key === "Enter" && cursor !== null) {
              e.preventDefault();
              onSelect([
                Math.max(range[0], cursor - 15000),
                Math.min(range[1], cursor + 15000),
              ]);
            }
            if (e.key === "+" || e.key === "=") {
              e.preventDefault();
              zoom(0.75);
            }
            if (e.key === "-") {
              e.preventDefault();
              zoom(1.3);
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const d =
                (range[1] - range[0]) * 0.02 * (e.key === "ArrowLeft" ? -1 : 1);
              if (e.shiftKey) onRange([range[0] + d * 10, range[1] + d * 10]);
              else
                onCursor(
                  Math.max(
                    range[0],
                    Math.min(range[1], (cursor ?? range[0]) + d),
                  ),
                );
            }
          }}
        >
          <defs>
            <clipPath id={`clip-${panel.id}`}>
              <rect x={left} y={top} width={plot} height={h} />
            </clipPath>
            <pattern
              id={`gap-${panel.id}`}
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
            >
              <path d="M0 7L7 0" stroke="#c9c6bc" strokeWidth=".8" />
            </pattern>
          </defs>
          <text x={left} y={13}>
            {panel.axis === "normalized"
              ? "z (normalized)"
              : series[0]
                ? signals[series[0].signal].unit
                : ""}
          </text>
          {panel.axis === "separate" && series[1] && (
            <text x={width - right + 10} y={13}>
              {signals[series[1].signal].unit}
            </text>
          )}
          {[0, 1, 2, 3, 4].map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - right}
                y1={top + (t * h) / 4}
                y2={top + (t * h) / 4}
                stroke="#e8e7e1"
              />
              <text x={left - 10} y={top + (t * h) / 4 + 4} textAnchor="end">
                {domains[0]
                  ? (
                      domains[0][1] -
                      ((domains[0][1] - domains[0][0]) * t) / 4
                    ).toFixed(
                      panel.axis === "normalized"
                        ? 1
                        : series[0]?.signal === "phoneacc"
                          ? 2
                          : 0,
                    )
                  : "—"}
              </text>
              {panel.axis === "separate" && series.length > 1 && (
                <text
                  x={width - right + 10}
                  y={top + (t * h) / 4 + 4}
                  style={{ fill: color(1) }}
                >
                  {(
                    domains[1][1] -
                    ((domains[1][1] - domains[1][0]) * t) / 4
                  ).toFixed(series[1].signal === "phoneacc" ? 2 : 0)}
                </text>
              )}
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map((t) => (
            <text
              key={t}
              x={left + (t * plot) / 5}
              y={top + h + 27}
              textAnchor="middle"
            >
              {timeLabel(
                range[0] + (t * (range[1] - range[0])) / 5,
                layout.alignment === "absolute",
              )}
            </text>
          ))}
          <g clipPath={`url(#clip-${panel.id})`}>
            {selection && (
              <rect
                data-testid="selected-interval"
                x={x(selection[0])}
                y={top}
                width={Math.max(0, x(selection[1]) - x(selection[0]))}
                height={h}
                fill="#2b766b"
                opacity=".08"
              />
            )}
            {series.flatMap((s, i) => {
              const session = picked.find((p) => p.id === s.sessionId)!,
                o = offset(session, layout);
              return s.gaps.map((g, n) => (
                <g key={`${i}-${n}`}>
                  <rect
                    data-testid="data-gap"
                    x={x(g.from + o)}
                    width={Math.max(0, x(g.to + o) - x(g.from + o))}
                    y={top}
                    height={h}
                    fill={`url(#gap-${panel.id})`}
                  />
                  {i === 0 && (
                    <text x={x(g.to + o) + 4} y={top + 13}>
                      {g.reason === "quality"
                        ? "Uncertain quality"
                        : "Missing data"}
                    </text>
                  )}
                </g>
              ));
            })}
            {picked.flatMap((s, i) =>
              s.events.map((ev) => (
                <g key={`${s.id}-${ev.id}`}>
                  <line
                    x1={x(ev.t + offset(s, layout))}
                    x2={x(ev.t + offset(s, layout))}
                    y1={top}
                    y2={top + h}
                    stroke="#aaa79b"
                    strokeDasharray="3 4"
                  />
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`${displayText(ev.label)}, ${s.participantLabel}, ${timeLabel(ev.t)}`}
                    onClick={() =>
                      setEventDetail(
                        `${s.participantLabel} · ${displayText(s.title)} · ${displayText(ev.label)} · ${timeLabel(ev.t)}${ev.value !== undefined ? ` · ${ev.value}` : ""}`,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setEventDetail(
                          `${s.participantLabel} · ${displayText(ev.label)} · ${timeLabel(ev.t)}${ev.value !== undefined ? ` · ${ev.value}` : ""}`,
                        );
                      }
                    }}
                  >
                    <title>
                      {displayText(ev.label)} · {timeLabel(ev.t)}
                    </title>
                    <circle
                      cx={x(ev.t + offset(s, layout))}
                      cy={top + h - 8 - i * 14}
                      r={5}
                      fill="#7b8079"
                    />
                    <rect
                      x={x(ev.t + offset(s, layout)) - 12}
                      y={top + h - 20 - i * 14}
                      width={24}
                      height={24}
                      fill="transparent"
                    />
                  </g>
                </g>
              )),
            )}
            {series.map((s, i) => {
              const o = offset(
                picked.find((p) => p.id === s.sessionId)!,
                layout,
              );
              let prev: number | null = null;
              const d = s.points
                .map((p) => {
                  if (p.quality !== "measured") {
                    prev = null;
                    return "";
                  }
                  const br =
                    prev === null ||
                    s.gaps.some((g) => g.from >= prev! && g.to <= p.t);
                  const v =
                    panel.axis === "normalized"
                      ? (p.value - (s.summary.mean ?? 0)) / (s.summary.sd || 1)
                      : p.value;
                  prev = p.t;
                  return `${br ? "M" : "L"}${x(p.t + o).toFixed(2)},${y(v, i).toFixed(2)}`;
                })
                .join(" ");
              return (
                <path
                  key={`${s.sessionId}-${s.signal}`}
                  d={d}
                  fill="none"
                  stroke={color(i)}
                  strokeWidth={panel.lineWidth}
                  opacity={panel.opacity}
                  strokeDasharray={
                    i >= panel.signalKinds.length ? "6 3" : undefined
                  }
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {cursor !== null && (
              <g data-testid="shared-cursor">
                <line
                  x1={x(cursor)}
                  x2={x(cursor)}
                  y1={top}
                  y2={top + h}
                  stroke="#243c36"
                  strokeDasharray="2 3"
                />
              </g>
            )}
          </g>
        </svg>
      )}
      {eventDetail && (
        <div className="event-popover" role="status">
          {eventDetail}
          <button onClick={() => setEventDetail(null)}>Close event</button>
        </div>
      )}
      {cursor !== null && (
        <div className="cursor-values" aria-live="polite">
          <span>{timeLabel(cursor, layout.alignment === "absolute")}</span>
          {series.map((s, i) => {
            const t =
              cursor -
              offset(
                picked.find((p) => p.id === s.sessionId)!,
                layout,
              );
            const gap = s.gaps.find((g) => t >= g.from && t <= g.to);
            const nearest = s.points.reduce<Series["points"][number] | null>(
              (best, p) =>
                !best || Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best,
              null,
            );
            const value =
              gap ||
              !nearest ||
              Math.abs(nearest.t - t) > signals[s.signal].gapMs
                ? "No data"
                : nearest.quality !== "measured"
                  ? "Uncertain data"
                  : `${nearest.value.toFixed(s.signal === "phoneacc" ? 2 : 1)} ${signals[s.signal].unit}`;
            return (
              <span
                key={`${s.sessionId}-${s.signal}`}
                style={{ color: color(i) }}
              >
                {picked.find((p) => p.id === s.sessionId)?.participantLabel} ·{" "}
                {displayText(
                  picked.find((p) => p.id === s.sessionId)?.title ?? "",
                )}{" "}
                · {signals[s.signal].name}: {value}
              </span>
            );
          })}
          <small>Nearest displayed sample</small>
        </div>
      )}
      {selection && (
        <section
          className="interval-stats"
          aria-label="Selected interval statistics"
        >
          <header>
            <h3>
              Selected interval · {timeLabel(selection[0])}–
              {timeLabel(selection[1])}
            </h3>
            <button onClick={() => onRange(selection)}>Zoom to interval</button>
            <button onClick={() => onSelect(null)}>Clear interval</button>
          </header>
          {statsError ? (
            <p role="alert">{statsError}</p>
          ) : selectedStats.key !== statsKey ? (
            <p>Loading interval statistics…</p>
          ) : (
            selectedStats.series.map((s) => (
              <div key={`${s.sessionId}-${s.signal}`}>
                <span>
                  {sessionLabel(s.sessionId)} · {signals[s.signal].name}
                </span>
                <strong>
                  Mean {s.summary.mean?.toFixed(1) ?? "—"}{" "}
                  {signals[s.signal].unit}
                </strong>
                <span>
                  Min {s.summary.min?.toFixed(1) ?? "—"} · Max{" "}
                  {s.summary.max?.toFixed(1) ?? "—"}
                </span>
              </div>
            ))
          )}
        </section>
      )}
      <div className="chart-summary">
        <details className="chart-data-details">
          <summary>Data quality</summary>
          <p>
            {series
              .reduce((a, s) => a + s.summary.count, 0)
              .toLocaleString("en-GB")}{" "}
            valid samples · {series.reduce((a, s) => a + s.gaps.length, 0)}{" "}
            gaps. Statistics use the visible interval. Gaps are not
            interpolated.
            {panel.axis === "normalized"
              ? " Normalization: z = (x − μ) / σ."
              : ""}
          </p>
        </details>
      </div>
    </>
  );
}
