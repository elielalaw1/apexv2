import { defaultTemplate } from "../src/core/contract";
import { demoBatches } from "../src/core/demo";
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
  if (!login.ok) throw Error(`Login ${login.status}`);
  const { token } = await login.json();
  const definition = await fetch(`${base}/api/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(defaultTemplate),
  });
  if (!definition.ok) throw Error(await definition.text());
  let count = 0;
  for (const batch of demoBatches()) {
    const response = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw Error(await response.text());
    const ack = await response.json();
    if (ack.batchId !== batch.batchId || ack.accepted !== batch.samples.length)
      throw Error("Felaktig kvittens");
    count += ack.accepted;
  }
  console.log(
    `Kvitterade ${count} samples via API; återförsök ändrar inte antal lagrade råsamples.`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
