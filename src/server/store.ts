import { trainingSeries, trainingMetrics, derivedKinds } from "@/core/training";
import { envelope, gaps, summarize } from "@/core/analysis";
import {
  BatchSchema,
  signals,
  LayoutSchema,
  Session,
  SignalKind,
  Sample,
  Series,
  TemplateSchema,
} from "@/core/contract";
import { getDb, sha } from "./db";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireSession(workspace: string, id: string): Session {
  const row = getDb()
    .prepare("SELECT metadata FROM sessions WHERE id=? AND workspace=?")
    .get(id, workspace) as { metadata: string } | undefined;
  if (!row) throw new ApiError(404, "Session not found in your workspace");
  return JSON.parse(row.metadata);
}
export function ingest(workspace: string, input: unknown) {
  const batch = BatchSchema.parse(input);
  const metadata = structuredClone(batch.session);
  const db = getDb();
  const hash = sha(JSON.stringify(batch));
  db.exec("BEGIN IMMEDIATE");
  try {
    const prev = db
      .prepare("SELECT hash,count FROM batches WHERE workspace=? AND id=?")
      .get(workspace, batch.batchId) as
      { hash: string; count: number } | undefined;
    if (prev) {
      if (prev.hash !== hash)
        throw new ApiError(409, "Batch ID reused with different contents");
      db.exec("COMMIT");
      return {
        version: 1,
        batchId: batch.batchId,
        accepted: prev.count,
        duplicate: true,
      };
    }
    const definition = db
      .prepare(
        "SELECT config FROM templates WHERE workspace=? AND id=? AND version=?",
      )
      .get(workspace, batch.session.typeId, batch.session.typeVersion);
    if (!definition)
      throw new ApiError(
        400,
        "Session type missing. Sync the questionnaire definition first.",
      );
    const template = TemplateSchema.parse(
      JSON.parse(definition.config as string),
    );
    for (const event of batch.session.events) {
      if (event.type !== "self-report") continue;
      const question = template.questions.find((q) =>
        event.questionId ? q.id === event.questionId : q.label === event.label,
      );
      if (
        event.formId !== template.id ||
        event.formVersion !== template.version ||
        !question ||
        event.value === undefined ||
        event.value < question.min ||
        event.value > question.max
      )
        throw new ApiError(
          400,
          "Self-report does not match its questionnaire version",
        );
    }
    const row = db
      .prepare("SELECT workspace,metadata FROM sessions WHERE id=?")
      .get(batch.session.id) as
      { workspace: string; metadata: string } | undefined;
    if (row && row.workspace !== workspace)
      throw new ApiError(404, "Session not found in your workspace");
    if (row) {
      const previous = JSON.parse(row.metadata) as Session;
      if (
        previous.participantId !== batch.session.participantId ||
        previous.startedAt !== batch.session.startedAt ||
        previous.demo !== batch.session.demo ||
        previous.source !== batch.session.source ||
        previous.typeId !== batch.session.typeId ||
        previous.typeVersion !== batch.session.typeVersion ||
        previous.timePolicy !== batch.session.timePolicy ||
        JSON.stringify(previous.training) !==
          JSON.stringify(batch.session.training)
      )
        throw new ApiError(409, "Session origin cannot be changed");
      if (previous.state === "ended" && batch.session.state === "recording")
        throw new ApiError(409, "An ended session cannot be reopened");
      const events = new Map(previous.events.map((e) => [e.id, e]));
      for (const e of metadata.events) {
        const old = events.get(e.id);
        if (old && JSON.stringify(old) !== JSON.stringify(e))
          throw new ApiError(409, "A stored event cannot be changed");
        events.set(e.id, e);
      }
      metadata.events = [...events.values()].sort((a, b) => a.t - b.t);
      if (metadata.events.length > 1000)
        throw new ApiError(409, "Too many session events");
      metadata.durationMs = Math.max(previous.durationMs, metadata.durationMs);
    }
    db.prepare(
      "INSERT INTO sessions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata",
    ).run(batch.session.id, workspace, JSON.stringify(metadata));
    const existing = db.prepare(
      "SELECT t,received,sensor,value,quality FROM samples WHERE session_id=? AND signal=? AND idx=?",
    );
    const insert = db.prepare("INSERT INTO samples VALUES(?,?,?,?,?,?,?,?)");
    for (const s of batch.samples) {
      const prev = existing.get(batch.session.id, s.signal, s.index) as
        | {
            t: number;
            received: number;
            sensor: string | null;
            value: number;
            quality: string;
          }
        | undefined;
      if (prev) {
        if (
          prev.t !== s.t ||
          prev.received !== s.receivedAt ||
          prev.value !== s.value ||
          prev.quality !== s.quality ||
          (prev.sensor ?? undefined) !== s.sensorTime
        )
          throw new ApiError(409, "An existing raw sample cannot be changed");
      } else
        insert.run(
          batch.session.id,
          s.signal,
          s.index,
          s.t,
          s.receivedAt,
          s.sensorTime ?? null,
          s.value,
          s.quality,
        );
    }
    db.prepare("INSERT INTO batches VALUES(?,?,?,?,?)").run(
      workspace,
      batch.batchId,
      batch.session.id,
      hash,
      batch.samples.length,
    );
    db.exec("COMMIT");
    return {
      version: 1,
      batchId: batch.batchId,
      accepted: batch.samples.length,
      duplicate: false,
    };
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function sessions(workspace: string) {
  return getDb()
    .prepare("SELECT metadata FROM sessions WHERE workspace=?")
    .all(workspace)
    .map((r) => JSON.parse(r.metadata as string) as Session)
    .sort((a, b) => b.startedAt - a.startedAt);
}
type SampleRow = {
  signal: SignalKind;
  idx: number;
  t: number;
  received: number;
  sensor: string | null;
  value: number;
  quality: Sample["quality"];
};
export function readSeries(
  workspace: string,
  id: string,
  signal: SignalKind,
  from: number,
  to: number,
  budget = 900,
): Series {
  const session = requireSession(workspace, id);
  if (derivedKinds.includes(signal)) {
    const all = trainingSeries(
      session,
      signal,
      rawSignal(id, "hr"),
      rawSignal(id, "rr"),
    );
    const points = all.filter((p) => p.t >= from && p.t <= to);
    const summary = summarize(points);
    const valid = points.filter((p) => p.quality === "measured");
    const mean = summary.mean ?? 0;
    const sd = valid.length
      ? Math.sqrt(
          valid.reduce((sum, p) => sum + (p.value - mean) ** 2, 0) /
            valid.length,
        )
      : null;
    const boundaries = all
      .flatMap((p, i) =>
        i > 0 &&
        (p.t - all[i - 1].t > signals[signal].gapMs ||
          p.quality !== "measured" ||
          all[i - 1].quality !== "measured")
          ? [
              {
                from: all[i - 1].t,
                to: p.t,
                reason:
                  p.quality !== "measured" || all[i - 1].quality !== "measured"
                    ? ("quality" as const)
                    : ("gap" as const),
              },
            ]
          : [],
      )
      .filter((g) => g.to >= from && g.from <= to);
    const rendered = envelope(points, budget);
    return {
      sessionId: id,
      signal,
      points: rendered,
      rawCount: points.length,
      renderCount: rendered.length,
      summary: { ...summary, sd },
      gaps: boundaries,
    };
  }
  const db = getDb();
  const params = [id, signal, from, to] as const;
  const stat = db
    .prepare(
      "SELECT COUNT(*) count,AVG(value) mean,MIN(value) min,MAX(value) max,AVG(value*value) square FROM samples WHERE session_id=? AND signal=? AND t>=? AND t<=? AND quality='measured'",
    )
    .get(...params) as Series["summary"] & { square: number | null };
  stat.sd =
    stat.mean === null
      ? null
      : Math.sqrt(Math.max(0, (stat.square ?? 0) - stat.mean * stat.mean));
  delete (stat as Partial<typeof stat>).square;
  // Gap boundaries from indexed raw points, independent of display sampling.
  const before =
    (
      db
        .prepare(
          "SELECT MAX(t) t FROM samples WHERE session_id=? AND signal=? AND t<?",
        )
        .get(id, signal, from) as { t: number | null }
    ).t ?? from;
  const after =
    (
      db
        .prepare(
          "SELECT MIN(t) t FROM samples WHERE session_id=? AND signal=? AND t>?",
        )
        .get(id, signal, to) as { t: number | null }
    ).t ?? to;
  const rawGaps = db
    .prepare(
      `WITH ordered AS (SELECT t,quality,LAG(t) OVER(ORDER BY t,idx) previous,LAG(quality) OVER(ORDER BY t,idx) prev_quality FROM samples WHERE session_id=? AND signal=? AND t>=? AND t<=?), boundaries AS (SELECT previous AS "from",t AS "to",CASE WHEN quality<>'measured' OR prev_quality<>'measured' THEN 1 ELSE 0 END bad FROM ordered WHERE previous IS NOT NULL AND (t-previous>? OR quality<>'measured' OR prev_quality<>'measured')), marked AS (SELECT *,CASE WHEN "from">LAG("to") OVER(ORDER BY "from","to") THEN 1 ELSE 0 END starts FROM boundaries), grouped AS (SELECT *,SUM(starts) OVER(ORDER BY "from","to" ROWS UNBOUNDED PRECEDING) grp FROM marked) SELECT MIN("from") AS "from",MAX("to") AS "to",CASE WHEN MAX(bad)=1 THEN 'quality' ELSE 'gap' END reason FROM grouped GROUP BY grp HAVING MAX("to")>=? AND MIN("from")<=?`,
    )
    .all(
      id,
      signal,
      before,
      after,
      signals[signal].gapMs,
      from,
      to,
    ) as Series["gaps"];
  // SQL min/max envelope bounds memory, preserves first/last and extrema of each time bucket.
  const step = Math.max(1, (to - from) / Math.max(1, Math.floor(budget / 4)));
  const rows = db
    .prepare(
      `WITH windowed AS (SELECT *,CAST((t-?)/? AS INTEGER) bucket FROM samples WHERE session_id=? AND signal=? AND t>=? AND t<=?), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY bucket ORDER BY value,idx) lo,ROW_NUMBER() OVER(PARTITION BY bucket ORDER BY value DESC,idx) hi,ROW_NUMBER() OVER(PARTITION BY bucket ORDER BY t,idx) first,ROW_NUMBER() OVER(PARTITION BY bucket ORDER BY t DESC,idx DESC) last FROM windowed) SELECT signal,idx,t,received,sensor,value,quality FROM ranked WHERE lo=1 OR hi=1 OR first=1 OR last=1 ORDER BY t,idx`,
    )
    .all(from, step, ...params) as SampleRow[];
  const points = rows.map((r) => ({
    signal: r.signal,
    index: r.idx,
    t: r.t,
    receivedAt: r.received,
    sensorTime: r.sensor ?? undefined,
    value: r.value,
    quality: r.quality,
  }));
  const count = (
    db
      .prepare(
        "SELECT COUNT(*) count FROM samples WHERE session_id=? AND signal=? AND t>=? AND t<=?",
      )
      .get(...params) as { count: number }
  ).count;
  return {
    sessionId: id,
    signal,
    points,
    rawCount: count,
    renderCount: points.length,
    summary: stat,
    gaps: rawGaps,
  };
}
export function rawPage(
  workspace: string,
  id: string,
  after = -1,
  limit = 1000,
) {
  requireSession(workspace, id);
  return getDb()
    .prepare(
      'SELECT rowid cursor,signal,idx AS "index",t,received AS receivedAt,sensor AS sensorTime,value,quality FROM samples WHERE session_id=? AND rowid>? ORDER BY rowid LIMIT ?',
    )
    .all(id, after, Math.min(limit, 2000));
}
export function saveLayout(workspace: string, input: unknown) {
  const layout = LayoutSchema.parse(input);
  for (const p of layout.panels)
    for (const id of p.sessionIds) requireSession(workspace, id);
  getDb()
    .prepare(
      "INSERT INTO layouts VALUES(?,?,?) ON CONFLICT(workspace,id) DO UPDATE SET config=excluded.config",
    )
    .run(workspace, layout.id, JSON.stringify(layout));
  return layout;
}
export function layouts(workspace: string) {
  return getDb()
    .prepare("SELECT config FROM layouts WHERE workspace=?")
    .all(workspace)
    .map((r) => JSON.parse(r.config as string));
}
export function saveTemplate(workspace: string, input: unknown) {
  const t = TemplateSchema.parse(input);
  const prev = getDb()
    .prepare(
      "SELECT config FROM templates WHERE workspace=? AND id=? AND version=?",
    )
    .get(workspace, t.id, t.version);
  if (prev && prev.config !== JSON.stringify(t))
    throw new ApiError(409, "Create a new questionnaire version for changes");
  getDb()
    .prepare("INSERT OR IGNORE INTO templates VALUES(?,?,?,?)")
    .run(workspace, t.id, t.version, JSON.stringify(t));
  return t;
}

function rawSignal(id: string, signal: SignalKind): Sample[] {
  return getDb()
    .prepare(
      'SELECT signal,idx AS "index",t,received AS receivedAt,sensor AS sensorTime,value,quality FROM samples WHERE session_id=? AND signal=? ORDER BY t,idx',
    )
    .all(id, signal) as Sample[];
}
export function signalInventory(workspace: string, id: string) {
  const session = requireSession(workspace, id);
  const rows = getDb()
    .prepare(
      "SELECT signal, count(*) AS count FROM samples WHERE session_id=? GROUP BY signal",
    )
    .all(id) as { signal: SignalKind; count: number }[];
  const hr = rawSignal(id, "hr"),
    rr = rawSignal(id, "rr");
  for (const kind of derivedKinds) {
    const points = trainingSeries(session, kind, hr, rr);
    if (points.some((p) => p.quality === "measured"))
      rows.push({ signal: kind, count: points.length });
  }
  return rows;
}
export function metrics(workspace: string, id: string) {
  return trainingMetrics(requireSession(workspace, id), rawSignal(id, "hr"));
}
