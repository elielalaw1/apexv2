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
import Chart, { api, offset, Range, timeLabel } from "./Chart";
type View =
  | "Översikt"
  | "Sessioner"
  | "Deltagare"
  | "Analysyta"
  | "Upplägg"
  | "Konfiguration";
const nav = [
  ["Översikt", SquaresFourIcon],
  ["Sessioner", ListBulletsIcon],
  ["Deltagare", UsersIcon],
  ["Analysyta", ChartLineIcon],
  ["Upplägg", BookmarkSimpleIcon],
  ["Konfiguration", SlidersHorizontalIcon],
] as const;
function initialLayout(s: Session[]): Layout {
  return {
    version: 1,
    id: "layout-default",
    title: "Belastning & återhämtning",
    alignment: "elapsed",
    anchorLabel: "Arbete",
    panels: [
      {
        id: "cardio",
        title: "Hjärtfrekvens & RR",
        sessionIds: [s[0].id],
        signalKinds: ["hr", "rr"],
        axis: "separate",
        color: signals.hr.color,
        lineWidth: 1.8,
        opacity: 1,
        visible: true,
        width: 2,
        height: 340,
      },
      {
        id: "comparison",
        title: "Jämför hjärtfrekvens",
        sessionIds: s.slice(0, 2).map((s) => s.id),
        signalKinds: ["hr"],
        axis: "shared",
        color: signals.hr.color,
        lineWidth: 1.8,
        opacity: 0.9,
        visible: true,
        width: 1,
        height: 320,
      },
      {
        id: "motion",
        title: "Telefonrörelse",
        sessionIds: [s[0].id],
        signalKinds: ["phoneacc"],
        axis: "shared",
        color: signals.phoneacc.color,
        lineWidth: 1.5,
        opacity: 0.8,
        visible: true,
        width: 1,
        height: 320,
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
  const [view, setView] = useState<View>("Översikt"),
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
    [email, setEmail] = useState("demo@apexvip.local"),
    [password, setPassword] = useState("apex-demo-2026"),
    [form, setForm] = useState(JSON.stringify(defaultTemplate, null, 2));
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
      let active: string | null = null;
      try {
        active = localStorage.getItem(`apex-layout:${workspace}`);
      } catch {}
      const l = ll.find((l) => l.id === active) ?? ll[0] ?? initialLayout(ss);
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
        if (e.message !== "Logga in för att fortsätta") setError(e.message);
      })
      .finally(() => setBoot(false));
  }, []);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Åtgärden misslyckades");
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
    remember(l.id);
    setLayout(structuredClone(l));
    setDirty(false);
    setView("Analysyta");
    reset(l);
    setEditor(null);
  }
  function compare(ss: Session[]) {
    const l = initialLayout(ss);
    l.id = crypto.randomUUID();
    l.title = `Jämförelse · ${ss.map((s) => s.participantLabel).join(" / ")}`;
    l.panels = [{ ...l.panels[1], width: 2, sessionIds: ss.map((s) => s.id) }];
    open(l);
    setDirty(true);
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
      setNotice("Rådata exporterad utan normalisering eller förenkling.");
    });
  }
  if (boot)
    return (
      <main className="login">
        <ActivityIcon size={34} />
        <p>Öppnar arbetsyta…</p>
      </main>
    );
  if (!user)
    return (
      <main className="login">
        <div className="login-box">
          <div className="brand">
            apex<span>VIP</span>
          </div>
          <p className="eyebrow">MÄTNING · ANALYS · FORSKNING</p>
          <h1>
            En arbetsyta för
            <br />
            hela mätningen.
          </h1>
          <p>
            Samla signaler, förstå sessioner och bygg dina egna analysupplägg.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void signIn();
            }}
          >
            <label>
              E-post
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
            <label>
              Lösenord
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary" disabled={busy}>
              Logga in
            </button>
            <button
              type="button"
              onClick={() => void signIn(true)}
              disabled={busy}
            >
              Öppna demoprojekt <ArrowRightIcon />
            </button>
          </form>
          <small>
            Demokontot är förifyllt. Demoprojektet innehåller endast syntetiska
            mätningar och använder samma API som riktiga sessioner.
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
            Från mätpunkt
            <br />
            till perspektiv.
          </p>
          <small>Polar H10 · HR · RR · ECG · rörelse</small>
        </div>
      </main>
    );
  const filtered = sessions.filter(
    (s) =>
      (kind === "all" || (kind === "demo" ? s.demo : !s.demo)) &&
      `${s.title} ${s.participantLabel} ${s.typeId}`
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
          {nav.slice(0, 4).map(([v, Icon]) => (
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
              {v === "Sessioner" && <small>{sessions.length}</small>}
            </button>
          ))}
        </nav>
        <details className="secondary-nav">
          <summary>Fler verktyg</summary>
          <nav>
            {nav.slice(4).map(([v, Icon]) => (
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
              </button>
            ))}
          </nav>
        </details>
        <div className="sidebar-bottom">
          <div className="status-dot" />
          Din arbetsyta
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
            Logga ut
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            Arbetsyta <span className="slash">/</span> <b>{view}</b>
          </span>
          <div>
            <span className="badge">
              {sessions.some((s) => s.demo)
                ? "Demodata tillgängliga"
                : "Inga demodata"}
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
              <button aria-label="Stäng fel" onClick={() => setError("")}>
                <XIcon />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert">
              {notice}
              <button
                aria-label="Stäng meddelande"
                onClick={() => setNotice("")}
              >
                <XIcon />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {detail
                  ? "Sessionsdetalj"
                  : view === "Översikt"
                    ? "Din översikt"
                    : view}
              </h1>
              <p>
                {view === "Analysyta"
                  ? "Utforska signaler och jämför sessioner på en gemensam tidslinje."
                  : view === "Sessioner"
                    ? "Mätningar, händelser och datakvalitet i samma flöde."
                    : view === "Deltagare"
                      ? "Pseudonyma identifierare håller fokus på mätningen."
                      : view === "Konfiguration"
                        ? "Versionerade sessionstyper, händelser och självskattningar."
                        : view === "Översikt"
                          ? "Senaste mätningarna, samlade på ett ställe."
                          : "Din arbetsyta för fysiologiska mätningar."}
              </p>
            </div>
            {view === "Analysyta" && layout && (
              <div className="actions">
                <button
                  aria-expanded={editing}
                  onClick={() => {
                    setEditing(!editing);
                    setEditor(null);
                  }}
                >
                  <SlidersHorizontalIcon />
                  {editing ? "Klar" : "Anpassa analys"}
                </button>
                <button
                  hidden={!editing}
                  onClick={() => {
                    const l = {
                      ...layout,
                      id: crypto.randomUUID(),
                      title: `${layout.title} · kopia`,
                    };
                    change(l);
                    setNotice("Kopia skapad. Namnge och spara den.");
                  }}
                >
                  Duplicera
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
                      setNotice("Upplägget är sparat i din arbetsyta.");
                    })
                  }
                >
                  <FloppyDiskIcon />
                  Spara upplägg
                </button>
              </div>
            )}
          </div>
          {!sessions.length && view !== "Konfiguration" ? (
            <div className="empty large">
              <ActivityIcon size={40} />
              <h2>Redo för första sessionen</h2>
              <p>
                Synkronisera en mätning från mobilappen eller skapa syntetiska
                sessioner genom API:t.
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
                Läs in demodata
              </button>
            </div>
          ) : (
            <>
              {view === "Analysyta" && layout && (
                <>
                  <div className="analysis-toolbar" hidden={!editing}>
                    <div>
                      <label className="sr-only" htmlFor="layout-name">
                        Uppläggets namn
                      </label>
                      <input
                        id="layout-name"
                        className="layout-name"
                        value={layout.title}
                        onChange={(e) =>
                          change({ ...layout, title: e.target.value })
                        }
                      />
                      <span className="subtle">
                        {dirty ? "Osparat" : "Upplägg v1"}
                      </span>
                    </div>
                    <div>
                      <select
                        aria-label="Öppna sparat upplägg"
                        value=""
                        onChange={(e) => {
                          const l = saved.find((l) => l.id === e.target.value);
                          if (l) open(l);
                        }}
                      >
                        <option value="">Öppna upplägg…</option>
                        {saved.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
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
                                title: "Ny panel",
                                sessionIds: [sessions[0].id],
                                signalKinds: ["hr"],
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
                        Lägg till panel
                      </button>
                    </div>
                  </div>
                  <div className="timeline-controls">
                    <label hidden={!editing}>
                      Tidsjustering{" "}
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
                        <option value="elapsed">Sedan sessionsstart</option>
                        <option value="absolute">Absolut tid</option>
                        <option value="event">Relativt händelse</option>
                      </select>
                    </label>
                    {editing && layout.alignment === "event" && (
                      <label>
                        Händelse
                        <input
                          value={layout.anchorLabel}
                          onChange={(e) => {
                            const l = {
                              ...layout,
                              anchorLabel: e.target.value,
                            };
                            change(l);
                            reset(l);
                          }}
                        />
                      </label>
                    )}
                    <div className="zoom-buttons">
                      <button
                        aria-label="Panorera bakåt"
                        onClick={() => {
                          const d = (range[1] - range[0]) * 0.25;
                          setRange([range[0] - d, range[1] - d]);
                        }}
                      >
                        <ArrowLeftIcon />
                      </button>
                      <button
                        aria-label="Zooma in"
                        onClick={() => {
                          const mid = (range[0] + range[1]) / 2,
                            d = (range[1] - range[0]) * 0.3;
                          setRange([mid - d, mid + d]);
                        }}
                      >
                        +
                      </button>
                      <button
                        aria-label="Zooma ut"
                        onClick={() => {
                          const mid = (range[0] + range[1]) / 2,
                            d = (range[1] - range[0]) * 0.8;
                          setRange([mid - d, mid + d]);
                        }}
                      >
                        −
                      </button>
                      <button
                        aria-label="Panorera framåt"
                        onClick={() => {
                          const d = (range[1] - range[0]) * 0.25;
                          setRange([range[0] + d, range[1] + d]);
                        }}
                      >
                        <ArrowRightIcon />
                      </button>
                      <button onClick={() => reset()}>
                        <ArrowsOutSimpleIcon />
                        Hela passet
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
                      Gemensam tidslinje
                    </span>
                    <span>
                      Markör{" "}
                      {cursor === null
                        ? "—"
                        : timeLabel(
                            cursor,
                            layout.alignment === "absolute",
                          )}{" "}
                      · Dra i diagrammet för att välja intervall
                    </span>
                  </div>
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
                            <h2>{p.title}</h2>
                          </div>
                          <div>
                            <button
                              hidden={!editing}
                              title="Flytta upp"
                              aria-label={`Flytta ${p.title} upp`}
                              disabled={i === 0}
                              onClick={() => move(p.id, -1)}
                            >
                              <ArrowUpIcon />
                            </button>
                            <button
                              hidden={!editing}
                              title="Flytta ner"
                              aria-label={`Flytta ${p.title} ner`}
                              disabled={i === layout.panels.length - 1}
                              onClick={() => move(p.id, 1)}
                            >
                              <ArrowDownIcon />
                            </button>
                            <button
                              aria-label={`Inställningar ${p.title}`}
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
                          <div className="panel-editor">
                            <label>
                              Panelnamn
                              <input
                                value={p.title}
                                onChange={(e) =>
                                  panelChange(p.id, { title: e.target.value })
                                }
                              />
                            </label>
                            <fieldset>
                              <legend>Sessioner / deltagare</legend>
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
                                  {s.participantLabel} · {s.title}{" "}
                                  {s.demo ? "(demo)" : ""}
                                </label>
                              ))}
                            </fieldset>
                            <fieldset>
                              <legend>Signaler</legend>
                              {Object.entries(signals).map(([key, s]) => (
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
                                        ? [...p.signalKinds, key as SignalKind]
                                        : p.signalKinds.filter(
                                            (k) => k !== key,
                                          );
                                      if (kinds.length)
                                        panelChange(p.id, {
                                          signalKinds: kinds,
                                          axis:
                                            new Set(
                                              kinds.map((k) => signals[k].unit),
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
                              Axlar
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
                                  Gemensam enhet
                                </option>
                                <option value="separate">Separata axlar</option>
                                <option value="normalized">
                                  Normaliserad (z)
                                </option>
                              </select>
                            </label>
                            <label>
                              Färg · första serie
                              <input
                                type="color"
                                value={p.color}
                                onChange={(e) =>
                                  panelChange(p.id, { color: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Linjebredd
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
                              Transparens
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
                              Bredd
                              <select
                                value={p.width}
                                onChange={(e) =>
                                  panelChange(p.id, {
                                    width: Number(e.target.value) as 1 | 2,
                                  })
                                }
                              >
                                <option value="1">Halv</option>
                                <option value="2">Hel</option>
                              </select>
                            </label>
                            <label>
                              Höjd
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
                              Visa panel
                            </label>
                            <button
                              className="danger"
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
                              Ta bort panel
                            </button>
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
                        />
                      </section>
                    ))}
                  </div>
                  <details className="analysis-help">
                    <summary>Om datan och export</summary>
                    <div className="analysis-foot">
                      <p>
                        Statistik för synligt intervall beräknas från giltiga
                        råsamples. Skrafferade områden visar dataluckor.
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
                        Exportera analyskonfiguration
                      </button>
                    </div>
                  </details>
                </>
              )}
              {view === "Sessioner" && (
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
                          aria-label="Sök sessioner"
                          placeholder="Sök deltagare, session eller typ…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <select
                          aria-label="Datakälla"
                          value={kind}
                          onChange={(e) => setKind(e.target.value)}
                        >
                          <option value="all">Alla källor</option>
                          <option value="demo">Demodata</option>
                          <option value="real">Riktiga mätningar</option>
                        </select>
                        <span>{filtered.length} sessioner</span>
                      </div>
                      <SessionTable
                        sessions={filtered}
                        onOpen={setDetail}
                        onAnalyze={(s) => compare([s])}
                      />
                    </>
                  )}
                </>
              )}
              {view === "Deltagare" && (
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
                            {ss.length} sessioner ·{" "}
                            {Math.round(
                              ss.reduce((a, s) => a + s.durationMs, 0) / 60000,
                            )}{" "}
                            min · pseudonym
                          </small>
                        </div>
                        <button onClick={() => compare(ss.slice(0, 4))}>
                          Jämför sessioner <ArrowRightIcon />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
              {view === "Översikt" && (
                <>
                  <div className="overview-summary" aria-label="Sammanfattning">
                    <span>
                      <strong>{sessions.length}</strong> sessioner
                    </span>
                    <span>
                      <strong>{participants.length}</strong> deltagare
                    </span>
                    <span>
                      <strong>
                        {Math.round(
                          sessions.reduce((a, s) => a + s.durationMs, 0) /
                            60000,
                        )}
                      </strong>{" "}
                      min mättid
                    </span>
                  </div>
                  <section className="overview-sessions">
                    <div className="section-title">
                      <h2>Senaste sessioner</h2>
                      <button
                        className="quiet-button"
                        onClick={() => setView("Sessioner")}
                      >
                        Visa alla <ArrowRightIcon />
                      </button>
                    </div>
                    <div className="recent-list">
                      {[...sessions]
                        .sort((a, b) => b.startedAt - a.startedAt)
                        .slice(0, 4)
                        .map((s) => (
                          <article key={s.id}>
                            <div className="recent-participant">
                              {s.participantLabel}
                            </div>
                            <div className="recent-info">
                              <button
                                className="text-button"
                                onClick={() => {
                                  setDetail(s);
                                  setView("Sessioner");
                                }}
                              >
                                {s.title}
                              </button>
                              <p>
                                {new Date(s.startedAt).toLocaleDateString(
                                  "sv-SE",
                                  { day: "numeric", month: "short" },
                                )}{" "}
                                · {Math.round(s.durationMs / 60000)} min
                                {s.demo ? " · Demo" : ""}
                              </p>
                            </div>
                            <span className="recent-state">
                              {s.state === "ended" ? "Avslutad" : "Pågår"}
                            </span>
                            <button
                              className="quiet-button"
                              aria-label={`Analysera ${s.title}`}
                              onClick={() => compare([s])}
                            >
                              Analysera <ArrowRightIcon />
                            </button>
                          </article>
                        ))}
                    </div>
                  </section>
                  <section className="overview-next">
                    <div>
                      <h2>Se mönstret över tid</h2>
                      <p>Öppna din analys för att jämföra mätningar.</p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => setView("Analysyta")}
                    >
                      Öppna analys <ArrowRightIcon />
                    </button>
                  </section>
                </>
              )}
              {view === "Upplägg" && (
                <div className="saved-list">
                  {saved.length ? (
                    saved.map((l) => (
                      <article key={l.id}>
                        <BookmarkSimpleIcon size={26} />
                        <div>
                          <h2>{l.title}</h2>
                          <p>
                            {l.panels.length} paneler · schema v{l.version} ·{" "}
                            {l.alignment}
                          </p>
                        </div>
                        <button onClick={() => open(l)}>
                          Öppna <ArrowRightIcon />
                        </button>
                        <button
                          onClick={() => {
                            const copy = {
                              ...l,
                              id: crypto.randomUUID(),
                              title: l.title + " · kopia",
                            };
                            open(copy);
                            setDirty(true);
                          }}
                        >
                          Duplicera
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="empty">
                      Spara ditt första upplägg från analysytan.
                    </div>
                  )}
                </div>
              )}
              {view === "Konfiguration" && (
                <div className="config-grid">
                  <section className="panel config-panel">
                    <h2>Sessionstyper & formulär</h2>
                    <p>
                      Äldre versioner är låsta. Ändra definitionen och öka
                      versionen för att bevara betydelsen hos tidigare svar.
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
                        <span>{t.title}</span>
                        <span>
                          v{t.version} · Skapa nästa version <ArrowRightIcon />
                        </span>
                      </button>
                    ))}
                  </section>
                  <section className="panel config-panel">
                    <h2>Definition · JSON</h2>
                    <label className="sr-only" htmlFor="template-json">
                      Formulärdefinition
                    </label>
                    <textarea
                      id="template-json"
                      value={form}
                      onChange={(e) => setForm(e.target.value)}
                      spellCheck={false}
                    />
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
                            `Definition ${t.title} v${t.version} sparad.`,
                          );
                        })
                      }
                    >
                      Spara formulärversion
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>apexVIP · Forskningsplattform</span>
          <span>Din data, din arbetsyta</span>
        </footer>
      </div>
    </div>
  );
}
function SessionTable({
  sessions,
  onOpen,
  onAnalyze,
}: {
  sessions: Session[];
  onOpen: (s: Session) => void;
  onAnalyze: (s: Session) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Session / deltagare</th>
            <th>Start</th>
            <th>Längd</th>
            <th>Källa</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <button className="text-button" onClick={() => onOpen(s)}>
                  {s.title}
                </button>
                <small>{s.participantLabel}</small>
              </td>
              <td>
                {new Date(s.startedAt).toLocaleString("sv-SE", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </td>
              <td>{timeLabel(s.durationMs)}</td>
              <td>
                <span className="badge">
                  {s.demo ? "Syntetisk / demo" : "Sensor"}
                </span>
              </td>
              <td>
                <span className="state">
                  {s.state === "ended" ? "Avslutad" : "Pågår"}
                </span>
              </td>
              <td>
                <button onClick={() => onAnalyze(s)}>
                  Analysera <ArrowRightIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sessions.length && (
        <div className="empty">Inga sessioner matchar filtret.</div>
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
        Sessionslista
      </button>
      <div className="detail-heading">
        <h2>{s.title}</h2>
        <span className="badge">
          {s.demo ? "DEMODATA · SYNTHETIC-V1" : "SENSORMÄTNING"}
        </span>
        <button className="primary" onClick={onAnalyze}>
          Öppna i analysytan
        </button>
        <button disabled={busy} onClick={onExport}>
          <DownloadSimpleIcon />
          Exportera rådata
        </button>
      </div>
      <dl className="metadata">
        <div>
          <dt>Deltagare</dt>
          <dd>{s.participantLabel}</dd>
        </div>
        <div>
          <dt>Källa</dt>
          <dd>{s.source}</dd>
        </div>
        <div>
          <dt>Tidspolicy</dt>
          <dd>{s.timePolicy}</dd>
        </div>
        <div>
          <dt>Sessionsupplägg</dt>
          <dd>
            {s.typeId} v{s.typeVersion}
          </dd>
        </div>
        <div>
          <dt>Längd</dt>
          <dd>{timeLabel(s.durationMs)}</dd>
        </div>
        <div>
          <dt>Tillstånd</dt>
          <dd>{s.state}</dd>
        </div>
      </dl>
      <h2 className="section-heading">Datakvalitet</h2>
      {qualityError && (
        <p role="alert" className="error">
          {qualityError}
        </p>
      )}
      <div className="quality-grid">
        {quality
          .filter((q) => q.count > 0)
          .map((q) => (
            <div key={q.signal}>
              <h3>{signals[q.signal as SignalKind].name}</h3>
              <strong>{q.count.toLocaleString("sv-SE")}</strong>
              <p>råsamples · {q.gaps} registrerade luckor</p>
            </div>
          ))}
      </div>
      <h2 className="section-heading">Händelser & självskattningar</h2>
      <div className="event-list">
        {s.events.map((e) => (
          <div key={e.id}>
            <span>{timeLabel(e.t)}</span>
            <strong>
              {e.label} {e.value !== undefined && `· ${e.value}`}
            </strong>
            <small>
              {e.type}
              {e.formId && ` · ${e.formId} v${e.formVersion}`}
            </small>
          </div>
        ))}
      </div>
    </>
  );
}
