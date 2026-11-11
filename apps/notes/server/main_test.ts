// Run by `bun test`, and by handler before every deploy (the deploy fails if a test fails).
// Tests get no network and may only write in HANDLER_APP_DATA: each one gets its own folders there,
// and a fake agent.
import { expect, test } from "bun:test";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import type { Run } from "./handler.ts";
import { type Context, handle } from "./routes.ts";
import { parse, Store } from "./store.ts";

const root = process.env.HANDLER_APP_DATA ?? ".data";

const ACTIONS = `# Weekly sync

## Actions
- [ ] Send the Q3 report to Sam @me due:2026-10-27
- [x] Fix the login bug @Alice
- [ ] Book a room for the demo

## Decisions
- We ship on Friday 30 October

## Questions
- Who owns the billing page?

## Follow-up
Hi all, thanks for today.
Open: who owns the billing page?
`;

const run: Run = { id: "r_1", agent: "scribe", sessionId: "s_1", state: "running", at: "2026-10-24T10:00:00Z" };

async function setup(): Promise<Context & { folder: string; asked: unknown[] }> {
  const base = `${root}/test-${crypto.randomUUID()}`;
  const folder = `${base}/notes`;
  await mkdir(folder, { recursive: true });
  const asked: unknown[] = [];
  return {
    folder,
    asked,
    store: new Store(folder),
    data: base,
    agent: {
      run: (request, fields) => {
        if (!request.headers.get("x-handler-start")) return Promise.reject(new Error("runAgent: only while answering the owner's request"));
        asked.push(fields);
        return Promise.resolve(run);
      },
      get: () => Promise.resolve(run),
    },
  };
}

