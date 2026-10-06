"use client";
import { useEffect, useRef, useState } from "react";
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
    return new Date(t).toLocaleTimeString("sv-SE", {
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
  if (!r.ok) throw Error(data.error || "Begäran misslyckades");
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
}: {
  panel: Panel;
  sessions: Session[];
  layout: Layout;
  range: Range;
  cursor: number | null;
  onCursor: (t: number) => void;
  onRange: (r: Range) => void;
}) {
  const [result, setResult] = useState<{ signature: string; series: Series[] }>(
      { signature: "", series: [] },
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
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
  const color = (i: number) =>
    i === 0 ? panel.color : signals[series[i].signal].color;
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
        Panelen är dold. Öppna inställningar för att visa den.
      </div>
    );
  if (missing.length)
    return (
      <div className="empty">
        Händelsen ”{layout.anchorLabel}” saknas i{" "}
        {missing.map((s) => s.participantLabel).join(", ")}. Välj en annan
        händelse eller tidsjustering.
      </div>
    );
  return (
    <>
      <div className="legend">
        {series.map((s, i) => (
          <span key={`${s.sessionId}-${s.signal}`}>
            <i style={{ background: color(i) }} />
            {picked.find((p) => p.id === s.sessionId)?.participantLabel}
            {picked.find((p) => p.id === s.sessionId)?.demo
              ? " (demo)"
              : ""} · {signals[s.signal].name}{" "}
            <b>
              {panel.axis === "normalized"
                ? "z (normaliserad)"
                : signals[s.signal].unit}
            </b>
          </span>
        ))}
        {loading && <small>Hämtar…</small>}
      </div>
      {error ? (
        <div role="alert" className="empty">
          {error}
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="chart"
          role="img"
          aria-label={`${panel.title}. Dra för intervall, plus och minus för zoom, piltangenter för panorering.`}
          tabIndex={0}
          viewBox={`0 0 ${width} ${h + top + bottom}`}
          onPointerMove={(e) => onCursor(pointer(e))}
          onPointerDown={(e) => {
            start.current = pointer(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const end = pointer(e);
            if (start.current !== null && Math.abs(end - start.current) > 1000)
              onRange([
                Math.min(start.current, end),
                Math.max(start.current, end),
              ]);
            start.current = null;
          }}
          onPointerCancel={() => {
            start.current = null;
          }}
          onKeyDown={(e) => {
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
                (range[1] - range[0]) * 0.2 * (e.key === "ArrowLeft" ? -1 : 1);
              onRange([range[0] + d, range[1] + d]);
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
                      {g.reason === "quality" ? "Osäker kvalitet" : "Datalucka"}
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
                  <text
                    x={x(ev.t + offset(s, layout)) + 4}
                    y={top + h - 8 - i * 16}
                  >
                    {ev.label}
                    {ev.value !== undefined ? ` · ${ev.value}` : ""}
                  </text>
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
      <div className="chart-summary">
        {series.map((s, i) => (
          <span key={`${s.sessionId}-${s.signal}`}>
            <strong style={{ color: color(i) }}>
              {s.summary.mean?.toFixed(s.signal === "phoneacc" ? 2 : 1) ?? "—"}{" "}
              {signals[s.signal].unit}
            </strong>
            <small>Medelvärde</small>
          </span>
        ))}
        <details className="chart-data-details">
          <summary>Datakvalitet</summary>
          <p>
            {series
              .reduce((a, s) => a + s.summary.count, 0)
              .toLocaleString("sv-SE")}{" "}
            giltiga samples · {series.reduce((a, s) => a + s.gaps.length, 0)}{" "}
            luckor. Medelvärden gäller synligt intervall. Luckor fylls inte i.
            {panel.axis === "normalized"
              ? " Normalisering: z = (x − μ) / σ."
              : ""}
          </p>
        </details>
      </div>
    </>
  );
}
