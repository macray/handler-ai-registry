// The backend's routes, all under /api/. GET /api/health answers 200 once the shared folder is
// there. Everything is the owner's: the Notes are one person's (X-HANDLER-Person is not used).
//
//   GET    /api/state                           notes with what the agent made of them, what it told you, your questions
//   POST   /api/notes                           {text, title?}: saved, then a run of the agent on it
//   DELETE /api/notes/:name                     the note and its actions file
//   POST   /api/notes/:name/actions/:line       {done}: an action ticked (or not)
//   POST   /api/ask                             {request}: a run of the agent (only from your click)
//   POST   /api/actions/:name                   what you ask in a sentence, done by the app's code (actions.ts)
import { readFile, rename, writeFile } from "node:fs/promises";
import { act } from "./actions.ts";
import type { Run } from "./handler.ts";
import { InputError, missing, type Store } from "./store.ts";

/** One run of the agent you started, kept in the app's own data (asks.json). */
export type Ask = {
  runId?: string; // none: it could not start (`error` says why)
  request: string;
  at: string;
  state: Run["state"];
  status?: "ok" | "attention" | "failed";
  summary?: string;
  error?: string;
};

/** What the routes use: the shared folder, the app's own data folder, the agent. */
export type Context = {
  store: Store;
  data: string; // HANDLER_APP_DATA
  agent: {
    run(request: Request, fields: Record<string, unknown>): Promise<Run>;
    get(id: string): Promise<Run>;
  };
};

const KEEP_ASKS = 20;
const NEW_NOTES = "Turn my new notes into actions.";

export async function handle(ctx: Context, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent); // ["api", "notes", "2026-…", "actions", "3"]
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      if (!(await ctx.store.exists())) return Response.json({ error: "the folder is not there" }, { status: 503 });
      return Response.json({ ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/state") return Response.json(await state(ctx));
    if (parts[1] === "notes") {
      const [, , name, what, line] = parts;
      if (req.method === "POST" && !name) {
        await ctx.store.add(await json(req));
        await start(ctx, req, NEW_NOTES);
        return Response.json(await state(ctx), { status: 201 });
      }
      if (req.method === "DELETE" && name && !what) await ctx.store.remove(name);
      else if (req.method === "POST" && name && what === "actions" && line && parts.length === 5) {
        const body = await json(req);
        await ctx.store.tick(name, Number(line), body.done !== false);
      } else return notFound();
      return Response.json(await state(ctx));
    }
    if (req.method === "POST" && url.pathname === "/api/ask") {
      const body = await json(req);
      const request = typeof body.request === "string" ? body.request.trim() : "";
      if (!request) throw new InputError("request: what do you want to ask?");
      if (request.length > 2000) throw new InputError("request: 2000 characters at most");
      const failed = await start(ctx, req, request);
      if (failed) return Response.json({ error: failed }, { status: 409 });
      return Response.json(await state(ctx), { status: 201 });
    }
    if (req.method === "POST" && parts[1] === "actions" && parts.length === 3) {
      const result = await act(ctx.store, parts[2], await json(req), () => start(ctx, req, NEW_NOTES));
      if (result) return Response.json(result);
    }
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof URIError) return Response.json({ error: "not a valid address" }, { status: 400 });
    throw e;
  }
  return notFound();
}

function notFound(): Response {
  return Response.json({ error: "not found" }, { status: 404 });
}

/** The request's JSON body, `{}` without one (its fields are checked where they are used). */
async function json(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => ({}));
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** A run of the agent, kept in asks.json: null once started, else why it could not. */
async function start(ctx: Context, req: Request, request: string): Promise<string | null> {
  const asks = await readAsks(ctx);
  let failed: string | null = null;
  try {
    const run = await ctx.agent.run(req, { request });
    asks.unshift(fromRun({ runId: run.id, request, at: run.at, state: run.state }, run));
  } catch (e) {
    failed = (e as Error).message.replace(/^runAgent: /, "");
    asks.unshift({ request, at: new Date().toISOString(), state: "failed", error: failed });
  }
  await writeAsks(ctx, asks);
  return failed;
}

/** Everything the page shows; runs still going on are looked at again. */
async function state(ctx: Context) {
  const asks = await readAsks(ctx);
  let changed = false;
  for (const [i, a] of asks.entries()) {
    if (!a.runId || (a.state !== "waiting" && a.state !== "running")) continue;
    try {
      const run = await ctx.agent.get(a.runId);
      if (run.state !== a.state) {
        asks[i] = fromRun(a, run);
        changed = true;
      }
    } catch (e) {
      asks[i] = { ...a, state: "failed", error: (e as Error).message };
      changed = true;
    }
  }
  if (changed) await writeAsks(ctx, asks);
  const [notes, messages] = await Promise.all([ctx.store.notes(), ctx.store.messages()]);
  return { folder: ctx.store.folder, notes, messages, asks };
}

function fromRun(ask: Ask, run: Run): Ask {
  const out: Ask = { runId: ask.runId, request: ask.request, at: ask.at, state: run.state };
  if (run.result) {
    out.status = run.result.status;
    out.summary = run.result.summary;
  }
  if (run.error) out.error = run.error;
  return out;
}

async function readAsks(ctx: Context): Promise<Ask[]> {
  try {
    return JSON.parse(await readFile(`${ctx.data}/asks.json`, "utf8"));
  } catch (e) {
    if (missing(e)) return [];
    throw e;
  }
}

async function writeAsks(ctx: Context, asks: Ask[]): Promise<void> {
  const tmp = `${ctx.data}/asks.json.tmp`;
  await writeFile(tmp, JSON.stringify(asks.slice(0, KEEP_ASKS), null, 2));
  await rename(tmp, `${ctx.data}/asks.json`);
}
