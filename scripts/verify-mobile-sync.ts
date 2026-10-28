import assert from "node:assert/strict";
import { fullSignalCounts } from "../src/core/polarFixture";
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
  const found = sessions.filter((s) =>
    ["mobile-synthetic-v1", "mobile-synthetic-v2"].includes(s.source),
  );
  assert.ok(found.length, "Synkronisera ett syntetiskt mobilpass först");
  for (const session of found) {
    assert.equal(session.demo, true);
    const expected =
      session.source === "mobile-synthetic-v2"
        ? fullSignalCounts
        : { hr: 60, rr: 60 };
    for (const [signal, count] of Object.entries(expected)) {
      const response = await fetch(
        `${base}/api/sessions/${session.id}/series?signal=${signal}`,
        { headers },
      );
      assert.ok(response.ok);
      const series: Series = await response.json();
      assert.equal(series.rawCount, count, `${session.id}/${signal}`);
      assert.equal(series.summary.count, count);
    }
  }
  console.log(
    `${found.length} syntetiska mobilpass verifierade via API: alla förväntade signaler och sampleantal stämmer.`,
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
