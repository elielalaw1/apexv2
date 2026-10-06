"use client";
import { useEffect, useState } from "react";
import {
  ActivityIcon,
  SquaresFourIcon,
  UsersIcon,
  ListBulletsIcon,
  ChartLineIcon,
  SlidersHorizontalIcon,
  BookmarkSimpleIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  SignOutIcon,
  ArrowsOutSimpleIcon,
  XIcon,
  FloppyDiskIcon,
} from "@phosphor-icons/react";
import {
  Session,
  Layout,
  Panel,
  signals,
  SignalKind,
  Template,
  defaultTemplate,
} from "@/core/contract";
import { displayText } from "@/core/presentation";
import QuestionnaireEditor from "./QuestionnaireEditor";
import Chart, { api, offset, Range, timeLabel } from "./Chart";
type View =
  | "Overview"
  | "Sessions"
  | "Participants"
  | "Analysis"
  | "Saved views"
  | "Settings";
const nav = [
  ["Overview", SquaresFourIcon],
  ["Sessions", ListBulletsIcon],
  ["Participants", UsersIcon],
  ["Analysis", ChartLineIcon],
  ["Saved views", BookmarkSimpleIcon],
  ["Settings", SlidersHorizontalIcon],
] as const;
function initialLayout(s: Session[], signal: SignalKind = "hr"): Layout {
  return {
    version: 1,
    id: crypto.randomUUID(),
    title: displayText(s[0].title),
    alignment: "elapsed",
    anchorLabel: "Arbete",
    panels: [
      {
        id: crypto.randomUUID(),
        title: signals[signal].name,
        sessionIds: s.slice(0, 4).map((x) => x.id),
        signalKinds: [signal],
        axis: "shared",
        color: signals[signal].color,
        lineWidth: 1.8,
        opacity: 1,
        visible: true,
        width: 2,
        height: 460,
      },
    ],
  };
}
function download(name: string, data: string, type = "text/plain") {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([data], { type }));
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function Dashboard() {
  const [user, setUser] = useState<{ email: string; workspace: string } | null>(
      null,
    ),
    [boot, setBoot] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [view, setView] = useState<View>("Overview"),
    [sessions, setSessions] = useState<Session[]>([]),
    [saved, setSaved] = useState<Layout[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [layout, setLayout] = useState<Layout | null>(null),
    [dirty, setDirty] = useState(false),
    [range, setRange] = useState<Range>([0, 900000]),
    [cursor, setCursor] = useState<number | null>(null),
    [editor, setEditor] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [detail, setDetail] = useState<Session | null>(null);
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [participantFilter, setParticipantFilter] = useState("all"),
    [task, setTask] = useState<"signal" | "compare" | null>(null),
    [compareQuery, setCompareQuery] = useState(""),
    [availability, setAvailability] = useState<Record<string, SignalKind[]>>(
      {},
    ),
    [availabilityError, setAvailabilityError] = useState(""),
    [selection, setSelection] = useState<Range | null>(null),
    [dragMode, setDragMode] = useState<"select" | "zoom" | "pan">("select"),
    [email, setEmail] = useState("demo@apexvip.local"),
    [password, setPassword] = useState("apex-demo-2026"),
    [form, setForm] = useState(
      JSON.stringify(
        { ...defaultTemplate, version: defaultTemplate.version + 1 },
        null,
        2,
      ),
    );
  function remember(id: string, workspace = user?.workspace) {
    try {
      if (workspace) localStorage.setItem(`apex-layout:${workspace}`, id);
    } catch {}
  }
  async function load(workspace = user?.workspace) {
    const [ss, ll, tt] = await Promise.all([
      api<Session[]>("sessions"),
      api<Layout[]>("layouts"),
      api<Template[]>("templates"),
    ]);
    setSessions(ss);
    setSaved(ll);
    setTemplates(tt);
    if (ss.length) {
      const available = (
        await api<{ signal: SignalKind; count: number }[]>(
          `sessions/${ss[0].id}/signals`,
        )
      )
        .filter((x) => x.count > 0)
        .map((x) => x.signal);
      const l = initialLayout(
        [ss[0]],
        available.includes("hr") ? "hr" : (available[0] ?? "hr"),
      );
      setLayout(l);
      reset(l, ss);
    }
  }
  useEffect(() => {
    api<{ email: string; workspace: string }>("me")
      .then(async (u) => {
        setUser(u);
        await load(u.workspace);
      })
      .catch((e) => {
        if (e.message !== "Sign in to continue") setError(e.message);
      })
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    let active = true;
    setAvailabilityError("");
    Promise.all(
      sessions.map(
        async (s) =>
          [
            s.id,
            (
              await api<{ signal: SignalKind; count: number }[]>(
                `sessions/${s.id}/signals`,
              )
            )
              .filter((x) => x.count > 0)
              .map((x) => x.signal),
          ] as const,
      ),
    )
      .then((rows) => {
        if (active) setAvailability(Object.fromEntries(rows));
      })
      .catch((e) => {
        if (active) setAvailabilityError(e.message);
      });
    return () => {
      active = false;
    };
  }, [sessions]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed");
    } finally {
      setBusy(false);
    }
  }
  async function signIn(demo = false) {
    await action(async () => {
      const r = await api<{ user: { email: string; workspace: string } }>(
        "auth/login",
        { email, password },
      );
      setUser(r.user);
      if (demo) await api("demo", {});
      await load(r.user.workspace);
    });
  }
  function reset(l = layout, ss = sessions) {
    if (!l) return;
    const selected = ss.filter((s) =>
      l.panels.some((p) => p.sessionIds.includes(s.id)),
    );
    const bounds = selected
      .filter(
        (s) =>
          l.alignment !== "event" ||
          s.events.some((e) => e.label === l.anchorLabel),
      )
      .flatMap((s) => [offset(s, l), offset(s, l) + s.durationMs]);
    setRange(
      bounds.length ? [Math.min(...bounds), Math.max(...bounds)] : [0, 900000],
    );
    setCursor(null);
    setSelection(null);
  }
  function change(l: Layout) {
    setLayout(l);
    setDirty(true);
  }
  function panelChange(id: string, patch: Partial<Panel>) {
    if (layout)
      change({
        ...layout,
        panels: layout.panels.map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      });
  }
  function open(l: Layout) {
    setLayout(structuredClone(l));
    setDirty(false);
    setView("Analysis");
    reset(l);
    setEditor(null);
    setEditing(false);
    setTask(null);
    setDetail(null);
  }
  async function compare(ss: Session[]) {
    const first = ss[0];
    let available = availability[first.id];
    if (!available) {
      try {
        available = (
          await api<{ signal: SignalKind; count: number }[]>(
            `sessions/${first.id}/signals`,
          )
        )
          .filter((x) => x.count > 0)
          .map((x) => x.signal);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not load available signals. Please try again.",
        );
        return;
      }
    }
    const signal = available?.includes("hr") ? "hr" : (available?.[0] ?? "hr");
    const l = initialLayout(ss, signal);
    if (ss.length > 1) l.title = "Session comparison";
    open(l);
    setDirty(false);
    if (!available?.includes("hr"))
      setNotice(
        available?.length
          ? `Heart rate is unavailable. Showing ${signals[signal].name}.`
          : "No signals have been recorded yet. Sync data from the mobile app.",
      );
  }
  function addSignal(signal: SignalKind, separate: boolean) {
    if (!layout) return;
    const first = layout.panels[0];
    if (separate || first.signalKinds.length >= 2) {
      change({
        ...layout,
        panels: [
          ...layout.panels,
          {
            ...first,
            id: crypto.randomUUID(),
            title: signals[signal].name,
            signalKinds: [signal],
            axis: "shared",
            color: signals[signal].color,
            width: 2,
            height: 380,
          },
        ],
      });
    } else {
      const kinds = [...new Set([...first.signalKinds, signal])];
      panelChange(first.id, {
        signalKinds: kinds,
        title: kinds.map((k) => signals[k].name).join(" & "),
        axis:
          new Set(kinds.map((k) => signals[k].unit)).size > 1
            ? "separate"
            : "shared",
      });
    }
    setTask(null);
  }
  function move(id: string, delta: number) {
    if (!layout) return;
    const a = [...layout.panels],
      i = a.findIndex((p) => p.id === id),
      j = i + delta;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    change({ ...layout, panels: a });
  }
  async function exportRaw(session: Session) {
    await action(async () => {
      let cursor = -1;
      const lines = [
        "signal,index,t_ms,received_at_unix_ms,sensor_time,value,quality",
      ];
      for (;;) {
        const data = await api<{
          points: {
            cursor: number;
            signal: string;
            index: number;
            t: number;
            receivedAt: number;
            sensorTime: string | null;
            value: number;
            quality: string;
          }[];
        }>(`sessions/${session.id}/raw?after=${cursor}`);
        if (!data.points.length) break;
        for (const p of data.points)
          lines.push(
            [
              p.signal,
              p.index,
              p.t,
              p.receivedAt,
              p.sensorTime ?? "",
              p.value,
              p.quality,
            ].join(","),
          );
        cursor = data.points[data.points.length - 1].cursor;
      }
      download(`${session.id}-raw.csv`, lines.join("\n"), "text/csv");
      setNotice("Raw data exported without normalization or downsampling.");
    });
  }
  if (boot)
    return (
      <main className="login">
        <ActivityIcon size={34} />
        <p>Opening workspace…</p>
      </main>
    );
  if (!user)
    return (
      <main className="login">
        <div className="login-box">
          <div className="brand">
            apex<span>VIP</span>
          </div>
          <p className="eyebrow">RECORDING · ANALYSIS · RESEARCH</p>
          <h1>
            One workspace for
            <br />
            every session.
          </h1>
          <p>
            Record signals, explore sessions and create your own analysis views.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void signIn();
            }}
          >
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary" disabled={busy}>
              Sign in
            </button>
            <button
              type="button"
              onClick={() => void signIn(true)}
              disabled={busy}
            >
              Open demo workspace <ArrowRightIcon />
            </button>
          </form>
          <small>
            The demo account is prefilled. All demo recordings are synthetic and
            use the same API as sensor recordings.
          </small>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
        <div className="login-art">
          <span>APEX / LAB 01</span>
          <ActivityIcon size={140} weight="thin" />
          <p>
            From recording
            <br />
            to understanding.
          </p>
          <small>Polar H10 · HR · RR · movement</small>
        </div>
      </main>
    );
  const filtered = sessions.filter(
    (s) =>
      (participantFilter === "all" || s.participantId === participantFilter) &&
      (kind === "all" || (kind === "demo" ? s.demo : !s.demo)) &&
      `${displayText(s.title)} ${displayText(s.title)} ${s.participantLabel} ${s.typeId}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const participants = [...new Set(sessions.map((s) => s.participantId))];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          apex<span>VIP</span>
        </div>
        <div className="workspace">
          <span className="workspace-symbol">A</span>
          <div>Coach workspace</div>
        </div>

        <nav>
          {nav
            .filter(([v]) => ["Overview", "Sessions", "Analysis"].includes(v))
            .map(([v, Icon]) => (
              <button
                key={v}
                className={view === v ? "active" : ""}
                onClick={() => {
                  setView(v);
                  setDetail(null);
                }}
              >
                <Icon size={19} />
                {v}
                {v === "Sessions" && <small>{sessions.length}</small>}
              </button>
            ))}
        </nav>
        <nav className="secondary-nav" aria-label="Administration">
          <button
            className={view === "Participants" ? "active" : ""}
            onClick={() => {
              setView("Participants");
              setDetail(null);
            }}
          >
            <UsersIcon />
            Participants
          </button>
          <button
            className={view === "Settings" ? "active" : ""}
            onClick={() => {
              setView("Settings");
              setDetail(null);
            }}
          >
            <SlidersHorizontalIcon />
            Settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot" />
          Your workspace
          <button
            onClick={() =>
              void action(async () => {
                await api("auth/logout", {});
                setUser(null);
                setSessions([]);
                setLayout(null);
              })
            }
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Workspace <span className="slash">/</span> <b>{view}</b>
          </span>
          <div>
            <span className="badge">
              {(() => {
                const ss =
                  view === "Analysis" && layout
                    ? sessions.filter((s) =>
                        layout.panels.some((p) => p.sessionIds.includes(s.id)),
                      )
                    : sessions;
                return ss.length && ss.every((s) => s.demo)
                  ? "Synthetic demo data"
                  : ss.some((s) => s.demo)
                    ? "Mixed demo & sensor data"
                    : "Sensor data";
              })()}
            </span>
            <span className="avatar">
              {user.email.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="content">
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <XIcon />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert">
              {notice}
              <button
                aria-label="Dismiss message"
                onClick={() => setNotice("")}
              >
                <XIcon />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {detail && view === "Sessions"
                  ? "Session details"
                  : view === "Overview"
                    ? "Your overview"
                    : view}
              </h1>
              <p>
                {view === "Analysis"
                  ? "Explore a session, then add signals or comparisons when needed."
                  : view === "Sessions"
                    ? "Find a session by name or participant."
                    : view === "Participants"
                      ? "Participant records and their sessions."
                      : view === "Settings"
                        ? "Manage session types, events and questionnaires."
                        : view === "Overview"
                          ? "Pick up where you left off."
                          : "Your workspace for recording and analysis."}
              </p>
            </div>
            {view === "Analysis" && layout && (
              <div className="actions">
                <button
                  id="customize-analysis"
                  aria-expanded={editing}
                  onClick={() => {
                    setEditing(!editing);
                    setEditor(!editing ? (layout.panels[0]?.id ?? null) : null);
                  }}
                >
                  <SlidersHorizontalIcon />
                  {editing ? "Done" : "Customize"}
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const l = await api<Layout>("layouts", layout);
                      setSaved((prev) => [
                        l,
                        ...prev.filter((x) => x.id !== l.id),
                      ]);
                      setDirty(false);
                      remember(l.id);
                      setNotice("View saved in your workspace.");
                    })
                  }
                >
                  <FloppyDiskIcon />
                  Save view
                </button>
              </div>
            )}
          </div>
          {!sessions.length && view !== "Settings" ? (
            <div className="empty large">
              <ActivityIcon size={40} />
              <h2>Ready for your first session</h2>
              <p>
                Sync a recording from the mobile app or load synthetic demo
                sessions.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api("demo", {});
                    await load();
                  })
                }
              >
                Load demo data
              </button>
            </div>
          ) : (
            <>
              {view === "Analysis" && layout && (
                <>
                  <section className="session-context">
                    <div>
                      {layout.panels[0]?.sessionIds.map((id) => {
                        const s = sessions.find((x) => x.id === id);
                        return s ? (
                          <div key={id} className="session-context-row">
                            <strong>{displayText(s.title)}</strong>
                            <button
                              className="participant-link"
                              onClick={() => {
                                setParticipantFilter(s.participantId);
                                setView("Sessions");
                              }}
                            >
                              {s.participantLabel}
                            </button>
                            <span>
                              {new Date(s.startedAt).toLocaleDateString(
                                "en-GB",
                              )}{" "}
                              · {Math.round(s.durationMs / 60000)} min
                            </span>
                            {s.demo && <span className="badge">Demo</span>}
                            <button
                              className="quiet-button"
                              onClick={() =>
                                setDetail(detail?.id === s.id ? null : s)
                              }
                            >
                              Session details
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <div className="task-actions">
                      <button
                        disabled={!layout.panels.length}
                        aria-expanded={task === "signal"}
                        onClick={() =>
                          setTask(task === "signal" ? null : "signal")
                        }
                      >
                        <PlusIcon />
                        Add signal
                      </button>
                      <button
                        disabled={!layout.panels.length}
                        aria-expanded={task === "compare"}
                        onClick={() =>
                          setTask(task === "compare" ? null : "compare")
                        }
                      >
                        <ChartLineIcon />
                        Compare sessions
                      </button>
                      <details className="view-menu">
                        <summary>View options</summary>
                        <div>
                          <label>
                            View name
                            <input
                              aria-label="Saved view name"
                              value={displayText(layout.title)}
                              onChange={(e) =>
                                change({ ...layout, title: e.target.value })
                              }
                            />
                          </label>
                          <select
                            aria-label="Open saved view"
                            value=""
                            onChange={(e) => {
                              const l = saved.find(
                                (x) => x.id === e.target.value,
                              );
                              if (l) open(l);
                            }}
                          >
                            <option value="">Open saved view…</option>
                            {saved.map((l) => (
                              <option key={l.id} value={l.id}>
                                {displayText(l.title)}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              change({
                                ...layout,
                                id: crypto.randomUUID(),
                                title: displayText(layout.title) + " · copy",
                              });
                              setNotice("Copy created. Rename and save it.");
                            }}
                          >
                            Duplicate view
                          </button>
                          <button
                            onClick={() =>
                              download(
                                `${layout.id}.json`,
                                JSON.stringify(
                                  { layout, visibleInterval: range },
                                  null,
                                  2,
                                ),
                                "application/json",
                              )
                            }
                          >
                            Export view JSON
                          </button>
                          <button onClick={() => setView("Saved views")}>
                            Manage saved views
                          </button>
                        </div>
                      </details>
                      {dirty && (
                        <span className="unsaved" role="status">
                          Unsaved changes
                        </span>
                      )}
                    </div>
                  </section>
                  {detail && (
                    <section className="inline-details">
                      <SessionDetail
                        session={detail}
                        onBack={() => setDetail(null)}
                        onAnalyze={() => setDetail(null)}
                        onExport={() => void exportRaw(detail)}
                        busy={busy}
                      />
                    </section>
                  )}
                  {task === "signal" && (
                    <section className="task-picker" aria-label="Add signal">
                      <h2>Add a signal</h2>
                      <p>
                        Choose the same chart for an overlay, or a separate
                        chart.
                      </p>
                      {availabilityError ? (
                        <p role="alert">
                          {availabilityError} Retry by reopening this workspace.
                        </p>
                      ) : !availability[layout.panels[0]?.sessionIds[0]] ? (
                        <p>Loading available signals…</p>
                      ) : (
                        availability[layout.panels[0]?.sessionIds[0]]
                          .filter(
                            (k) =>
                              !layout.panels.some((p) =>
                                p.signalKinds.includes(k),
                              ),
                          )
                          .map((k) => (
                            <div key={k}>
                              <span>
                                {signals[k].name}{" "}
                                <small>{signals[k].unit}</small>
                              </span>
                              <button onClick={() => addSignal(k, false)}>
                                Same chart
                              </button>
                              <button onClick={() => addSignal(k, true)}>
                                Separate chart
                              </button>
                            </div>
                          ))
                      )}
                      {availability[layout.panels[0]?.sessionIds[0]]?.every(
                        (k) =>
                          layout.panels.some((p) => p.signalKinds.includes(k)),
                      ) && <p>All available signals are already shown.</p>}
                      <button onClick={() => setTask(null)}>Close</button>
                    </section>
                  )}
                  {task === "compare" && (
                    <section
                      className="task-picker"
                      aria-label="Compare sessions"
                    >
                      <h2>Compare up to four sessions</h2>
                      <input
                        aria-label="Search comparison sessions"
                        placeholder="Search session or participant…"
                        value={compareQuery}
                        onChange={(e) => setCompareQuery(e.target.value)}
                      />
                      {sessions
                        .filter((s) =>
                          `${displayText(s.title)} ${s.participantLabel}`
                            .toLowerCase()
                            .includes(compareQuery.toLowerCase()),
                        )
                        .map((s) => (
                          <label className="compare-choice" key={s.id}>
                            <input
                              type="checkbox"
                              checked={layout.panels[0].sessionIds.includes(
                                s.id,
                              )}
                              disabled={
                                !layout.panels[0].sessionIds.includes(s.id) &&
                                layout.panels[0].sessionIds.length >= 4
                              }
                              onChange={(e) => {
                                const ids = e.target.checked
                                  ? [...layout.panels[0].sessionIds, s.id]
                                  : layout.panels[0].sessionIds.filter(
                                      (id) => id !== s.id,
                                    );
                                if (ids.length) {
                                  const l = {
                                    ...layout,
                                    alignment: "elapsed" as const,
                                    panels: layout.panels.map((p) => ({
                                      ...p,
                                      sessionIds: ids,
                                    })),
                                  };
                                  change(l);
                                  reset(l);
                                }
                              }}
                            />
                            <span>
                              {s.participantLabel} · {displayText(s.title)}
                              <small>
                                {new Date(s.startedAt).toLocaleDateString(
                                  "en-GB",
                                )}{" "}
                                · {Math.round(s.durationMs / 60000)} min
                                {s.demo ? " · Demo" : ""}
                              </small>
                            </span>
                          </label>
                        ))}
                      {!sessions.some((s) =>
                        `${displayText(s.title)} ${s.participantLabel}`
                          .toLowerCase()
                          .includes(compareQuery.toLowerCase()),
                      ) && <p>No matching sessions. Try another search.</p>}
                      <button onClick={() => setTask(null)}>
                        Done comparing
                      </button>
                    </section>
                  )}
                  <div className="analysis-toolbar" hidden={!editing}>
                    <div>
                      <label className="sr-only" htmlFor="layout-name">
                        View name
                      </label>
                      <input
                        id="layout-name"
                        className="layout-name"
                        value={displayText(layout.title)}
                        onChange={(e) =>
                          change({ ...layout, title: e.target.value })
                        }
                      />
                      <span className="subtle">
                        {dirty ? "Unsaved changes" : "Saved"}
                      </span>
                    </div>
                    <div>
                      <select
                        aria-label="Open saved view"
                        value=""
                        onChange={(e) => {
                          const l = saved.find((l) => l.id === e.target.value);
                          if (l) open(l);
                        }}
                      >
                        <option value="">Open a saved view…</option>
                        {saved.map((l) => (
                          <option key={l.id} value={l.id}>
                            {displayText(l.title)}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const id = crypto.randomUUID();
                          change({
                            ...layout,
                            panels: [
                              ...layout.panels,
                              {
                                id,
                                title: "New chart",
                                sessionIds: [sessions[0].id],
                                signalKinds: [
                                  availability[sessions[0].id]?.includes("hr")
                                    ? "hr"
                                    : (availability[sessions[0].id]?.[0] ??
                                      "hr"),
                                ],
                                axis: "shared",
                                color: signals.hr.color,
                                lineWidth: 1.8,
                                opacity: 1,
                                visible: true,
                                width: 1,
                                height: 320,
                              },
                            ],
                          });
                          setEditor(id);
                        }}
                      >
                        <PlusIcon />
                        Add chart
                      </button>
                    </div>
                  </div>
                  <div className="timeline-controls">
                    <label className="gesture-mode">
                      Drag to
                      <select
                        aria-label="Chart interaction"
                        value={dragMode}
                        onChange={(e) =>
                          setDragMode(e.target.value as typeof dragMode)
                        }
                      >
                        <option value="select">Select interval</option>
                        <option value="zoom">Zoom</option>
                        <option value="pan">Pan</option>
                      </select>
                    </label>
                    <label hidden={!editing}>
                      Time alignment{" "}
                      <select
                        value={layout.alignment}
                        onChange={(e) => {
                          const l = {
                            ...layout,
                            alignment: e.target.value as Layout["alignment"],
                          };
                          change(l);
                          reset(l);
                        }}
                      >
                        <option value="elapsed">Session start</option>
                        <option value="absolute">Absolute time</option>
                        <option value="event">Align to event</option>
                      </select>
                    </label>
                    {editing && layout.alignment === "event" && (
                      <label>
                        Event
                        <input
                          value={layout.anchorLabel}
                          onChange={(e) => {
                            const l = {
                              ...layout,
                              anchorLabel:
                                sessions
                                  .flatMap((s) => s.events)
                                  .find(
                                    (ev) =>
                                      displayText(ev.label) === e.target.value,
                                  )?.label ?? e.target.value,
                            };
                            change(l);
                            reset(l);
                          }}
                        />
                      </label>
                    )}
                    <datalist id="anchor-events">
                      {[
                        ...new Set(
                          sessions.flatMap((s) => s.events.map((e) => e.label)),
                        ),
                      ].map((label) => (
                        <option key={label} value={displayText(label)}>
                          {displayText(label)}
                        </option>
                      ))}
                    </datalist>
                    <div className="zoom-buttons">
                      <button
                        aria-label="Pan left"
                        onClick={() => {
                          const d = (range[1] - range[0]) * 0.25;
                          setRange([range[0] - d, range[1] - d]);
                        }}
                      >
                        <ArrowLeftIcon />
                      </button>
                      <button
                        aria-label="Zoom in"
                        onClick={() => {
                          const mid = (range[0] + range[1]) / 2,
                            d = (range[1] - range[0]) * 0.3;
                          setRange([mid - d, mid + d]);
                        }}
                      >
                        +
                      </button>
                      <button
                        aria-label="Zoom out"
                        onClick={() => {
                          const mid = (range[0] + range[1]) / 2,
                            d = (range[1] - range[0]) * 0.8;
                          setRange([mid - d, mid + d]);
                        }}
                      >
                        −
                      </button>
                      <button
                        aria-label="Pan right"
                        onClick={() => {
                          const d = (range[1] - range[0]) * 0.25;
                          setRange([range[0] + d, range[1] + d]);
                        }}
                      >
                        <ArrowRightIcon />
                      </button>
                      <button onClick={() => reset()}>
                        <ArrowsOutSimpleIcon />
                        Full session
                      </button>
                    </div>
                    <span className="time-range" data-testid="time-range">
                      {timeLabel(range[0], layout.alignment === "absolute")} —{" "}
                      {timeLabel(range[1], layout.alignment === "absolute")}
                    </span>
                  </div>
                  <div className="analysis-caption">
                    <span>
                      <i className="status-dot" />
                      Shared timeline
                    </span>
                    <span>
                      Cursor{" "}
                      {cursor === null
                        ? "—"
                        : timeLabel(
                            cursor,
                            layout.alignment === "absolute",
                          )}{" "}
                      · Drag to select an interval
                    </span>
                  </div>
                  {!layout.panels.length && (
                    <div className="empty">
                      This saved view has no charts. Open Customize and choose
                      Add chart.
                    </div>
                  )}
                  <div className="panel-grid">
                    {layout.panels.map((p, i) => (
                      <section
                        className="panel"
                        key={p.id}
                        style={{ gridColumn: `span ${p.width}` }}
                        draggable={editing && editor !== p.id}
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", p.id)
                        }
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          const list = layout.panels.filter((x) => x.id !== id),
                            moved = layout.panels.find((x) => x.id === id);
                          if (moved) {
                            list.splice(i, 0, moved);
                            change({ ...layout, panels: list });
                          }
                        }}
                      >
                        <header className="panel-heading">
                          <div>
                            <span className="panel-number">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <h2>{displayText(p.title)}</h2>
                          </div>
                          <div>
                            <button
                              hidden={!editing}
                              title="Move up"
                              aria-label={`Move ${p.title} up`}
                              disabled={i === 0}
                              onClick={() => move(p.id, -1)}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              hidden={!editing}
                              title="Move down"
                              aria-label={`Move ${p.title} down`}
                              disabled={i === layout.panels.length - 1}
                              onClick={() => move(p.id, 1)}
                            >
                              <ArrowDownIcon />
                            </button>
                            <button
                              aria-label={`Customize ${p.title}`}
                              className={editor === p.id ? "selected" : ""}
                              onClick={() => {
                                setEditing(true);
                                setEditor(editor === p.id ? null : p.id);
                              }}
                            >
                              <SlidersHorizontalIcon />
                            </button>
                          </div>
                        </header>
                        {editor === p.id && (
                          <div
                            className="panel-editor"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Customize chart"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditor(null);
                                setEditing(false);
                                requestAnimationFrame(() =>
                                  document
                                    .getElementById("customize-analysis")
                                    ?.focus(),
                                );
                              }
                              if (e.key === "Tab") {
                                const all = Array.from(
                                  e.currentTarget.querySelectorAll<HTMLElement>(
                                    "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary",
                                  ),
                                ).filter(
                                  (el) => el.getClientRects().length > 0,
                                );
                                const first = all[0],
                                  last = all[all.length - 1];
                                if (
                                  e.shiftKey &&
                                  document.activeElement === first
                                ) {
                                  e.preventDefault();
                                  last?.focus();
                                } else if (
                                  !e.shiftKey &&
                                  document.activeElement === last
                                ) {
                                  e.preventDefault();
                                  first?.focus();
                                }
                              }
                            }}
                          >
                            <div className="editor-heading">
                              <h2>Customize chart</h2>
                              <button
                                autoFocus
                                onClick={() => {
                                  setEditor(null);
                                  setEditing(false);
                                  requestAnimationFrame(() =>
                                    document
                                      .getElementById("customize-analysis")
                                      ?.focus(),
                                  );
                                }}
                              >
                                Close customization
                              </button>
                            </div>
                            <label>
                              Chart name
                              <input
                                value={displayText(p.title)}
                                onChange={(e) =>
                                  panelChange(p.id, { title: e.target.value })
                                }
                              />
                            </label>
                            <fieldset>
                              <legend>Sessions / participants</legend>
                              {sessions.map((s) => (
                                <label className="check" key={s.id}>
                                  <input
                                    type="checkbox"
                                    checked={p.sessionIds.includes(s.id)}
                                    disabled={
                                      !p.sessionIds.includes(s.id) &&
                                      p.sessionIds.length >= 4
                                    }
                                    onChange={(e) => {
                                      const ids = e.target.checked
                                        ? [...p.sessionIds, s.id]
                                        : p.sessionIds.filter(
                                            (x) => x !== s.id,
                                          );
                                      if (ids.length)
                                        panelChange(p.id, { sessionIds: ids });
                                    }}
                                  />
                                  {s.participantLabel} · {displayText(s.title)}{" "}
                                  {s.demo ? "(demo)" : ""}
                                </label>
                              ))}
                            </fieldset>
                            <fieldset>
                              <legend>Signals</legend>
                              {Object.entries(signals)
                                .filter(
                                  ([key]) =>
                                    p.signalKinds.includes(key as SignalKind) ||
                                    p.sessionIds.some((id) =>
                                      availability[id]?.includes(
                                        key as SignalKind,
                                      ),
                                    ),
                                )
                                .map(([key, s]) => (
                                  <label className="check" key={key}>
                                    <input
                                      type="checkbox"
                                      checked={p.signalKinds.includes(
                                        key as SignalKind,
                                      )}
                                      disabled={
                                        !p.signalKinds.includes(
                                          key as SignalKind,
                                        ) && p.signalKinds.length >= 2
                                      }
                                      onChange={(e) => {
                                        const kinds = e.target.checked
                                          ? [
                                              ...p.signalKinds,
                                              key as SignalKind,
                                            ]
                                          : p.signalKinds.filter(
                                              (k) => k !== key,
                                            );
                                        if (kinds.length)
                                          panelChange(p.id, {
                                            signalKinds: kinds,
                                            axis:
                                              new Set(
                                                kinds.map(
                                                  (k) => signals[k].unit,
                                                ),
                                              ).size > 1
                                                ? "separate"
                                                : "shared",
                                          });
                                      }}
                                    />
                                    {s.name} · {s.unit}
                                  </label>
                                ))}
                            </fieldset>
                            <label>
                              Axes
                              <select
                                value={p.axis}
                                onChange={(e) =>
                                  panelChange(p.id, {
                                    axis: e.target.value as Panel["axis"],
                                  })
                                }
                              >
                                <option
                                  value="shared"
                                  disabled={
                                    new Set(
                                      p.signalKinds.map((k) => signals[k].unit),
                                    ).size > 1
                                  }
                                >
                                  Shared unit
                                </option>
                                <option value="separate">Separate axes</option>
                                <option value="normalized">
                                  Normalized (z)
                                </option>
                              </select>
                            </label>
                            <details className="advanced-chart-options">
                              <summary>Style and layout</summary>
                              <div>
                                <label>
                                  Color · first series
                                  <input
                                    type="color"
                                    value={p.color}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        color: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Line width
                                  <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    step=".1"
                                    value={p.lineWidth}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        lineWidth: Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Opacity
                                  <input
                                    type="range"
                                    min=".15"
                                    max="1"
                                    step=".05"
                                    value={p.opacity}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        opacity: Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label>
                                  Width
                                  <select
                                    value={p.width}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        width: Number(e.target.value) as 1 | 2,
                                      })
                                    }
                                  >
                                    <option value="1">Half</option>
                                    <option value="2">Full</option>
                                  </select>
                                </label>
                                <label>
                                  Height
                                  <input
                                    type="range"
                                    min="220"
                                    max="650"
                                    value={p.height}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        height: Number(e.target.value),
                                      })
                                    }
                                  />
                                </label>
                                <label className="check">
                                  <input
                                    type="checkbox"
                                    checked={p.visible}
                                    onChange={(e) =>
                                      panelChange(p.id, {
                                        visible: e.target.checked,
                                      })
                                    }
                                  />
                                  Show chart
                                </label>
                                <button
                                  className="danger"
                                  disabled={layout.panels.length <= 1}
                                  onClick={() =>
                                    change({
                                      ...layout,
                                      panels: layout.panels.filter(
                                        (x) => x.id !== p.id,
                                      ),
                                    })
                                  }
                                >
                                  <XIcon />
                                  Remove chart
                                </button>
                              </div>
                            </details>
                          </div>
                        )}
                        <Chart
                          panel={p}
                          sessions={sessions}
                          layout={layout}
                          range={range}
                          cursor={cursor}
                          onCursor={setCursor}
                          onRange={setRange}
                          selection={selection}
                          onSelect={setSelection}
                          dragMode={dragMode}
                        />
                      </section>
                    ))}
                  </div>
                  <details className="analysis-help">
                    <summary>Data and export</summary>
                    <div className="analysis-foot">
                      <p>
                        Statistics use valid raw samples in the displayed
                        interval. Shaded areas indicate missing or uncertain
                        data.
                      </p>
                      <button
                        onClick={() =>
                          download(
                            `${layout.id}.json`,
                            JSON.stringify(
                              {
                                layout,
                                visibleInterval: range,
                                timePolicy: layout.alignment,
                              },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <DownloadSimpleIcon />
                        Export view JSON
                      </button>
                    </div>
                  </details>
                </>
              )}
              {view === "Sessions" && (
                <>
                  {detail ? (
                    <SessionDetail
                      session={detail}
                      onBack={() => setDetail(null)}
                      onAnalyze={() => compare([detail])}
                      onExport={() => void exportRaw(detail)}
                      busy={busy}
                    />
                  ) : (
                    <>
                      <div className="list-toolbar">
                        <input
                          aria-label="Search sessions"
                          placeholder="Search participant, session or type…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <select
                          aria-label="Participant filter"
                          value={participantFilter}
                          onChange={(e) => setParticipantFilter(e.target.value)}
                        >
                          <option value="all">All participants</option>
                          {participants.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                        <details className="filter-menu">
                          <summary>Filters</summary>
                          <label>
                            Data source
                            <select
                              aria-label="Data source"
                              value={kind}
                              onChange={(e) => setKind(e.target.value)}
                            >
                              <option value="all">All sources</option>
                              <option value="demo">Demo data</option>
                              <option value="real">Sensor recordings</option>
                            </select>
                          </label>
                        </details>
                        <span>{filtered.length} sessions</span>
                      </div>
                      {(query ||
                        kind !== "all" ||
                        participantFilter !== "all") && (
                        <div className="active-filters">
                          <span>
                            {query && `Search: ${query} · `}
                            {participantFilter !== "all" &&
                              `Participant: ${participantFilter} · `}
                            {kind !== "all" && `Source: ${kind}`}
                          </span>
                          <button
                            onClick={() => {
                              setQuery("");
                              setKind("all");
                              setParticipantFilter("all");
                            }}
                          >
                            Clear filters
                          </button>
                        </div>
                      )}
                      <SessionTable
                        sessions={filtered}
                        onOpen={(s) => compare([s])}
                        onAnalyze={(s) => compare([s])}
                        onParticipant={(id) => setParticipantFilter(id)}
                      />
                    </>
                  )}
                </>
              )}
              {view === "Participants" && (
                <div className="participant-list">
                  {participants.map((id) => {
                    const ss = sessions.filter((s) => s.participantId === id);
                    return (
                      <article key={id}>
                        <span className="participant-icon">
                          <UsersIcon size={24} />
                        </span>
                        <div>
                          <h2>{ss[0].participantLabel}</h2>
                          <small>
                            {ss.length} sessions ·{" "}
                            {Math.round(
                              ss.reduce((a, s) => a + s.durationMs, 0) / 60000,
                            )}{" "}
                            min · pseudonym
                          </small>
                        </div>
                        <button onClick={() => compare(ss.slice(0, 4))}>
                          Compare sessions <ArrowRightIcon />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              {view === "Overview" && (
                <>
                  <div className="overview-summary" aria-label="Summary">
                    <span>
                      <strong>{sessions.length}</strong> sessions
                    </span>
                    <span>
                      <strong>{participants.length}</strong> participants
                    </span>
                    <span>
                      <strong>
                        {Math.round(
                          sessions.reduce((a, s) => a + s.durationMs, 0) /
                            60000,
                        )}
                      </strong>{" "}
                      min recorded
                    </span>
                  </div>
                  <section className="overview-sessions">
                    <div className="section-title">
                      <h2>Recent sessions</h2>
                      <button
                        className="quiet-button"
                        onClick={() => setView("Sessions")}
                      >
                        View all <ArrowRightIcon />
                      </button>
                    </div>
                    <div className="recent-list">
                      {[...sessions]
                        .sort((a, b) => b.startedAt - a.startedAt)
                        .slice(0, 4)
                        .map((s) => (
                          <article key={s.id}>
                            <button
                              className="recent-session-button"
                              onClick={() => compare([s])}
                            >
                              <span className="recent-participant">
                                {s.participantLabel}
                              </span>
                              <span className="recent-info">
                                <strong>{displayText(s.title)}</strong>
                                <small>
                                  {new Date(s.startedAt).toLocaleDateString(
                                    "en-GB",
                                    { day: "numeric", month: "short" },
                                  )}{" "}
                                  · {Math.round(s.durationMs / 60000)} min
                                  {s.demo ? " · Demo" : ""}
                                </small>
                              </span>
                              {s.state !== "ended" && <span>Recording</span>}
                              <ArrowRightIcon />
                            </button>
                          </article>
                        ))}
                    </div>
                  </section>
                  <section className="overview-next">
                    <div>
                      <h2>Explore patterns over time</h2>
                      <p>Open analysis to compare your recordings.</p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setView("Analysis")}
                    >
                      Open analysis <ArrowRightIcon />
                    </button>
                  </section>
                </>
              )}
              {view === "Saved views" && (
                <div className="saved-list">
                  {saved.length ? (
                    saved.map((l) => (
                      <article key={l.id}>
                        <BookmarkSimpleIcon size={26} />
                        <div>
                          <h2>{displayText(l.title)}</h2>
                          <p>
                            {l.panels.length} charts · schema v{l.version} ·{" "}
                            {l.alignment}
                          </p>
                        </div>
                        <button onClick={() => open(l)}>
                          Open <ArrowRightIcon />
                        </button>
                        <button
                          onClick={() => {
                            const copy = {
                              ...l,
                              id: crypto.randomUUID(),
                              title: l.title + " · copy",
                            };
                            open(copy);
                            setDirty(true);
                          }}
                        >
                          Duplicate
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty">
                      Save your first view from Analysis.
                    </div>
                  )}
                </div>
              )}
              {view === "Settings" && (
                <div className="config-grid">
                  <section className="panel config-panel">
                    <h2>Session types & questionnaires</h2>
                    <button
                      className="quiet-button"
                      onClick={() => setView("Saved views")}
                    >
                      Manage saved views
                    </button>
                    <p>
                      Previous versions are immutable. Create a new version to
                      preserve the meaning of recorded answers.
                    </p>
                    {templates.map((t) => (
                      <button
                        className="template-row"
                        key={`${t.id}-${t.version}`}
                        onClick={() =>
                          setForm(
                            JSON.stringify(
                              { ...t, version: t.version + 1 },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        <span>{displayText(t.title)}</span>
                        <span>
                          v{t.version} · Create next version <ArrowRightIcon />
                        </span>
                      </button>
                    ))}
                  </section>
                  <section className="panel config-panel">
                    <h2>Edit questionnaire</h2>
                    <QuestionnaireEditor value={form} onChange={setForm} />
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          const t = await api<Template>(
                            "templates",
                            JSON.parse(form),
                          );
                          setTemplates((prev) => [
                            t,
                            ...prev.filter(
                              (x) => x.id !== t.id || x.version !== t.version,
                            ),
                          ]);
                          setNotice(
                            `Definition ${displayText(t.title)} v${t.version} saved.`,
                          );
                        })
                      }
                    >
                      Save questionnaire version
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>apexVIP · Analysis workspace</span>
          <span>Your data, your workspace</span>
        </footer>
      </div>
    </div>
  );
}
function SessionTable({
  sessions,
  onOpen,
  onAnalyze,
  onParticipant,
}: {
  sessions: Session[];
  onOpen: (s: Session) => void;
  onAnalyze: (s: Session) => void;
  onParticipant?: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Session / participant</th>
            <th>Start</th>
            <th>Duration</th>
            <th>Source</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <button className="text-button" onClick={() => onOpen(s)}>
                  {displayText(s.title)}
                </button>
                <button
                  className="participant-link"
                  onClick={() => onParticipant?.(s.participantId)}
                >
                  {s.participantLabel}
                </button>
              </td>
              <td>
                {new Date(s.startedAt).toLocaleString("en-GB", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              <td>{timeLabel(s.durationMs)}</td>
              <td>
                <span className="badge">
                  {s.demo ? "Synthetic / demo" : "Sensor"}
                </span>
              </td>
              <td>
                <span className="state">
                  {s.state === "ended" ? "Ended" : "Recording"}
                </span>
              </td>
              <td>
                <ArrowRightIcon aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sessions.length && (
        <div className="empty">
          No sessions match these filters. Clear the filters or try another
          search.
        </div>
      )}
    </div>
  );
}
function SessionDetail({
  session: s,
  onBack,
  onAnalyze,
  onExport,
  busy,
}: {
  session: Session;
  onBack: () => void;
  onAnalyze: () => void;
  onExport: () => void;
  busy: boolean;
}) {
  const [quality, setQuality] = useState<
    { signal: string; count: number; gaps: number }[]
  >([]);
  const [qualityError, setQualityError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all(
      Object.keys(signals).map(async (signal) => {
        const series = await api<import("@/core/contract").Series>(
          `sessions/${s.id}/series?signal=${signal}`,
        );
        return { signal, count: series.rawCount, gaps: series.gaps.length };
      }),
    )
      .then((q) => {
        if (active) setQuality(q);
      })
      .catch((e) => {
        if (active) setQualityError(e.message);
      });
    return () => {
      active = false;
    };
  }, [s.id]);
  return (
    <>
      <button onClick={onBack}>
        <ArrowLeftIcon />
        Back to sessions
      </button>
      <div className="detail-heading">
        <h2>{displayText(s.title)}</h2>
        <span className="badge">
          {s.demo ? "SYNTHETIC DEMO DATA" : "SENSOR RECORDING"}
        </span>
        <button className="primary" onClick={onAnalyze}>
          Open analysis
        </button>
        <button disabled={busy} onClick={onExport}>
          <DownloadSimpleIcon />
          Export raw CSV
        </button>
      </div>
      <p className="detail-summary">
        {s.participantLabel} · {new Date(s.startedAt).toLocaleString("en-GB")} ·{" "}
        {timeLabel(s.durationMs)} ·{" "}
        {s.state === "ended" ? "Ended" : "Recording"}
      </p>
      <details className="technical-details">
        <summary>Technical details & data quality</summary>
        <dl className="metadata">
          <div>
            <dt>Source</dt>
            <dd>{s.source}</dd>
          </div>
          <div>
            <dt>Time policy</dt>
            <dd>{s.timePolicy}</dd>
          </div>
          <div>
            <dt>Session type</dt>
            <dd>
              {s.typeId} v{s.typeVersion}
            </dd>
          </div>
        </dl>
        {qualityError && <p role="alert">{qualityError}</p>}
        <div className="quality-grid">
          {quality
            .filter((q) => q.count > 0)
            .map((q) => (
              <div key={q.signal}>
                <h3>{signals[q.signal as SignalKind].name}</h3>
                <strong>{q.count.toLocaleString("en-GB")}</strong>
                <p>raw samples · {q.gaps} recorded gaps</p>
                <small>Signal ID: {q.signal}</small>
              </div>
            ))}
        </div>
      </details>
      <h2 className="section-heading">Events & self-reports</h2>
      <div className="event-list">
        {s.events.map((e) => (
          <div key={e.id}>
            <span>{timeLabel(e.t)}</span>
            <strong>
              {displayText(e.label)} {e.value !== undefined && `· ${e.value}`}
            </strong>
            <details>
              <summary>Technical details</summary>
              <small>
                {e.type}
                {e.formId && ` · ${e.formId} v${e.formVersion}`}
              </small>
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
