"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  MagnifyingGlassIcon,
  MagnifyingGlassPlusIcon,
  ArrowCounterClockwiseIcon,
  SignOutIcon,
  WaveformIcon,
  SlidersHorizontalIcon,
  QuestionIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  Layout,
  Series,
  Session,
  SignalKind,
  Template,
  signals,
} from "@/core/contract";
import { displayText } from "@/core/presentation";
import Chart, { api, Range, timeLabel } from "./Chart";
import DashboardTour from "./DashboardTour";
import ReviewCanvas from "./ReviewCanvas";
import { ReviewCard, defaultCards, readCards } from "@/core/reviewLayout";

type User = { email: string; workspace: string };
const date = (n: number) =>
  new Date(n).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const duration = (n: number) =>
  `${Math.floor(n / 60000)} min${n % 60000 >= 1000 ? ` ${Math.floor(n / 1000) % 60} sec` : ""}`;
const signalHelp: Record<SignalKind, string> = {
  hr: "Heartbeats per minute (bpm). Follow how heart rate changes during the session.",
  rr: "Time between consecutive heartbeats, measured in milliseconds (ms).",
  phoneacc: "Movement recorded by the phone’s accelerometer, measured in g.",
  h10acc: "Movement recorded by the H10 accelerometer, measured in mg.",
  ecg: "Electrical activity of the heart, measured in microvolts (µV).",
};
function requestedSession() {
  return new URLSearchParams(window.location.search).get("session");
}

