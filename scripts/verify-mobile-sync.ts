import assert from "node:assert/strict";
import { Session, Series } from "../src/core/contract";
async function main() {
  const base = process.env.APEX_URL ?? "http://127.0.0.1:3003";
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.APEX_EMAIL ?? "demo@apexvip.local",
      password: process.env.APEX_PASSWORD ?? "apex-demo-2026",
    }),
  });
  assert.ok(login.ok, "API-inloggning misslyckades");
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const list = await fetch(`${base}/api/sessions`, { headers });
  assert.ok(list.ok);
  const sessions: Session[] = await list.json();
  const found = sessions.filter((s) => s.source === "mobile-synthetic-v1");
  assert.ok(found.length, "Synkronisera ett syntetiskt mobilpass först");
  for (const session of found) {
    assert.equal(session.demo, true);
    for (const signal of ["hr", "rr"]) {
      const response = await fetch(
        `${base}/api/sessions/${session.id}/series?signal=${signal}`,
        { headers },
      );
      assert.ok(response.ok);
      const series: Series = await response.json();
      assert.equal(series.rawCount, 60, `${session.id}/${signal}`);
      assert.equal(series.summary.count, 60);
    }
  }
  console.log(
    `${found.length} syntetiska mobilpass verifierade via API: exakt 60 HR + 60 RR per pass.`,
  );
  await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: "{}",
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
