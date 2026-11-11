// Run by `bun test`, and by handler before every deploy (the deploy fails if a test fails).
// Tests get no network and may only write in HANDLER_APP_DATA: each one gets its own folders there,
// and a fake agent.
import { expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { match } from "./actions.ts";
import type { Run } from "./handler.ts";
import { type Context, handle } from "./routes.ts";
import { summaries } from "./stats.ts";
import { Store } from "./store.ts";

const root = process.env.HANDLER_APP_DATA ?? ".data";
const DAY = "2026-10-24";

async function setup(runs: Run[] = []): Promise<Context & { folder: string; asked: unknown[] }> {
  const base = `${root}/test-${crypto.randomUUID()}`;
  const folder = `${base}/tracker`;
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
        return Promise.resolve(runs[0]);
      },
      get: (id) => Promise.resolve(runs.find((r) => r.id === id && r !== runs[0]) ?? runs[0]),
    },
  };
}

async function call(ctx: Context, method: string, path: string, body?: unknown, start = true) {
  const headers: Record<string, string> = { "x-handler-person": "owner" };
  if (start) headers["x-handler-start"] = "token";
  const res = await handle(ctx, new Request(`http://app${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

test("health answers once the shared folder is there", async () => {
  const ctx = await setup();
  expect((await call(ctx, "GET", "/api/health")).status).toBe(200);
  await rm(ctx.folder, { recursive: true });
  expect((await call(ctx, "GET", "/api/health")).status).toBe(503);
});

test("an empty folder is nothing tracked yet", async () => {
  const ctx = await setup();
  const { status, body } = await call(ctx, "GET", `/api/state?today=${DAY}`);
  expect(status).toBe(200);
  expect(body.trackers).toEqual([]);
  expect(body.entries).toEqual([]);
  expect(body.today).toBe(DAY);
});

test("adds a tracker, logs taps and undoes one, in the folder's files", async () => {
  const ctx = await setup();
  const added = await call(ctx, "POST", `/api/trackers?today=${DAY}`, { name: " Water ", unit: "glasses", goal: 8 });
  expect(added.status).toBe(201);
  expect(added.body.trackers[0]).toMatchObject({ id: "water", name: "Water", unit: "glasses", goal: 8, step: 1, today: 0, streak: 0 });

  await call(ctx, "POST", `/api/log?today=${DAY}`, { tracker: "water" });
  const two = await call(ctx, "POST", `/api/log?today=${DAY}`, { tracker: "water", amount: 2 });
  expect(two.body.trackers[0].today).toBe(3);
  expect(two.body.entries.map((e: any) => e.amount)).toEqual([2, 1]); // newest first

  const undone = await call(ctx, "DELETE", `/api/log/${two.body.entries[0].id}?today=${DAY}`);
  expect(undone.body.trackers[0].today).toBe(1);
  const log = (await readFile(`${ctx.folder}/log.jsonl`, "utf8")).trim().split("\n");
  expect(log.length).toBe(1);
  expect(JSON.parse(log[0])).toMatchObject({ day: DAY, tracker: "water", amount: 1 });
  expect(JSON.parse(await readFile(`${ctx.folder}/trackers.json`, "utf8")).trackers[0].id).toBe("water");
});

test("changes and removes a tracker; its history stays in the log", async () => {
  const ctx = await setup();
  await call(ctx, "POST", "/api/trackers", { name: "Run", unit: "km", step: 5 });
  await call(ctx, "POST", `/api/log?today=${DAY}`, { tracker: "run" });
  const changed = await call(ctx, "PUT", `/api/trackers/run?today=${DAY}`, { goal: 10 });
  expect(changed.body.trackers[0]).toMatchObject({ unit: "km", step: 5, goal: 10, today: 5 });
  const cleared = await call(ctx, "PUT", "/api/trackers/run", { goal: "" });
  expect(cleared.body.trackers[0].goal).toBeUndefined();
  const removed = await call(ctx, "DELETE", "/api/trackers/run");
  expect(removed.body.trackers).toEqual([]);
  expect((await ctx.store.entries()).length).toBe(1);
});

test("refuses what does not make sense", async () => {
  const ctx = await setup();
  expect((await call(ctx, "POST", "/api/trackers", { name: "" })).status).toBe(400);
  expect((await call(ctx, "POST", "/api/trackers", { name: "Water", goal: -1 })).status).toBe(400);
  await call(ctx, "POST", "/api/trackers", { name: "Water" });
  const again = await call(ctx, "POST", "/api/trackers", { name: "water" });
  expect(again.body.trackers.map((t: any) => t.id)).toEqual(["water", "water-2"]);
  expect((await call(ctx, "POST", "/api/log", { tracker: "nope" })).status).toBe(400);
  expect((await call(ctx, "POST", "/api/log", { tracker: "water", amount: 0 })).status).toBe(400);
  expect((await call(ctx, "POST", "/api/log", { tracker: "water", day: "tomorrow" })).status).toBe(400);
  expect((await call(ctx, "DELETE", "/api/log/e_00000000")).status).toBe(400);
  expect((await call(ctx, "GET", "/api/nope")).status).toBe(404);
});

test("streaks count the days in a row at the goal; today counts once it is met", () => {
  const t = { id: "water", name: "Water", goal: 2, step: 1 };
  const e = (day: string, amount: number) => ({ id: `e_${day}`, at: "", day, tracker: "water", amount });
  const before = [e("2026-10-21", 2), e("2026-10-22", 3), e("2026-10-23", 2), e("2026-10-24", 1)];
  const [s] = summaries([t], before, DAY);
  expect(s.today).toBe(1);
  expect(s.streak).toBe(3); // up to yesterday
  expect(s.week.map((d) => d.total)).toEqual([0, 0, 0, 2, 3, 2, 1]);
  expect(summaries([t], [...before, e(DAY, 1)], DAY)[0].streak).toBe(4);
  expect(summaries([{ ...t, goal: undefined }], [e("2026-10-23", 1)], DAY)[0].streak).toBe(1); // no goal: something logged
});

test("its actions: log on the tracker a word names, made when there is none; today's numbers", async () => {
  const ctx = await setup();
  await call(ctx, "POST", "/api/trackers", { name: "Water", unit: "glasses", goal: 8 });
  const water = await call(ctx, "POST", "/api/actions/log", { what: "water", amount: 2 });
  expect(water.body.status).toBe("ok");
  expect(water.body.summary).toBe("Logged 2 glasses on Water: 2 of 8 glasses today.");
  const glass = await call(ctx, "POST", "/api/actions/log", { what: "glass" });
  expect(glass.body.data.tracker.today).toBe(3);

  const run = await call(ctx, "POST", "/api/actions/log", { what: "run", amount: 5, day: "2026-10-20" });
  expect(run.body.summary).toBe("Logged 5 on Run: 5 on 2026-10-20. New tracker: Run.");

  const today = await call(ctx, "POST", "/api/actions/today", {});
  expect(today.body.summary).toBe("Water: 3 of 8 glasses. Run: 0.");
  expect((await call(ctx, "POST", "/api/actions/log", {})).status).toBe(400);
  expect((await call(ctx, "POST", "/api/actions/nope", {})).status).toBe(404);
});

test("a word names a tracker by its id, its name's words or its unit", () => {
  const trackers = [
    { id: "water", name: "Water", unit: "glasses", step: 1 },
    { id: "pages-read", name: "Pages read", step: 10 },
    { id: "run", name: "Run", unit: "km", step: 5 },
  ];
  expect(match(trackers, "Water")?.id).toBe("water");
  expect(match(trackers, "glass")?.id).toBe("water");
  expect(match(trackers, "pages read")?.id).toBe("pages-read");
  expect(match(trackers, "km")?.id).toBe("run");
  expect(match(trackers, "coffee")).toBeUndefined();
});

test("a question to the Coach is a run of the agent, from the owner's request only", async () => {
  const run: Run = { id: "r_1", agent: "coach", sessionId: "s_1", state: "running", at: "2026-10-24T10:00:00Z" };
  const done: Run = { ...run, id: "r_1", state: "succeeded", result: { status: "ok", summary: "Six days of eight glasses." } };
  const ctx = await setup([run]);
  const asked = await call(ctx, "POST", "/api/ask", { request: "How was my week?" });
  expect(asked.status).toBe(201);
  expect(ctx.asked).toEqual([{ request: "How was my week?" }]);
  expect(asked.body.asks[0]).toMatchObject({ runId: "r_1", state: "running" });

  ctx.agent.get = () => Promise.resolve(done);
  const later = await call(ctx, "GET", "/api/state");
  expect(later.body.asks[0]).toMatchObject({ state: "succeeded", summary: "Six days of eight glasses." });

  expect((await call(ctx, "POST", "/api/ask", { request: "Again?" }, false)).status).toBe(409);
  expect((await call(ctx, "POST", "/api/ask", { request: " " })).status).toBe(400);
});

test("what the agent told you is read from messages.jsonl, newest first; a broken line is skipped", async () => {
  const ctx = await setup();
  await writeFile(
    `${ctx.folder}/messages.jsonl`,
    '{"id":"m_00000001","at":"2026-10-23T20:00:00Z","text":"First"}\nnot json\n{"id":"m_00000002","at":"2026-10-24T20:00:00Z","text":"Second"}\n',
  );
  const { body } = await call(ctx, "GET", "/api/state");
  expect(body.messages.map((m: any) => m.text)).toEqual(["Second", "First"]);
});
