"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  WaveformIcon,
  SlidersHorizontalIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  ArrowClockwiseIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { Session, Series, SignalKind, signals } from "@/core/contract";
import { displayText } from "@/core/presentation";
import { api as sharedApi, Range } from "./Chart";
import ReviewCanvas from "./ReviewCanvas";
import TrainingSummary from "./TrainingSummary";
import { ReviewCard, readCards } from "@/core/reviewLayout";

const api = <T,>(path: string, body?: unknown) =>
  sharedApi<T>(`mvp/${path}`, body);
const date = (n: number) =>
  new Date(n).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const countLabel = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;
const duration = (n: number) =>
  `${Math.floor(n / 60000)}:${String(Math.floor(n / 1000) % 60).padStart(2, "0")}`;
type Location = { group: string | null; recording: string | null };
function readLocation(): Location {
  const q = new URLSearchParams(window.location.search);
  return { group: q.get("group"), recording: q.get("session") };
}
export default function SessionWorkspace() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [location, setLocation] = useState<Location>({
    group: null,
    recording: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  async function refresh() {
    try {
      setSessions(await api<Session[]>("sessions"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sessions");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setLocation(readLocation());
    const pop = () => setLocation(readLocation());
    window.addEventListener("popstate", pop);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 10000);
    return () => {
      window.removeEventListener("popstate", pop);
      clearInterval(timer);
    };
  }, []);
  function navigate(group: string | null, recording: string | null = null) {
    const q = new URLSearchParams();
    if (group !== null) q.set("group", group);
    if (recording) q.set("session", recording);
    window.history.pushState(null, "", q.size ? `?${q}` : "/");
    setLocation({ group, recording });
    setQuery("");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => heading.current?.focus());
  }
  const selected = sessions.find((s) => s.id === location.recording);
  const group = location.group ?? (selected ? selected.title : null);
  const groups = [
    ...new Set(
      [...sessions]
        .sort((a, b) => b.startedAt - a.startedAt)
        .map((s) => s.title),
    ),
  ];
  const recordings = sessions
    .filter((s) => s.title === group)
    .sort((a, b) => b.startedAt - a.startedAt);
  return (
    <div className="simple-apex mvp-apex">
      <a className="simple-skip" href="#workspace">
        Skip to content
      </a>
      <header className="simple-topbar">
        <a
          className="simple-brand"
          href="/"
          onClick={(e) => {
            if (!e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              navigate(null);
            }
          }}
        >
          <WaveformIcon weight="bold" />
          apex
        </a>
      </header>
      <main className="simple-main" id="workspace">
        {error && (
          <div className="simple-error" role="alert">
            {error}
            <button onClick={refresh}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="simple-loading" role="status">
            Loading sessions…
            <div />
            <div />
          </div>
        ) : location.recording ? (
          selected ? (
            <SessionReview
              key={selected.id}
              session={selected}
              onBack={() => navigate(selected.title)}
              headingRef={heading}
            />
          ) : (
            <section className="simple-empty">
              <h1>Recording unavailable</h1>
              <button onClick={() => navigate(null)}>All sessions</button>
            </section>
          )
        ) : (
          <>
            {group !== null && (
              <button className="simple-back" onClick={() => navigate(null)}>
                <ArrowLeftIcon />
                All sessions
              </button>
            )}
            <div className="simple-page-title">
              <div>
                <span className="simple-kicker">
                  {group !== null ? "Session" : "Workspace"}
                </span>
                <h1 ref={heading} tabIndex={-1}>
                  {group !== null ? displayText(group) : "Sessions"}
                </h1>
                <p className="mvp-page-count">
                  {group !== null
                    ? countLabel(
                        new Set(recordings.map((s) => s.participantId)).size,
                        "participant",
                      )
                    : countLabel(groups.length, "session")}
                </p>
              </div>
              <button
                className="mvp-refresh"
                onClick={refresh}
                aria-label="Refresh"
                title="Refresh sessions"
              >
                <ArrowClockwiseIcon />
              </button>
            </div>
            <div className="mvp-list-toolbar">
              <label className="mvp-search">
                <MagnifyingGlassIcon aria-hidden="true" />
                <span className="sr-only">
                  {group !== null ? "Search participants" : "Search sessions"}
                </span>
                <input
                  type="search"
                  placeholder={
                    group !== null ? "Search participants…" : "Search sessions…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <span className="mvp-list-caption">
                {group !== null ? "Participants" : "Recent sessions"}
              </span>
            </div>
            <section
              className={
                group !== null
                  ? "mvp-session-grid mvp-participants"
                  : "mvp-session-grid"
              }
              aria-label={group !== null ? "Participants" : "Sessions"}
            >
              {group === null
                ? groups
                    .filter((title) =>
                      displayText(title)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .map((title) => {
                      const rows = sessions.filter((s) => s.title === title);
                      const latest = Math.max(...rows.map((s) => s.startedAt));
                      return (
                        <a
                          className="mvp-session-card"
                          key={title}
                          href={`?group=${encodeURIComponent(title)}`}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey) {
                              e.preventDefault();
                              navigate(title);
                            }
                          }}
                        >
                          <span
                            className="mvp-session-symbol"
                            aria-hidden="true"
                          >
                            <WaveformIcon weight="regular" />
                          </span>
                          <div className="mvp-session-name">
                            <h2>{displayText(title)}</h2>
                            <span>
                              {new Set(rows.map((s) => s.participantId)).size}{" "}
                              {new Set(rows.map((s) => s.participantId))
                                .size === 1
                                ? "participant"
                                : "participants"}
                              <span className="mvp-meta-dot">·</span>
                              {rows.length}{" "}
                              {rows.length === 1 ? "recording" : "recordings"}
                            </span>
                          </div>
                          {rows.every((s) => s.demo) && (
                            <small className="simple-demo-tag">Demo</small>
                          )}
                          <time
                            className="mvp-card-date"
                            dateTime={new Date(latest).toISOString()}
                          >
                            {date(latest)}
                          </time>
                          <span className="mvp-row-arrow" aria-hidden="true">
                            <CaretRightIcon />
                          </span>
                        </a>
                      );
                    })
                : [
                    ...new Map(
                      recordings.map((s) => [
                        s.participantId,
                        s.participantLabel,
                      ]),
                    ).entries(),
                  ]
                    .filter(([, name]) =>
                      name.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map(([id, name]) => (
                      <article className="mvp-session-card" key={id}>
                        <div className="mvp-participant-heading">
                          <span className="mvp-avatar" aria-hidden="true">
                            {name
                              .split(/\s+/)
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <div>
                            <h2>{name}</h2>
                            <span>
                              {
                                recordings.filter((s) => s.participantId === id)
                                  .length
                              }{" "}
                              {recordings.filter((s) => s.participantId === id)
                                .length === 1
                                ? "recording"
                                : "recordings"}
                            </span>
                          </div>
                        </div>
                        {recordings
                          .filter((s) => s.participantId === id)
                          .map((s) => (
                            <a
                              className="mvp-recording-link"
                              key={s.id}
                              href={`?session=${s.id}`}
                              onClick={(e) => {
                                if (!e.metaKey && !e.ctrlKey) {
                                  e.preventDefault();
                                  navigate(group, s.id);
                                }
                              }}
                            >
                              <span>
                                {date(s.startedAt)} · {duration(s.durationMs)}
                                {s.demo && (
                                  <small className="simple-demo-tag">
                                    Demo
                                  </small>
                                )}
                              </span>
                              <ArrowRightIcon />
                            </a>
                          ))}
                      </article>
                    ))}
            </section>
            {!(group === null ? groups.length : recordings.length) && (
              <section className="simple-empty">
                <WaveformIcon />
                <h2>No sessions yet</h2>
                <p>Record a session in the mobile app to get started.</p>
              </section>
            )}
            {query &&
              !(group === null
                ? groups.some((t) =>
                    displayText(t).toLowerCase().includes(query.toLowerCase()),
                  )
                : recordings.some((s) =>
                    s.participantLabel
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )) && <p className="simple-empty">No results</p>}
          </>
        )}
      </main>
    </div>
  );
}
function SessionReview({
  session: s,
  onBack,
  headingRef,
}: {
  session: Session;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [available, setAvailable] = useState<SignalKind[] | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [summaries, setSummaries] = useState<Partial<
    Record<SignalKind, Series>
  > | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [range, setRange] = useState<Range>([0, s.durationMs]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selection, setSelection] = useState<Range | null>(null);
  const previous = useRef<ReviewCard[]>([]);
  const key = `apex-mvp-layout-v1:${s.id}`;
  const defaults = (kinds: SignalKind[]): ReviewCard[] =>
    kinds.map((k) => ({ id: `chart-${k}`, kind: "signal", signals: [k] }));
  useEffect(() => {
    let active = true;
    setError("");
    api<{ signal: SignalKind; count: number }[]>(`sessions/${s.id}/signals`)
      .then(async (rows) => {
        const kinds = (Object.keys(signals) as SignalKind[]).filter((k) =>
          rows.some((r) => r.signal === k && r.count > 0),
        );
        const data = await Promise.all(
          kinds.map(
            async (k) =>
              [
                k,
                await api<Series>(`sessions/${s.id}/series?signal=${k}`),
              ] as const,
          ),
        );
        if (!active) return;
        let saved: ReviewCard[] | null = null;
        try {
          const raw = localStorage.getItem(key);
          if (raw) saved = readCards(raw, kinds, false, false);
        } catch {}
        setCards(saved ?? defaults(kinds));
        setAvailable(kinds);
        setSummaries(Object.fromEntries(data));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [s.id, key, retry]);
  function persist(next: ReviewCard[]) {
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, cards: next }));
      setNotice("");
    } catch {
      setNotice("Layout could not be saved in this browser.");
    }
  }
  async function exportCSV() {
    setExporting(true);
    setError("");
    try {
      let after = -1;
      const lines = [
        "signal,index,t_ms,received_at_unix_ms,sensor_time,value,quality",
      ];
      while (true) {
        const { points } = await api<{
          points: (import("@/core/contract").Sample & { cursor: number })[];
        }>(`sessions/${s.id}/raw?after=${after}`);
        if (!points.length) break;
        for (const p of points)
          lines.push(
            [
              p.signal,
              p.index,
              p.t,
              p.receivedAt,
              `"${(p.sensorTime ?? "").replaceAll('"', '""')}"`,
              p.value,
              p.quality,
            ].join(","),
          );
        after = points[points.length - 1].cursor;
      }
      const url = URL.createObjectURL(
        new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `${s.id}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }
  return (
    <>
      <button
        className="simple-back"
        onClick={onBack}
        aria-label={`${displayText(s.title)} · Participants`}
      >
        <ArrowLeftIcon />
        <span>{displayText(s.title)}</span>
        <CaretRightIcon />
        <span>Participants</span>
      </button>
      <div className="simple-page-title simple-review-title">
        <div>
          <span className="simple-kicker">
            {displayText(s.title)}
            {s.demo && <span className="simple-demo-tag">Demo</span>}
          </span>
          <h1 ref={headingRef} tabIndex={-1}>
            {s.participantLabel}
          </h1>
          <p>
            {date(s.startedAt)}
            {s.state === "recording" && (
              <span className="mvp-recording-status">Recording</span>
            )}
          </p>
        </div>
        <div className="simple-review-tools">
          <button
            className="mvp-customize-button"
            aria-pressed={editing}
            disabled={!available?.length}
            onClick={() => {
              if (editing) return;
              previous.current = structuredClone(cards);
              setEditing(true);
            }}
          >
            <SlidersHorizontalIcon />
            Choose graphs
          </button>
          <button disabled={exporting} onClick={exportCSV}>
            <DownloadSimpleIcon />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>
      <div className="mvp-recording-strip">
        <span>
          <span className="mvp-stat-label">Duration</span>
          <strong>{duration(s.durationMs)}</strong>
        </span>
        <span>
          <span className="mvp-stat-label">Signals</span>
          <strong>{available?.length ?? "—"}</strong>
        </span>
        <span>
          <span className="mvp-stat-label">Device</span>
          <strong>
            {s.source.startsWith("polar-h10:") ||
            s.source === "mobile-synthetic-v2"
              ? "Polar H10"
              : s.demo
                ? "Demo recording"
                : "Recording"}
          </strong>
        </span>
      </div>
      <TrainingSummary session={s} />
      {error ? (
        <div className="simple-error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : available === null ? (
        <div className="simple-loading" role="status">
          Loading signals…
          <div />
          <div />
        </div>
      ) : !available.length ? (
        <section className="simple-empty">
          <h2>No signals yet</h2>
          <p>Send this recording from mobile, then refresh.</p>
        </section>
      ) : (
        <ReviewCanvas
          session={s}
          available={available}
          cards={cards}
          onChange={(next) => {
            setCards(next);
            if (!editing) persist(next);
          }}
          editing={editing}
          summaries={summaries}
          reports={null}
          timeline={null}
          range={range}
          cursor={cursor}
          selection={selection}
          onRange={(next) => {
            const width = Math.min(
              s.durationMs,
              Math.max(1, next[1] - next[0]),
            );
            const from = Math.max(0, Math.min(s.durationMs - width, next[0]));
            setRange([from, from + width]);
            setCursor(null);
            setSelection(null);
          }}
          onCursor={setCursor}
          onSelect={setSelection}
          notice={notice}
          onSave={() => {
            persist(cards);
            setEditing(false);
          }}
          onCancel={() => {
            setCards(previous.current);
            setEditing(false);
          }}
          onReset={() => {
            const next = defaults(available);
            setCards(next);
            persist(next);
            setEditing(false);
          }}
        />
      )}
      <details className="simple-recording-info">
        <summary>Recording details</summary>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{s.participantLabel}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{displayText(s.title)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{duration(s.durationMs)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{s.source}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{s.state === "ended" ? "Completed" : "Recording"}</dd>
          </div>
        </dl>
      </details>
    </>
  );
}
