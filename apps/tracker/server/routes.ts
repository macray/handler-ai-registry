// The backend's routes, all under /api/. GET /api/health answers 200 once the shared folder is
// there. Everything is the owner's: the Tracker is one person's (X-HANDLER-Person is not used).
//
//   GET    /api/state?today=YYYY-MM-DD   trackers with their numbers, today's entries, what the Coach told you, your questions
//   POST   /api/trackers                 {name, unit?, goal?, step?}
//   PUT    /api/trackers/:id             the same fields (what is not sent stays)
//   DELETE /api/trackers/:id             (what was logged for it stays in log.jsonl)
//   POST   /api/log                      {tracker, amount?, day?, note?}: amount defaults to the tracker's step
//   DELETE /api/log/:id                  an undo
//   POST   /api/ask                      {request}: a run of the Coach agent (only from your click)
//   POST   /api/actions/:name            what you ask in a sentence, done by the app's code (actions.ts)
//
// The page sends its own day (`today`): the day on your clock, not the server's.
import { readFile, rename, writeFile } from "node:fs/promises";
import { act } from "./actions.ts";
import type { Run } from "./handler.ts";
import { summaries, today as serverToday } from "./stats.ts";
import { DAY, InputError, missing, type Store } from "./store.ts";

/** One question you asked the agent, kept in the app's own data (asks.json). */
export type Ask = {
  runId: string;
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

export async function handle(ctx: Context, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // ["api", "trackers", "water"]
  const day = url.searchParams.get("today");
  const today = day && DAY.test(day) ? day : serverToday();
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      if (!(await ctx.store.exists())) return Response.json({ error: "the folder is not there" }, { status: 503 });
      return Response.json({ ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/state") return Response.json(await state(ctx, today));
    if (parts[1] === "trackers" && parts.length <= 3) {
      const id = parts[2];
      const body = req.method === "DELETE" ? {} : await json(req);
      if (req.method === "POST" && !id) await ctx.store.addTracker(body);
      else if (req.method === "PUT" && id) await ctx.store.updateTracker(id, body);
      else if (req.method === "DELETE" && id) await ctx.store.removeTracker(id);
      else return notFound();
      return Response.json(await state(ctx, today), { status: req.method === "POST" ? 201 : 200 });
    }
    if (parts[1] === "log" && parts.length <= 3) {
      if (req.method === "POST" && !parts[2]) await ctx.store.log(await json(req), today);
      else if (req.method === "DELETE" && parts[2]) await ctx.store.unlog(parts[2]);
      else return notFound();
      return Response.json(await state(ctx, today), { status: req.method === "POST" ? 201 : 200 });
    }
    if (req.method === "POST" && url.pathname === "/api/ask") return await ask(ctx, req, today);
    if (req.method === "POST" && parts[1] === "actions" && parts.length === 3) {
      const result = await act(ctx.store, parts[2], await json(req));
      if (result) return Response.json(result);
    }
  } catch (e) {
    if (e instanceof InputError) return Response.json({ error: e.message }, { status: 400 });
    if (e instanceof SyntaxError) return Response.json({ error: `a file is not valid: ${e.message}` }, { status: 500 });
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

async function ask(ctx: Context, req: Request, today: string): Promise<Response> {
  const body = await json(req);
  const request = typeof body.request === "string" ? body.request.trim() : "";
  if (!request) throw new InputError("request: what do you want to ask?");
  if (request.length > 2000) throw new InputError("request: 2000 characters at most");
  let run: Run;
  try {
    run = await ctx.agent.run(req, { request });
  } catch (e) {
    return Response.json({ error: (e as Error).message.replace(/^runAgent: /, "") }, { status: 409 });
  }
  const asks = await readAsks(ctx);
  asks.unshift(fromRun({ runId: run.id, request, at: run.at, state: run.state }, run));
  await writeAsks(ctx, asks);
  return Response.json(await state(ctx, today), { status: 201 });
}

/** Everything the page shows; questions still going on are looked at again. */
async function state(ctx: Context, today: string) {
  const asks = await readAsks(ctx);
  let changed = false;
  for (const [i, a] of asks.entries()) {
    if (a.state !== "waiting" && a.state !== "running") continue;
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
  const [trackers, entries, messages] = await Promise.all([ctx.store.trackers(), ctx.store.entries(), ctx.store.messages()]);
  const ids = new Set(trackers.map((t) => t.id));
  return {
    folder: ctx.store.folder,
    today,
    trackers: summaries(trackers, entries, today),
    entries: entries.filter((e) => e.day === today && ids.has(e.tracker)).reverse(), // today's, newest first
    messages,
    asks,
  };
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
