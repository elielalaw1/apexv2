import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { currentUser, login, checkOrigin } from "@/server/auth";
import {
  ApiError,
  ingest,
  sessions,
  requireSession,
  readSeries,
  layouts,
  saveLayout,
  saveTemplate,
  rawPage,
  signalInventory,
  metrics,
} from "@/server/store";
import { getDb, sha } from "@/server/db";
import { defaultTemplate, signalKinds, SignalKind } from "@/core/contract";
import { demoBatches } from "@/core/demo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: Request, ctx: Context) {
  try {
    const segments = (await ctx.params).path;
    const publicMvp = segments[0] === "mvp";
    if (publicMvp && process.env.APEX_MVP_ENABLED === "false")
      throw new ApiError(403, "MVP workspace is disabled");
    const path = (publicMvp ? segments.slice(1) : segments).join("/");
    if (
      publicMvp &&
      !["me", "sessions", "ingest", "templates"].includes(path.split("/")[0])
    )
      throw new ApiError(404, "Resource not found");
    const method = req.method;
    const url = new URL(req.url);
    if (method !== "GET") checkOrigin(req);
    if (path === "auth/login" && method === "POST") {
      const { email, password } = z
        .object({ email: z.email(), password: z.string().min(1).max(200) })
        .parse(await req.json());
      const { token, user } = login(email, password);
      (await cookies()).set("apex_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure:
          url.protocol === "https:" ||
          process.env.APEX_PUBLIC_ORIGIN?.startsWith("https:") === true,
        path: "/",
        maxAge: 7 * 86400,
      });
      return NextResponse.json({
        user: { email: user.email, workspace: user.workspace },
        token,
      });
    }
    const user = publicMvp
      ? { email: "", workspace: process.env.APEX_MVP_WORKSPACE ?? "demo-lab" }
      : await currentUser(req);
    const workspace = user.workspace;
    if (path === "auth/logout" && method === "POST") {
      const jar = await cookies();
      const token =
        req.headers
          .get("authorization")
          ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] ??
        jar.get("apex_session")?.value;
      if (token)
        getDb().prepare("DELETE FROM auth WHERE token=?").run(sha(token));
      jar.delete("apex_session");
      return NextResponse.json({ ok: true });
    }
    if (path === "me")
      return NextResponse.json({ email: user.email, workspace });
    if (path === "ingest" && method === "POST") {
      const length = Number(req.headers.get("content-length") || 0);
      if (length > 2e6) throw new ApiError(413, "Batch is too large");
      const body = await req.text();
      if (body.length > 2e6) throw new ApiError(413, "Batch is too large");
      return NextResponse.json(ingest(workspace, JSON.parse(body)));
    }
    if (path === "demo" && method === "POST") {
      if (process.env.APEX_DEMO_ENABLED === "false")
        throw new ApiError(403, "Demo mode is disabled");
      saveTemplate(workspace, defaultTemplate);
      for (const b of demoBatches()) ingest(workspace, b);
      return NextResponse.json({ sessions: sessions(workspace) });
    }
    if (path === "sessions" && method === "GET")
      return NextResponse.json(sessions(workspace));
    if (path.startsWith("sessions/")) {
      const [, id, action] = path.split("/");
      const session = requireSession(workspace, id);
      if (action === "signals")
        return NextResponse.json(signalInventory(workspace, id));
      if (action === "metrics")
        return NextResponse.json(metrics(workspace, id));
      if (action === "series") {
        const signal = url.searchParams.get("signal") as SignalKind;
        if (!signalKinds.includes(signal))
          throw new ApiError(400, "Unknown signal");
        const from = Number(url.searchParams.get("from") ?? 0),
          to = Number(url.searchParams.get("to") ?? session.durationMs);
        if (
          !Number.isFinite(from) ||
          !Number.isFinite(to) ||
          from < 0 ||
          to < from
        )
          throw new ApiError(400, "Invalid time interval");
        return NextResponse.json(readSeries(workspace, id, signal, from, to));
      }
      if (action === "raw") {
        const after = Number(url.searchParams.get("after") ?? -1);
        if (!Number.isSafeInteger(after))
          throw new ApiError(400, "Invalid cursor");
        return NextResponse.json({
          session,
          points: rawPage(workspace, id, after),
        });
      }
      return NextResponse.json(session);
    }
    if (path === "layouts") {
      if (method === "POST")
        return NextResponse.json(saveLayout(workspace, await req.json()));
      return NextResponse.json(layouts(workspace));
    }
    if (path === "templates") {
      if (method === "POST")
        return NextResponse.json(saveTemplate(workspace, await req.json()));
      return NextResponse.json(
        getDb()
          .prepare(
            "SELECT config FROM templates WHERE workspace=? ORDER BY version DESC",
          )
          .all(workspace)
          .map((r) => JSON.parse(r.config as string)),
      );
    }
    throw new ApiError(404, "Resource not found");
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid data" },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    console.error(error);
    return NextResponse.json(
      { error: "The server could not complete the request" },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