async function call(ctx: Context, method: string, path: string, body?: unknown, start = true) {
  const headers: Record<string, string> = { "x-handler-person": "owner" };
  if (start) headers["x-handler-start"] = "token";
  const res = await handle(ctx, new Request(`http://app${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

/** A note as if written earlier, and what the agent made of it. */
async function written(ctx: { folder: string }, name: string, note: string, actions?: string): Promise<void> {
  await mkdir(`${ctx.folder}/notes`, { recursive: true });
  await writeFile(`${ctx.folder}/notes/${name}.md`, note);
  if (actions === undefined) return;
  await mkdir(`${ctx.folder}/actions`, { recursive: true });
  await writeFile(`${ctx.folder}/actions/${name}.md`, actions);
}

test("health answers once the shared folder is there", async () => {
  const ctx = await setup();
  expect((await call(ctx, "GET", "/api/health")).status).toBe(200);
  await rm(ctx.folder, { recursive: true });
  expect((await call(ctx, "GET", "/api/health")).status).toBe(503);
});

test("an empty folder is no notes yet", async () => {
  const ctx = await setup();
  const { status, body } = await call(ctx, "GET", "/api/state");
  expect(status).toBe(200);
  expect(body.notes).toEqual([]);
  expect(body.messages).toEqual([]);
});

test("a note saved is a file of notes/, and starts the agent on it", async () => {
  const ctx = await setup();
  const saved = await call(ctx, "POST", "/api/notes", { text: "Sam sends the quote Monday.\nI check the budget.", title: "Call with Sam" });
  expect(saved.status).toBe(201);
  const [note] = saved.body.notes;
  expect(note).toMatchObject({ title: "Call with Sam", done: false, actions: [] });
  expect(note.name).toMatch(/^\d{4}-\d{2}-\d{2}-\d{4}-call-with-sam$/);
  expect(await readFile(`${ctx.folder}/notes/${note.name}.md`, "utf8")).toBe("# Call with Sam\n\nSam sends the quote Monday.\nI check the budget.\n");
  expect(ctx.asked).toEqual([{ request: "Turn my new notes into actions." }]);
  expect(saved.body.asks[0]).toMatchObject({ runId: "r_1", state: "running" });

  const again = await call(ctx, "POST", "/api/notes", { text: "# Call with Sam\nagain" });
  expect(again.body.notes.map((n: any) => n.name).sort()[1]).toBe(`${note.name}-2`); // same minute, same title
  expect((await call(ctx, "POST", "/api/notes", { text: "  " })).status).toBe(400);
});

test("a note is saved even when the agent cannot start: the page says why", async () => {
  const ctx = await setup();
  const saved = await call(ctx, "POST", "/api/notes", { text: "An idea" }, false);
  expect(saved.status).toBe(201);
  expect(saved.body.notes.length).toBe(1);
  expect(saved.body.asks[0]).toMatchObject({ state: "failed", error: "only while answering the owner's request" });
});

test("reads what the agent made of a note: actions with owner and day, decisions, questions, follow-up", async () => {
  const ctx = await setup();
  await written(ctx, "2026-10-24-1030-weekly-sync", "# Weekly sync\n\nnotes…", ACTIONS);
  await written(ctx, "idea", "Just an idea"); // dropped from an editor, not done yet
  const { body } = await call(ctx, "GET", "/api/state");
  // by name: a dropped note's date is its file's (now), so the order depends on the day
  const named = (name: string) => body.notes.find((n: any) => n.name === name);
  const [sync, idea] = [named("2026-10-24-1030-weekly-sync"), named("idea")];
  expect(sync).toMatchObject({ title: "Weekly sync", done: true, decisions: ["We ship on Friday 30 October"], questions: ["Who owns the billing page?"] });
  expect(sync.followup).toBe("Hi all, thanks for today.\nOpen: who owns the billing page?");
  expect(sync.actions).toEqual([
    { line: 3, text: "Send the Q3 report to Sam", owner: "me", due: "2026-10-27", done: false },
    { line: 4, text: "Fix the login bug", owner: "Alice", done: true },
    { line: 5, text: "Book a room for the demo", done: false },
  ]);
  expect(idea).toMatchObject({ name: "idea", title: "Just an idea", done: false });
});

test("ticks an action in its file, its box only", async () => {
  const ctx = await setup();
  await written(ctx, "sync", "# Sync", ACTIONS);
  const ticked = await call(ctx, "POST", "/api/notes/sync/actions/3", { done: true });
  expect(ticked.body.notes[0].actions[0].done).toBe(true);
  const file = await readFile(`${ctx.folder}/actions/sync.md`, "utf8");
  expect(file).toBe(ACTIONS.replace("- [ ] Send the Q3", "- [x] Send the Q3"));
  await call(ctx, "POST", "/api/notes/sync/actions/4", { done: false });
  expect((await ctx.store.notes())[0].actions[1].done).toBe(false);
  expect((await readdir(`${ctx.folder}/actions`)).filter((f) => f.startsWith("."))).toEqual([]); // no temporary file left

  expect((await call(ctx, "POST", "/api/notes/sync/actions/7", { done: true })).status).toBe(400); // a decision's line
  expect((await call(ctx, "POST", "/api/notes/nope/actions/3", { done: true })).status).toBe(400);
  expect((await call(ctx, "POST", "/api/notes/..%2Fsecret/actions/3", { done: true })).status).toBe(400);
});

test("deletes a note and what the agent made of it", async () => {
  const ctx = await setup();
  await written(ctx, "sync", "# Sync", ACTIONS);
  const { body } = await call(ctx, "DELETE", "/api/notes/sync");
  expect(body.notes).toEqual([]);
  expect(await readdir(`${ctx.folder}/actions`)).toEqual([]);
});

test("its actions: a note taken starts the agent; what is open, mine or everyone's, the late first", async () => {
  const ctx = await setup();
  const taken = await call(ctx, "POST", "/api/actions/note", { text: "Call with Sam: he sends the quote Monday" });
  expect(taken.body.status).toBe("ok");
  expect(taken.body.summary).toBe("Saved “Call with Sam: he sends the quote Monday”. Its actions come in a minute or two, here and in your inbox.");
  expect(ctx.asked.length).toBe(1);

  await written(ctx, "sync", "# Sync", ACTIONS);
  const mine = await call(ctx, "POST", "/api/actions/open", { day: "2026-10-28" });
  expect(mine.body).toMatchObject({ status: "attention", summary: "1 open for you. Late: Send the Q3 report to Sam." });
  const all = await call(ctx, "POST", "/api/actions/open", { who: "everyone", day: "2026-10-24" });
  expect(all.body).toMatchObject({ status: "ok", summary: "2 open. Send the Q3 report to Sam (me); Book a room for the demo." });
  expect((await call(ctx, "POST", "/api/actions/open", { who: "them" })).status).toBe(400);
  expect((await call(ctx, "POST", "/api/actions/nope", {})).status).toBe(404);
});

test("a question is a run of the agent, from the owner's request only", async () => {
  const ctx = await setup();
  const asked = await call(ctx, "POST", "/api/ask", { request: "What did we decide about pricing?" });
  expect(asked.status).toBe(201);
  expect(ctx.asked).toEqual([{ request: "What did we decide about pricing?" }]);
  const done: Run = { ...run, state: "succeeded", result: { status: "ok", summary: "Pricing stays as it is until March." } };
  ctx.agent.get = () => Promise.resolve(done);
  expect((await call(ctx, "GET", "/api/state")).body.asks[0]).toMatchObject({ state: "succeeded", summary: "Pricing stays as it is until March." });
  expect((await call(ctx, "POST", "/api/ask", { request: "Again?" }, false)).status).toBe(409);
  expect((await call(ctx, "POST", "/api/ask", { request: "" })).status).toBe(400);
});

test("an actions file written by hand is read as well as it can be", () => {
  const made = parse("## ACTIONS\n* [X] Done one @me\n- not an action, no box\n\n## Next steps\n- ignored\n");
  expect(made.actions).toEqual([{ line: 1, text: "Done one", owner: "me", done: true }]);
  expect(parse("").actions).toEqual([]);
});
