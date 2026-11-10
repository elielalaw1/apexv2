"use client";
import { formatSignalValue } from "@/core/format";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DotsSixVerticalIcon,
  XIcon,
  ArrowsSplitIcon,
  CheckIcon,
  MagnifyingGlassPlusIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { Layout, Series, Session, SignalKind, signals } from "@/core/contract";
import {
  ReviewCard,
  cardTitle,
  canCombine,
  combineCards,
  moveCard,
} from "@/core/reviewLayout";
import SignalInfo from "./SignalInfo";
import Chart, { Range, timeLabel } from "./Chart";

type Drag = {
  id: string;
  x: number;
  y: number;
  target: string | null;
  combine: boolean;
};
export default function ReviewCanvas({
  session,
  available,
  cards,
  onChange,
  editing,
  onSave,
  onCancel,
  onReset,
  summaries,
  reports,
  timeline,
  range,
  cursor,
  selection,
  onRange,
  onCursor,
  onSelect,
  notice,
}: {
  session: Session;
  available: SignalKind[];
  cards: ReviewCard[];
  onChange: (cards: ReviewCard[]) => void;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
  summaries: Partial<Record<SignalKind, Series>> | null;
  reports: React.ReactNode;
  timeline: React.ReactNode;
  range: Range;
  cursor: number | null;
  selection: Range | null;
  onRange: (range: Range) => void;
  onCursor: (t: number) => void;
  onSelect: (range: Range | null) => void;
  notice: string;
}) {
  const [infoCard, setInfoCard] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const origin = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lastMoved, setLastMoved] = useState<string | null>(null);
  const source = cards.find((c) => c.id === drag?.id);
  useEffect(() => {
    function cancel(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setInfoCard(null);
        origin.current = null;
        setDrag(null);
      }
    }
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const chartCount = cards.filter((c) => c.kind === "signal").length;
  const full = range[0] === 0 && range[1] === session.durationMs;
  function update(next: ReviewCard[], message: string, id?: string) {
    onChange(next);
    setAnnouncement(message);
    setLastMoved(id ?? null);
  }
  function combine(from: string, to: string) {
    const next = combineCards(cards, from, to);
    if (next === cards) return;
    update(next, "Graphs combined.", to);
    requestAnimationFrame(() =>
      document.getElementById(`card-title-${to}`)?.focus(),
    );
  }
  function toggle(kind: SignalKind | "reports" | "timeline") {
    const existing = cards.find((c) =>
      c.kind === "signal"
        ? c.signals.includes(kind as SignalKind)
        : c.kind === kind,
    );
    if (existing)
      update(
        cards.flatMap((c) => {
          if (c.id !== existing.id) return [c];
          if (c.kind !== "signal" || c.signals.length === 1) return [];
          return [{ ...c, signals: c.signals.filter((k) => k !== kind) }];
        }),
        "Graph hidden.",
      );
    else
      update(
        [
          ...cards,
          kind === "reports" || kind === "timeline"
            ? { id: crypto.randomUUID(), kind }
            : { id: crypto.randomUUID(), kind: "signal", signals: [kind] },
        ],
        "Graph added.",
      );
  }
  function move(id: string, delta: number) {
    const index = cards.findIndex((c) => c.id === id),
      target = cards[index + delta];
    if (!target) return;
    update(
      moveCard(cards, id, target.id),
      `${cardTitle(cards[index])} moved ${delta < 0 ? "earlier" : "later"}.`,
      id,
    );
  }
  function startDrag(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { id, x: e.clientX, y: e.clientY, moved: false };
  }
  function moveDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const o = origin.current;
    if (!o || (!o.moved && Math.hypot(e.clientX - o.x, e.clientY - o.y) < 6))
      return;
    o.moved = true;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-drop-card]");
    setDrag({
      id: o.id,
      x: e.clientX,
      y: e.clientY,
      target: target?.dataset.dropCard ?? null,
      combine: target?.dataset.dropAction === "combine",
    });
  }
  function endDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const o = origin.current;
    origin.current = null;
    if (o?.moved) {
      const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-drop-card]");
      const target = el?.dataset.dropCard;
      if (target && target !== o.id && cards.some((c) => c.id === target)) {
        if (el.dataset.dropAction === "combine") combine(o.id, target);
        else update(moveCard(cards, o.id, target), "Graph moved.", o.id);
      }
    }
    setDrag(null);
  }
  const layout: Layout = {
    version: 1,
    id: `canvas-${session.id}`,
    title: session.title,
    alignment: "elapsed",
    anchorLabel: "",
    panels: [],
  };

  return (
    <section
      className="review-canvas-workspace"
      aria-label="Your session layout"
      data-tour="canvas"
    >
      {editing && (
        <section
          className="canvas-customizer"
          aria-label="Customize session layout"
        >
          <div className="canvas-customizer-heading">
            <div>
              <h2>Choose graphs</h2>
            </div>
            <button
              className="primary"
              disabled={!cards.length}
              onClick={onSave}
            >
              <CheckIcon />
              Save layout
            </button>
          </div>
          <fieldset>
            <legend className="sr-only">Visible graphs</legend>
            {[
              ...available,
              ...(reports ? ["reports" as const] : []),
              ...(timeline ? ["timeline" as const] : []),
            ].map((kind) => {
              const active = cards.some((c) =>
                c.kind === "signal"
                  ? c.signals.includes(kind as SignalKind)
                  : c.kind === kind,
              );
              return (
                <label
                  key={kind}
                  className={
                    active ? "canvas-choice selected" : "canvas-choice"
                  }
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(kind)}
                  />
                  {kind === "reports"
                    ? "Self-reports"
                    : kind === "timeline"
                      ? "Session timeline"
                      : kind === "phoneacc"
                        ? "Movement"
                        : signals[kind].name}
                </label>
              );
            })}
          </fieldset>
          <div className="canvas-customizer-foot">
            <span className="sr-only">Saved on this browser.</span>
            <button onClick={onReset}>Restore default</button>
            <button onClick={onCancel}>Cancel</button>
          </div>
        </section>
      )}
      <div className="canvas-shared-controls">
        <span>
          <span className="canvas-linked-dot" />
          Timeline{" "}
          <strong>
            {timeLabel(range[0])}–{timeLabel(range[1])}
          </strong>
        </span>
        {chartCount > 0 && (
          <div>
            <button
              disabled={
                range[1] - range[0] <= Math.min(1000, session.durationMs)
              }
              onClick={() => {
                const mid = (range[0] + range[1]) / 2,
                  span = (range[1] - range[0]) / 4;
                onRange([mid - span, mid + span]);
              }}
            >
              <MagnifyingGlassPlusIcon />
              Zoom in
            </button>
            {!full && (
              <button onClick={() => onRange([0, session.durationMs])}>
                Full session
              </button>
            )}
          </div>
        )}
      </div>
      <p className="canvas-announcement" role="status">
        {notice || announcement}
      </p>
      {!cards.length && (
        <div className="simple-empty">
          <h2>No graphs selected</h2>
          <p>Select a signal above.</p>
        </div>
      )}
      <div className="review-card-grid" aria-label="Session cards">
        {cards.map((card, index) => {
          const title = cardTitle(card),
            signal = card.kind === "signal" ? card.signals[0] : null;
          const summary = signal ? summaries?.[signal]?.summary : null;
          const last = signal
            ? summaries?.[signal]?.points
                .filter((p) => p.quality === "measured")
                .at(-1)?.value
            : null;
          const latest =
            !!signal &&
            [
              "distance",
              "steps",
              "altitude",
              "pace",
              "speed",
              "hrzone",
            ].includes(signal);
          const primaryLabel =
            signal === "distance" || signal === "steps"
              ? "Total recorded"
              : signal === "altitude"
                ? "Final change"
                : latest
                  ? "Last recorded"
                  : "Average";
          const combinable = cards.filter((other) => canCombine(card, other));
          return (
            <article
              key={card.id}
              data-card-id={card.id}
              data-kind={card.kind}
              data-drop-card={card.id}
              data-drop-action="move"
              aria-label={title}
              className={`canvas-card${card.kind === "signal" ? " simple-signal-panel" : ""}${card.kind === "signal" && (card.signals.length > 1 || chartCount === 1) ? " canvas-card-wide" : ""}${drag?.id === card.id ? " canvas-card-dragging" : ""}${drag?.target === card.id ? " canvas-card-over" : ""}${lastMoved === card.id ? " canvas-card-moved" : ""}`}
            >
              <header className="canvas-card-header">
                {
                  <button
                    className="canvas-drag-handle"
                    aria-label={`Drag ${title}`}
                    title="Drag onto a graph to compare. Drop on a header to reorder."
                    onPointerDown={(e) => startDrag(e, card.id)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={() => {
                      origin.current = null;
                      setDrag(null);
                    }}
                  >
                    <DotsSixVerticalIcon />
                  </button>
                }
                <h2 id={`card-title-${card.id}`} tabIndex={-1}>
                  {signal && (
                    <span
                      className="mvp-signal-dot"
                      style={{ background: signals[signal].color }}
                      aria-hidden="true"
                    />
                  )}
                  {title}
                </h2>
                {card.kind === "signal" && (
                  <button
                    className="signal-info-toggle"
                    aria-label={`About ${title}`}
                    aria-expanded={infoCard === card.id}
                    aria-controls={`signal-info-${card.id}`}
                    title="About these signals"
                    onClick={() =>
                      setInfoCard(infoCard === card.id ? null : card.id)
                    }
                  >
                    <InfoIcon />
                  </button>
                )}
                {editing && (
                  <div className="canvas-card-actions">
                    <button
                      aria-label={`Move ${title} earlier`}
                      disabled={index === 0}
                      onClick={() => move(card.id, -1)}
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      aria-label={`Move ${title} later`}
                      disabled={index === cards.length - 1}
                      onClick={() => move(card.id, 1)}
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      aria-label={`Hide ${title}`}
                      onClick={() =>
                        update(
                          cards.filter((c) => c.id !== card.id),
                          `${title} hidden.`,
                        )
                      }
                    >
                      <XIcon />
                    </button>
                  </div>
                )}
              </header>
              {card.kind === "signal" && infoCard === card.id && (
                <SignalInfo
                  kinds={card.signals}
                  id={`signal-info-${card.id}`}
                />
              )}
              {card.kind === "signal" && (
                <>
                  {(editing ||
                    (card.kind === "signal" && card.signals.length > 1)) && (
                    <div className="canvas-combine-controls">
                      {card.signals.length > 1 ? (
                        <button
                          onClick={() => {
                            const next = cards.flatMap((c) =>
                              c.id === card.id
                                ? card.signals.map((k, i) => ({
                                    id: i === 0 ? card.id : crypto.randomUUID(),
                                    kind: "signal" as const,
                                    signals: [k],
                                  }))
                                : [c],
                            );
                            update(next, "Graphs separated.", card.id);
                          }}
                        >
                          <ArrowsSplitIcon />
                          Separate graphs
                        </button>
                      ) : (
                        combinable.length > 0 && (
                          <label>
                            <span className="sr-only">
                              Combine {title} with
                            </span>
                            <select
                              value=""
                              onChange={(e) => combine(card.id, e.target.value)}
                            >
                              <option value="">Combine with…</option>
                              {combinable.map((other) => (
                                <option key={other.id} value={other.id}>
                                  {cardTitle(other)}
                                </option>
                              ))}
                            </select>
                          </label>
                        )
                      )}
                    </div>
                  )}
                  {card.signals.length > 1 ? null : (
                    <div className="canvas-card-summary">
                      <span>
                        <span className="mvp-stat-label">{primaryLabel}</span>
                        <strong>
                          {signal
                            ? formatSignalValue(
                                signal,
                                latest ? last : summary?.mean,
                              )
                            : "—"}{" "}
                          <small>{signal && signals[signal].unit}</small>
                        </strong>
                      </span>
                      {!latest && (
                        <span>
                          <span className="mvp-stat-label">Peak</span>
                          <strong>
                            {signal
                              ? formatSignalValue(signal, summary?.max)
                              : "—"}{" "}
                            <small>{signal && signals[signal].unit}</small>
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
                  {new Set(card.signals.map((k) => signals[k].unit)).size >
                    2 && (
                    <p className="normalized-label">Normalized · z-score</p>
                  )}
                  <Chart
                    panel={{
                      id: `panel-${card.id}`,
                      title,
                      sessionIds: [session.id],
                      signalKinds: [...card.signals].sort((a, b) =>
                        a === card.signals[0]
                          ? -1
                          : b === card.signals[0]
                            ? 1
                            : Number(
                                signals[a].unit ===
                                  signals[card.signals[0]].unit,
                              ) -
                              Number(
                                signals[b].unit ===
                                  signals[card.signals[0]].unit,
                              ),
                      ),
                      axis:
                        new Set(card.signals.map((k) => signals[k].unit)).size >
                        1
                          ? new Set(card.signals.map((k) => signals[k].unit))
                              .size > 2
                            ? "normalized"
                            : "separate"
                          : "shared",
                      color: signals[card.signals[0]].color,
                      lineWidth: 2,
                      opacity: 1,
                      visible: true,
                      width: 2,
                      height: 280,
                    }}
                    sessions={[session]}
                    layout={layout}
                    range={range}
                    cursor={cursor}
                    onCursor={onCursor}
                    onRange={onRange}
                    selection={selection}
                    onSelect={onSelect}
                    dragMode="zoom"
                    compact
                    apiPrefix="mvp/"
                  />
                </>
              )}
              {card.kind === "reports" && reports}
              {card.kind === "timeline" && timeline}
              {source && canCombine(source, card) && (
                <div
                  className={`canvas-combine-zone${drag?.target === card.id && drag.combine ? " active" : ""}`}
                  data-drop-card={card.id}
                  data-drop-action="combine"
                >
                  <span>Drop to combine graphs</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {drag && source && (
        <div
          className="canvas-drag-ghost"
          style={{ transform: `translate(${drag.x + 14}px, ${drag.y + 14}px)` }}
        >
          <DotsSixVerticalIcon />
          {cardTitle(source)}
        </div>
      )}
    </section>
  );
}
