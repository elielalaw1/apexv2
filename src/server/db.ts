import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync, createHash } from "node:crypto";
export const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export function hashPassword(
  p: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(p, salt, 64).toString("hex")}`;
}
let singleton: DatabaseSync;
export function getDb() {
  if (singleton) return singleton;
  const file = process.env.APEX_DB_PATH || resolve("data/apexvip.sqlite");
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  singleton = new DatabaseSync(file);
  singleton.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,workspace TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS auth(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,workspace TEXT NOT NULL,metadata TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS batches(workspace TEXT NOT NULL,id TEXT NOT NULL,session_id TEXT NOT NULL REFERENCES sessions(id),hash TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(workspace,id));
  CREATE TABLE IF NOT EXISTS samples(session_id TEXT NOT NULL REFERENCES sessions(id),signal TEXT NOT NULL,idx INTEGER NOT NULL,t REAL NOT NULL,received REAL NOT NULL,sensor TEXT,value REAL NOT NULL,quality TEXT NOT NULL,PRIMARY KEY(session_id,signal,idx));
  CREATE INDEX IF NOT EXISTS sample_window ON samples(session_id,signal,t,idx);
  CREATE INDEX IF NOT EXISTS session_workspace ON sessions(workspace);
  CREATE TABLE IF NOT EXISTS layouts(workspace TEXT NOT NULL,id TEXT NOT NULL,config TEXT NOT NULL,PRIMARY KEY(workspace,id));
  CREATE TABLE IF NOT EXISTS templates(workspace TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,config TEXT NOT NULL,PRIMARY KEY(workspace,id,version));`);
  if (process.env.APEX_DEMO_ENABLED !== "false") {
    const insert = singleton.prepare(
      "INSERT OR IGNORE INTO users VALUES(?,?,?,?)",
    );
    insert.run(
      "demo-researcher",
      "demo@apexvip.local",
      hashPassword("apex-demo-2026"),
      "demo-lab",
    );
    insert.run(
      "demo-other",
      "other@apexvip.local",
      hashPassword("apex-demo-2026"),
      "other-lab",
    );
  }
  return singleton;
}
export type User = {
  id: string;
  email: string;
  workspace: string;
  password: string;
};
