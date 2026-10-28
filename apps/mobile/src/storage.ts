import * as SQLite from "expo-sqlite";
import { randomUUID } from "expo-crypto";
import {
  Batch,
  BatchSchema,
  Sample,
  Session,
  SessionSchema,
  Template,
  TemplateSchema,
} from "../../../src/core/contract";
let database: Promise<SQLite.SQLiteDatabase> | undefined;
export function db() {
  return (database ??= (async () => {
    const d = await SQLite.openDatabaseAsync("apexvip.sqlite");
    await d.execAsync(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS local_sessions(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,metadata TEXT NOT NULL,sealed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS local_samples(session_id TEXT NOT NULL REFERENCES local_sessions(id),signal TEXT NOT NULL,idx INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(session_id,signal,idx));
CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES local_sessions(id),payload TEXT NOT NULL,acked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS local_sample_session ON local_samples(session_id);`);
    await d.execAsync(
      "CREATE TABLE IF NOT EXISTS local_templates(workspace TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,config TEXT NOT NULL,PRIMARY KEY(workspace,id,version));",
    );
    return d;
  })());
}
export async function saveLocalTemplate(workspace: string, input: Template) {
  const t = TemplateSchema.parse(input),
    d = await db();
  const prev = await d.getFirstAsync<{ config: string }>(
    "SELECT config FROM local_templates WHERE workspace=? AND id=? AND version=?",
    workspace,
    t.id,
    t.version,
  );
  const config = JSON.stringify(t);
  if (prev && prev.config !== config)
    throw Error("Questionnaire definition changed. Create a new version.");
  await d.runAsync(
    "INSERT OR IGNORE INTO local_templates VALUES(?,?,?,?)",
    workspace,
    t.id,
    t.version,
    config,
  );
}
export async function localTemplates(workspace: string) {
  return (
    await (
      await db()
    ).getAllAsync<{ config: string }>(
      "SELECT config FROM local_templates WHERE workspace=? ORDER BY version DESC",
      workspace,
    )
  ).map((row) => JSON.parse(row.config) as Template);
}
export async function saveSession(session: Session, workspace: string) {
  SessionSchema.parse(session);
  await (
    await db()
  ).runAsync(
    "INSERT INTO local_sessions(id,workspace,metadata) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata WHERE local_sessions.sealed=0 AND local_sessions.workspace=excluded.workspace",
    session.id,
    workspace,
    JSON.stringify(session),
  );
}
export async function localSessions(workspace: string) {
  return (await db()).getAllAsync<{
    id: string;
    metadata: string;
    sealed: number;
  }>(
    "SELECT id,metadata,sealed FROM local_sessions WHERE workspace=? ORDER BY rowid DESC",
    workspace,
  );
}
export async function seal(session: Session, workspace: string) {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ sealed: number }>(
      "SELECT sealed FROM local_sessions WHERE id=? AND workspace=?",
      session.id,
      workspace,
    );
    if (!row) throw Error("Session not found in this workspace");
    if (row.sealed) return;
    await tx.runAsync(
      "UPDATE local_sessions SET metadata=?,sealed=1 WHERE id=?",
      JSON.stringify(SessionSchema.parse(session)),
      session.id,
    );
    let after = 0;
    for (;;) {
      const rows = await tx.getAllAsync<{ rowid: number; payload: string }>(
        "SELECT rowid,payload FROM local_samples WHERE session_id=? AND rowid>? ORDER BY rowid LIMIT 500",
        session.id,
        after,
      );
      const batch: Batch = {
        version: 1,
        batchId: randomUUID(),
        session,
        samples: rows.map((r) => JSON.parse(r.payload)),
      };
      await tx.runAsync(
        "INSERT INTO outbox(id,session_id,payload) VALUES(?,?,?)",
        batch.batchId,
        session.id,
        JSON.stringify(BatchSchema.parse(batch)),
      );
      if (rows.length < 500) break;
      after = rows[rows.length - 1].rowid;
    }
  });
}
export async function outbox(workspace: string) {
  return (await db()).getAllAsync<{ id: string; payload: string }>(
    "SELECT o.id,o.payload FROM outbox o JOIN local_sessions s ON s.id=o.session_id WHERE s.workspace=? AND o.acked=0 ORDER BY o.rowid LIMIT 20",
    workspace,
  );
}
export async function acknowledge(id: string) {
  await (await db()).runAsync("UPDATE outbox SET acked=1 WHERE id=?", id);
}
export async function counts(id: string) {
  const d = await db();
  return {
    signals: await d.getAllAsync<{ signal: string; count: number }>(
      "SELECT signal,COUNT(*) count FROM local_samples WHERE session_id=? GROUP BY signal ORDER BY signal",
      id,
    ),
    samples:
      (
        await d.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) n FROM local_samples WHERE session_id=?",
          id,
        )
      )?.n ?? 0,
    pending:
      (
        await d.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) n FROM outbox WHERE session_id=? AND acked=0",
          id,
        )
      )?.n ?? 0,
  };
}
export async function recover(id: string, workspace: string) {
  const d = await db();
  const row = await d.getFirstAsync<{ metadata: string }>(
    "SELECT metadata FROM local_sessions WHERE id=? AND workspace=? AND sealed=0",
    id,
    workspace,
  );
  if (!row) throw Error("No unfinished session");
  const s: Session = JSON.parse(row.metadata);
  const last = await d.getFirstAsync<{ t: number }>(
    "SELECT MAX(json_extract(payload,'$.t')) t FROM local_samples WHERE session_id=?",
    id,
  );
  s.durationMs = Math.max(1, s.durationMs, last?.t ?? 0);
  s.state = "ended";
  s.events.push({
    id: randomUUID(),
    t: s.durationMs,
    type: "note",
    label:
      "Recovered after interruption. The last memory buffer may be missing.",
  });
  await seal(s, workspace);
  return s;
}
// Single bounded buffer. Failed transaction retains exact samples; ingestion halts at hard cap.
export class SampleWriter {
  private buffer: Sample[] = [];
  private running: Promise<void> | null = null;
  private timer: ReturnType<typeof setInterval>;
  public error: string | null = null;
  public persisted = 0;
  get buffered() {
    return this.buffer.length;
  }
  constructor(private id: string) {
    this.timer = setInterval(() => {
      void this.flush().catch(() => {});
    }, 250);
  }
  append(sample: Sample) {
    if (this.buffer.length >= 1000) {
      this.error =
        "Storage buffer is full. Recording stopped; received samples are retained.";
      throw Error(this.error);
    }
    this.buffer.push(sample);
    if (this.buffer.length >= 500) void this.flush().catch(() => {});
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (!this.buffer.length) return Promise.resolve();
    const part = this.buffer.slice(0, 500);
    this.running = (async () => {
      try {
        const d = await db();
        await d.withExclusiveTransactionAsync(async (tx) => {
          // Batch SQL statements keep high-rate ECG + XYZ off the per-row bridge.
          for (let i = 0; i < part.length; i += 100) {
            const chunk = part.slice(i, i + 100);
            await tx.runAsync(
              `INSERT INTO local_samples VALUES ${chunk.map(() => "(?,?,?,?)").join(",")}`,
              chunk.flatMap((s) => [
                this.id,
                s.signal,
                s.index,
                JSON.stringify(s),
              ]),
            );
          }
        });
        this.buffer.splice(0, part.length);
        this.persisted += part.length;
        this.error = null;
      } catch (e) {
        this.error = e instanceof Error ? e.message : "Storage failed";
        throw e;
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }
  async drain() {
    while (this.buffer.length || this.running) await this.flush();
  }
  async close() {
    clearInterval(this.timer);
    await this.drain();
  }
}