export default function SessionWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [participant, setParticipant] = useState("all");
  const [email, setEmail] = useState("demo@apexvip.local");
  const [password, setPassword] = useState("apex-demo-2026");
  const heading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [tour, setTour] = useState(false);
  const [welcome, setWelcome] = useState(false);
  useEffect(() => {
    if (!user) return;
    try {
      setWelcome(
        localStorage.getItem(`apex-tour-v1:${user.workspace}`) !== "done",
      );
    } catch {
      setWelcome(true);
    }
  }, [user?.workspace]);
  function dismissWelcome() {
    setWelcome(false);
    try {
      if (user) localStorage.setItem(`apex-tour-v1:${user.workspace}`, "done");
    } catch {}
  }
  const navigation = useRef(false);
  const lastSession = useRef<string | null>(null);
  const listScroll = useRef(0);

  useEffect(() => {
    setSelected(requestedSession());
    const pop = () => {
      navigation.current = true;
      setSelected(requestedSession());
    };
    window.addEventListener("popstate", pop);
    api<User>("me")
      .then(async (u) => {
        setUser(u);
        setSessions(await api<Session[]>("sessions"));
      })
      .catch((e) => {
        if (e.message !== "Sign in to continue") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => window.removeEventListener("popstate", pop);
  }, []);

  useEffect(() => {
    if (!navigation.current) return;
    const returnLink =
      !selected && lastSession.current
        ? document.getElementById(`session-${lastSession.current}`)
        : null;
    (returnLink ?? heading.current)?.focus({ preventScroll: true });
    window.scrollTo({ top: selected ? 0 : listScroll.current });
    navigation.current = false;
  }, [selected]);

  function navigate(id: string | null) {
    if (id === selected) return;
    if (id && !selected) {
      lastSession.current = id;
      listScroll.current = window.scrollY;
    }
    navigation.current = true;
    window.history.pushState(
      null,
      "",
      id ? `?session=${encodeURIComponent(id)}` : window.location.pathname,
    );
    setSelected(id);
    setError("");
  }

  async function signIn(demo: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ user: User }>("auth/login", { email, password });
      setUser(r.user);
      if (demo) await api("demo", {});
      setSessions(await api<Session[]>("sessions"));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setSessions(await api<Session[]>("sessions"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sessions.");
    } finally {
      setBusy(false);
    }
  }

  const session = sessions.find((s) => s.id === selected);
  const filtered = sessions
    .filter(
      (s) =>
        (participant === "all" || s.participantId === participant) &&
        `${displayText(s.title)} ${s.participantLabel}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.startedAt - a.startedAt);
  const participants = [
    ...new Map(
      sessions.map((s) => [s.participantId, s.participantLabel]),
    ).entries(),
  ];

  return (
    <div className="simple-apex">
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
          aria-label="APEX sessions"
        >
          <WaveformIcon weight="bold" />
          apex<span>Session review</span>
        </a>
        {user && (
          <div className="simple-header-tools">
            <button
              className="simple-tour-button"
              aria-haspopup="dialog"
              onClick={() => setTour(true)}
            >
              <QuestionIcon />
              Quick tour
            </button>
            <details className="simple-account">
              <summary aria-label="Account menu">
                {user.email.split("@")[0].slice(0, 2).toUpperCase()}
              </summary>
              <div>
                <span>{user.email}</span>
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api("auth/logout", {});
                      setUser(null);
                      setSessions([]);
                      navigate(null);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Could not sign out.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <SignOutIcon />
                  Sign out
                </button>
              </div>
            </details>
          </div>
        )}
      </header>
      <main
        id="workspace"
        className={user ? "simple-main" : "simple-main simple-auth-main"}
      >
        {error && (
          <div className="simple-error" role="alert">
            {error}
            {user && (
              <button onClick={refresh} disabled={busy}>
                Try again
              </button>
            )}
          </div>
        )}
        {user && !loading && welcome && (
          <aside className="apex-welcome">
            <div>
              <span className="welcome-mark">
                <WaveformIcon />
              </span>
              <div>
                <strong>A little guidance. A clearer picture.</strong>
                <p>Get to know the signals and make this workspace your own.</p>
              </div>
            </div>
            <button onClick={() => setTour(true)}>
              Show me around
              <ArrowRightIcon />
            </button>
            <button aria-label="Dismiss introduction" onClick={dismissWelcome}>
              <XIcon />
            </button>
          </aside>
        )}
        {loading ? (
          <div className="simple-loading" role="status">
            Loading sessions…
            <div />
            <div />
            <div />
          </div>
        ) : !user ? (
          <section className="simple-auth">
            <span className="simple-kicker">APEX</span>
            <h1>
              Your sessions.
              <br />A clearer picture.
            </h1>
            <p>Sign in to review your recordings.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void signIn(false);
              }}
            >
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Opening…" : "Sign in"}
                <ArrowRightIcon />
              </button>
            </form>
            <button
              className="simple-demo"
              onClick={() => signIn(true)}
              disabled={busy}
            >
              Open demo workspace
              <ArrowRightIcon />
            </button>
            <small>Explore with synthetic recordings.</small>
          </section>
        ) : selected ? (
          session ? (
            <SessionReview
              key={session.id}
              session={session}
              workspace={user.workspace}
              onBack={() => navigate(null)}
              headingRef={heading}
            />
          ) : (
            <section className="simple-empty">
              <h1 ref={heading} tabIndex={-1}>
                Session unavailable
              </h1>
              <p>This session could not be found in your workspace.</p>
              <button onClick={() => navigate(null)}>
                <ArrowLeftIcon />
                Back to sessions
              </button>
            </section>
          )
        ) : (
          <>
            <div className="simple-page-title">
              <div>
                <span className="simple-kicker">Your recordings</span>
                <h1 ref={heading} tabIndex={-1}>
                  Sessions<span>{sessions.length}</span>
                </h1>
                <p>Open a recording to review signals and self-reports.</p>
              </div>
              <button
                className="simple-refresh"
                disabled={busy}
                onClick={refresh}
              >
                {busy ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <section
              className="simple-session-list"
              aria-label="Recorded sessions"
            >
              <div className="simple-filters">
                <label className="simple-search">
                  <MagnifyingGlassIcon />
                  <span className="sr-only">Search sessions</span>
                  <input
                    type="search"
                    ref={searchInput}
                    placeholder="Search sessions or participants"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                {(query || participant !== "all") && (
                  <button
                    className="simple-clear-filters"
                    onClick={() => {
                      setQuery("");
                      setParticipant("all");
                      searchInput.current?.focus();
                    }}
                  >
                    Clear filters
                  </button>
                )}
                <label className="simple-participant">
                  <span className="sr-only">Participant</span>
                  <select
                    aria-label="Participant"
                    value={participant}
                    onChange={(e) => setParticipant(e.target.value)}
                  >
                    <option value="all">All participants</option>
                    {participants.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {filtered.length ? (
                <div className="simple-table-wrap">
                  <table className="simple-table">
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Participant</th>
                        <th>Recorded</th>
                        <th>Duration</th>
                        <th>
                          <span className="sr-only">Recording type</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <a
                              className="simple-session-link"
                              id={`session-${s.id}`}
                              href={`?session=${encodeURIComponent(s.id)}`}
                              onClick={(e) => {
                                if (!e.metaKey && !e.ctrlKey) {
                                  e.preventDefault();
                                  navigate(s.id);
                                }
                              }}
                            >
                              {displayText(s.title)}
                              <ArrowRightIcon />
                            </a>
                            <span className="simple-mobile-session-meta">
                              {date(s.startedAt)}
                              {s.demo && (
                                <span className="simple-demo-tag">Demo</span>
                              )}
                            </span>
                            {s.state === "recording" && (
                              <small>Recording in progress</small>
                            )}
                          </td>
                          <td>{s.participantLabel}</td>
                          <td>{date(s.startedAt)}</td>
                          <td>{duration(s.durationMs)}</td>
                          <td>
                            {s.demo && (
                              <span className="simple-demo-tag">Demo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="simple-empty">
                  <WaveformIcon />
                  <h2>
                    {sessions.length
                      ? "No matching sessions"
                      : "Your first session starts on mobile"}
                  </h2>
                  <p>
                    {sessions.length
                      ? "Try another search or clear your filters."
                      : "Record a session with APEX Mobile, then sync it here to review your signals."}
                  </p>
                </div>
              )}
              <div className="simple-list-footer">
                <span role="status" aria-live="polite">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "session" : "sessions"}
                  {participant !== "all" || query ? " found" : " recorded"}
                </span>
                <span>Newest first</span>
              </div>
            </section>
            {sessions.some((s) => s.demo) && (
              <p className="simple-demo-note">
                <span />
                Demo sessions contain synthetic data.
              </p>
            )}
          </>
        )}
      </main>
      {tour && (
        <DashboardTour
          key={selected ?? "sessions"}
          review={!!session}
          onClose={() => {
            setTour(false);
            dismissWelcome();
          }}
        />
      )}
      <footer className="simple-footer">
        <span>APEX</span>
        <span>Record. Review. Understand.</span>
      </footer>
    </div>
  );
}

function SessionReview({
  session: s,
  workspace,
  onBack,
  headingRef,
}: {
  session: Session;
  workspace: string;
  onBack: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [inventory, setInventory] = useState<SignalKind[] | null>(null);
  const [signal, setSignal] = useState<SignalKind>("hr");
  const [summaries, setSummaries] = useState<Partial<
    Record<SignalKind, Series>
  > | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [range, setRange] = useState<Range>([0, s.durationMs]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [selection, setSelection] = useState<Range | null>(null);
  const [customCards, setCustomCards] = useState<ReviewCard[] | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState("");
  const previousCards = useRef<ReviewCard[] | null>(null);
  const wasCustomizing = useRef(false);
  useEffect(() => {
    if (wasCustomizing.current && !customizing)
      document.querySelector<HTMLElement>("[data-tour=customize]")?.focus();
    wasCustomizing.current = customizing;
  }, [customizing]);
  const preferenceKey = `apex-review-v1:${workspace}:${s.id}`;

  useEffect(() => {
    let active = true;
    setError("");
    setInventory(null);
    Promise.all([
      api<{ signal: SignalKind; count: number }[]>(`sessions/${s.id}/signals`),
      api<Template[]>("templates"),
    ])
      .then(async ([rows, forms]) => {
        const available = Object.keys(signals).filter((k) =>
          rows.some((r) => r.signal === k && r.count > 0),
        ) as SignalKind[];
        if (!active) return;
        setInventory(available);
        try {
          const stored = localStorage.getItem(preferenceKey);
          if (stored)
            setCustomCards(
              readCards(
                stored,
                available,
                s.events.some((e) => e.type === "self-report"),
                s.events.some((e) => e.type !== "self-report"),
              ),
            );
        } catch {}
        setTemplates(forms);
        setSignal(available[0] ?? "hr");
        const series = await Promise.all(
          available.map(
            async (k) =>
              [
                k,
                await api<Series>(`sessions/${s.id}/series?signal=${k}`),
              ] as const,
          ),
        );
        if (active) setSummaries(Object.fromEntries(series));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [s.id, retry, preferenceKey]);

  async function exportCSV() {
    setExporting(true);
    setExportError("");
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
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(
        e instanceof Error ? e.message : "Export failed. Please try again.",
      );
    } finally {
      setExporting(false);
    }
  }

  const layout: Layout = {
    version: 1,
    id: `review-${s.id}`,
    title: s.title,
    alignment: "elapsed",
    anchorLabel: "",
    panels: [
      {
        id: `signal-${s.id}`,
        title: signals[signal].name,
        sessionIds: [s.id],
        signalKinds: [signal],
        axis: "shared",
        color: signals[signal].color,
        lineWidth: 2,
        opacity: 1,
        visible: true,
        width: 2,
        height: 390,
      },
    ],
  };
  const summary = summaries?.[signal]?.summary;
  const reports = s.events.filter((e) => e.type === "self-report");
  const events = s.events
    .filter((e) => e.type !== "self-report")
    .sort((a, b) => a.t - b.t);
  const reportSection =
    reports.length > 0 ? (
      <section className="simple-context">
        <h2>Self-reports</h2>
        <p>The participant’s own ratings.</p>
        <dl>
          {reports.map((e) => {
            const form = templates.find(
              (t) => t.id === e.formId && t.version === e.formVersion,
            );
            const q = form?.questions.find((q) => q.id === e.questionId);
            return (
              <div key={e.id}>
                <dt>
                  {displayText(e.label)}
                  <small>
                    {q
                      ? q.phase === "pre"
                        ? "Before session"
                        : "After session"
                      : timeLabel(e.t)}
                  </small>
                </dt>
                <dd>
                  {e.value ?? "—"}
                  {q && (
                    <small>
                      {" "}
                      / {q.max}{" "}
                      <span className="sr-only">
                        (scale {q.min} to {q.max})
                      </span>
                    </small>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>
    ) : null;
  const timelineSection =
    events.length > 0 ? (
      <section className="simple-context">
        <h2>Session timeline</h2>
        <p>Events and notes from the recording.</p>
        <ol>
          {events.map((e) => (
            <li key={e.id}>
              <time>{timeLabel(e.t)}</time>
              <span>{displayText(e.label)}</span>
            </li>
          ))}
        </ol>
      </section>
    ) : null;
  const fullRange = range[0] <= 0 && range[1] >= s.durationMs;
  function showRange(next: Range) {
    const width = Math.min(s.durationMs, Math.max(1000, next[1] - next[0]));
    const from = Math.max(0, Math.min(s.durationMs - width, next[0]));
    setRange([from, from + width]);
    setCursor(null);
    setSelection(null);
  }

  return (
    <>
      <button className="simple-back" onClick={onBack}>
        <ArrowLeftIcon />
        All sessions
      </button>
      <div className="simple-page-title simple-review-title">
        <div>
          <div className="simple-kicker">
            {s.participantLabel}
            {s.demo && <span className="simple-demo-tag">Demo</span>}
            {s.state === "recording" && <span>Recording in progress</span>}
          </div>
          <h1 ref={headingRef} tabIndex={-1}>
            {displayText(s.title)}
          </h1>
          <p>
            {date(s.startedAt)}
            <span className="simple-dot">·</span>
            {duration(s.durationMs)}
          </p>
        </div>
        <div className="simple-review-tools">
          <button
            data-tour="customize"
            aria-pressed={customizing}
            disabled={inventory === null || !!error}
            onClick={() => {
              if (customizing) {
                document.querySelector(".canvas-customizer")?.scrollIntoView({
                  behavior: matchMedia("(prefers-reduced-motion: reduce)")
                    .matches
                    ? "auto"
                    : "smooth",
                  block: "center",
                });
                return;
              }
              previousCards.current = customCards
                ? structuredClone(customCards)
                : null;
              setCustomCards(
                customCards ??
                  defaultCards(
                    signal,
                    !!reportSection,
                    !!timelineSection,
                  ).filter(
                    (c) =>
                      c.kind !== "signal" || inventory?.includes(c.signals[0]),
                  ),
              );
              setCustomizing(true);
              setLayoutNotice("");
            }}
          >
            <SlidersHorizontalIcon />
            Customize
          </button>
          <button onClick={exportCSV} disabled={exporting}>
            <DownloadSimpleIcon />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="simple-error">
          {exportError}
        </p>
      )}
      {error ? (
        <div className="simple-error" role="alert">
          {error}
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      ) : customCards && inventory !== null ? (
        <ReviewCanvas
          session={s}
          available={inventory}
          cards={customCards}
          onChange={(next) => {
            setCustomCards(next);
            setLayoutNotice("");
          }}
          editing={customizing}
          summaries={summaries}
          reports={reportSection}
          timeline={timelineSection}
          range={range}
          cursor={cursor}
          selection={selection}
          onRange={showRange}
          onCursor={setCursor}
          onSelect={setSelection}
          notice={layoutNotice}
          onSave={() => {
            if (!customCards.length) return;
            try {
              localStorage.setItem(
                preferenceKey,
                JSON.stringify({ version: 1, cards: customCards }),
              );
              setCustomizing(false);
              setLayoutNotice("Layout saved for this session on this browser.");
            } catch {
              setLayoutNotice(
                "Your browser could not save the layout. Keep editing or cancel to return to your previous view.",
              );
            }
          }}
          onCancel={() => {
            setCustomCards(previousCards.current);
            setCustomizing(false);
            setLayoutNotice("");
          }}
          onReset={() => {
            try {
              localStorage.removeItem(preferenceKey);
              setCustomCards(null);
              setCustomizing(false);
              setLayoutNotice("Default view restored.");
            } catch {
              setLayoutNotice(
                "Your browser could not reset the saved layout. Try again or cancel.",
              );
            }
          }}
        />
      ) : inventory === null ? (
        <div className="simple-loading" role="status">
          Loading recording…
          <div />
          <div />
        </div>
      ) : !inventory.length ? (
        <section className="simple-empty">
          <h2>No signals yet</h2>
          <p>
            The recording has no samples. Sync the session from APEX Mobile and
            refresh.
          </p>
        </section>
      ) : (
        <section className="simple-signal-panel" aria-label="Session signals">
          <div
            className="simple-signal-tabs"
            role="tablist"
            aria-label="Recorded signals"
          >
            {inventory.map((k, i) => (
              <button
                key={k}
                id={`tab-${k}`}
                role="tab"
                aria-selected={signal === k}
                aria-controls="signal-chart"
                tabIndex={signal === k ? 0 : -1}
                onClick={() => {
                  setSignal(k);
                  setCursor(null);
                }}
                onKeyDown={(e) => {
                  const target =
                    e.key === "ArrowRight"
                      ? (i + 1) % inventory.length
                      : e.key === "ArrowLeft"
                        ? (i - 1 + inventory.length) % inventory.length
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? inventory.length - 1
                            : null;
                  if (target === null) return;
                  e.preventDefault();
                  setSignal(inventory[target]);
                  setCursor(null);
                  document.getElementById(`tab-${inventory[target]}`)?.focus();
                }}
              >
                {k === "phoneacc" ? "Movement" : signals[k].name}
              </button>
            ))}
          </div>
          <div
            id="signal-chart"
            role="tabpanel"
            aria-labelledby={`tab-${signal}`}
          >
            <div className="simple-signal-heading">
              <div>
                <h2>{signals[signal].name}</h2>
                <p>{signalHelp[signal]}</p>
              </div>
              <div className="simple-signal-stats">
                <span>
                  Session average
                  <strong>
                    {summary?.mean?.toFixed(signal === "phoneacc" ? 2 : 0) ??
                      "—"}
                    <small>{signals[signal].unit}</small>
                  </strong>
                </span>
                <span>
                  Session peak
                  <strong>
                    {summary?.max?.toFixed(signal === "phoneacc" ? 2 : 0) ??
                      "—"}
                    <small>{signals[signal].unit}</small>
                  </strong>
                </span>
              </div>
            </div>
            <div className="simple-chart-controls" aria-label="Chart controls">
              <span className="simple-range-label">
                {fullRange ? "Full session" : "Zoomed in"}
                <strong>
                  {timeLabel(range[0])}–{timeLabel(range[1])}
                </strong>
              </span>
              <div>
                <button
                  disabled={range[1] - range[0] <= Math.min(1000, s.durationMs)}
                  onClick={() => {
                    const span = (range[1] - range[0]) / 2;
                    const mid = (range[0] + range[1]) / 2;
                    showRange([mid - span / 2, mid + span / 2]);
                  }}
                >
                  <MagnifyingGlassPlusIcon />
                  Zoom in
                </button>
                {!fullRange && (
                  <button onClick={() => showRange([0, s.durationMs])}>
                    <ArrowCounterClockwiseIcon />
                    Full session
                  </button>
                )}
              </div>
            </div>
            <Chart
              panel={layout.panels[0]}
              sessions={[s]}
              layout={layout}
              range={range}
              cursor={cursor}
              onCursor={setCursor}
              onRange={showRange}
              selection={selection}
              onSelect={setSelection}
              dragMode="zoom"
              compact
            />
            <div className="simple-chart-foot">
              <span>
                Shaded areas indicate missing data. All times are relative to
                session start.
              </span>
            </div>
          </div>
        </section>
      )}
      {!customCards && layoutNotice && (
        <p className="canvas-announcement" role="status">
          {layoutNotice}
        </p>
      )}
      {!customCards && (reports.length > 0 || events.length > 0) && (
        <div className="simple-context-grid">
          {reportSection}
          {timelineSection}
        </div>
      )}
      <details className="simple-recording-info">
        <summary>Recording details</summary>
        <dl>
          <div>
            <dt>Participant</dt>
            <dd>{s.participantLabel}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{s.source}</dd>
          </div>
          <div>
            <dt>Session ID</dt>
            <dd>{s.id}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{s.state === "ended" ? "Ended" : "Recording"}</dd>
          </div>
        </dl>
        {s.demo && <p>Synthetic demo recording.</p>}
      </details>
    </>
  );
}
