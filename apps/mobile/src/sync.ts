import { acknowledge, outbox, localTemplates } from "./storage";
import { drainOutbox, Ack } from "../../../src/core/sync";
export async function request<T>(
  server: string,
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`${server.replace(/\/$/, "")}/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await r.json();
    if (!r.ok) throw Error(`${r.status}: ${data.error ?? "Upload failed"}`);
    return data;
  } catch (e) {
    if (controller.signal.aborted)
      throw Error(
        "The APEX server did not respond. Check the server address and your network connection.",
      );
    if (e instanceof TypeError)
      throw Error(
        "Could not reach APEX. Check the server address. For a local server, use the Mac’s Wi-Fi address, connect both devices to the same network, and allow Local Network access for the app.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
let syncing = false;
export async function synchronize(
  server: string,
  token: string,
  workspace: string,
  onProgress: (n: number) => void,
) {
  if (syncing) throw Error("Sync is already in progress");
  syncing = true;
  try {
    const definitions = await localTemplates(workspace);
    const registered = new Set<string>();
    return await drainOutbox(
      () => outbox(workspace),
      async (batch) => {
        const key = `${batch.session.typeId}:${batch.session.typeVersion}`;
        if (!registered.has(key)) {
          const template = definitions.find(
            (t) =>
              t.id === batch.session.typeId &&
              t.version === batch.session.typeVersion,
          );
          if (!template)
            throw Error("Local questionnaire definition is missing");
          await request(
            server,
            token ? "templates" : "mvp/templates",
            template,
            token,
          );
          registered.add(key);
        }
        return request<Ack>(
          server,
          token ? "ingest" : "mvp/ingest",
          batch,
          token,
        );
      },
      acknowledge,
      onProgress,
    );
  } finally {
    syncing = false;
  }
}
