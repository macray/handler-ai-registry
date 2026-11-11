// Tracker's actions, what you can ask it in a sentence (app.toml [actions], contract H.12), done
// by its code: each answers {status, summary, data?}, the summary one or two sentences readable aloud.
//
//   POST /api/actions/log      {what, amount?, day?, note?}   logged on the tracker it names (made if none)
//   POST /api/actions/today    {day?}                         where each tracker is today
//
// "How was my week?" is done by the Coach agent (app.toml), not here.
import { amount, summaries, today } from "./stats.ts";
import { DAY, InputError, type Store, type Tracker, slug } from "./store.ts";

export type ActionResult = { status: "ok" | "attention" | "failed"; summary: string; data?: unknown };

export async function act(store: Store, name: string, body: Record<string, unknown>): Promise<ActionResult | null> {
  if (name === "log") return await log(store, body);
  if (name === "today") return await status(store, body);
  return null;
}

async function log(store: Store, body: Record<string, unknown>): Promise<ActionResult> {
  if (typeof body.what !== "string" || !body.what.trim()) throw new InputError("what: what did you do?");
  const day = body.day ?? today();
  if (typeof day !== "string" || !DAY.test(day)) throw new InputError("day: a day, YYYY-MM-DD");
  let tracker = match(await store.trackers(), body.what);
  const made = !tracker;
  if (!tracker) tracker = await store.addTracker({ name: capital(body.what.trim()) });
  const entry = await store.log({ tracker: tracker.id, amount: body.amount, day, note: body.note }, today());
  const [now] = summaries([tracker], await store.entries(), day);
  const unit = tracker.unit ? ` ${tracker.unit}` : "";
  let summary = `Logged ${entry.amount}${unit} on ${tracker.name}: ${amount(tracker, now.today)} ${day === today() ? "today" : `on ${day}`}.`;
  if (tracker.goal && now.today >= tracker.goal && now.today - entry.amount < tracker.goal) summary += " Goal reached!";
  if (made) summary += ` New tracker: ${tracker.name}.`;
  return { status: "ok", summary, data: { entry, tracker: now } };
}

async function status(store: Store, body: Record<string, unknown>): Promise<ActionResult> {
  const day = body.day ?? today();
  if (typeof day !== "string" || !DAY.test(day)) throw new InputError("day: a day, YYYY-MM-DD");
  const all = summaries(await store.trackers(), await store.entries(), day);
  if (!all.length) return { status: "ok", summary: "You track nothing yet: add a tracker first." };
  const parts = all.map((t) => `${t.name}: ${amount(t, t.today)}${t.streak > 1 ? ` (${t.streak} days in a row)` : ""}`);
  const behind = all.filter((t) => t.goal && t.today < t.goal);
  return { status: "ok", summary: `${parts.join(". ")}.`.slice(0, 480), data: { day, trackers: all, behind: behind.map((t) => t.id) } };
}

/** The tracker a word names: its id, name or unit, singular or plural ("glass" → Water in glasses). */
export function match(trackers: Tracker[], what: string): Tracker | undefined {
  const words = (s: string) => slug(s).split("-").filter(Boolean).map(single);
  const said = new Set(words(what));
  const id = slug(what);
  return (
    trackers.find((t) => t.id === id) ??
    trackers.find((t) => words(t.name).every((w) => said.has(w))) ??
    trackers.find((t) => t.unit && words(t.unit).every((w) => said.has(w)))
  );
}

function single(word: string): string {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses") || word.endsWith("shes") || word.endsWith("ches")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
