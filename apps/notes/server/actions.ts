// Notes' actions, what you can ask it in a sentence (app.toml [actions], contract H.12), done by
// its code: each answers {status, summary, data?}, the summary one or two sentences readable aloud.
//
//   POST /api/actions/note    {text, title?}   a note saved, and the agent started on it
//   POST /api/actions/open    {who?, day?}     the actions still open: yours, or everyone's
//
// "What did we decide about…?" is done by the agent (app.toml), not here.
import { DAY, InputError, type Item, type Note, type Store } from "./store.ts";

export type ActionResult = { status: "ok" | "attention" | "failed"; summary: string; data?: unknown };

/** Starts the agent on the notes not done yet: an error's message when it could not. */
export type Start = () => Promise<string | null>;

export async function act(store: Store, name: string, body: Record<string, unknown>, start: Start): Promise<ActionResult | null> {
  if (name === "note") return await note(store, body, start);
  if (name === "open") return await open(store, body);
  return null;
}

async function note(store: Store, body: Record<string, unknown>, start: Start): Promise<ActionResult> {
  const name = await store.add(body);
  const title = (await store.notes()).find((n) => n.name === name)?.title ?? name;
  const failed = await start();
  if (failed) return { status: "attention", summary: `Saved “${title}”, but your agent could not start: ${failed}`, data: { name } };
  return { status: "ok", summary: `Saved “${title}”. Its actions come in a minute or two, here and in your inbox.`, data: { name } };
}

async function open(store: Store, body: Record<string, unknown>): Promise<ActionResult> {
  const who = body.who ?? "me";
  if (who !== "me" && who !== "everyone") throw new InputError('who: "me" or "everyone"');
  const day = body.day ?? today();
  if (typeof day !== "string" || !DAY.test(day)) throw new InputError("day: a day, YYYY-MM-DD");
  const items = openActions(await store.notes()).filter((a) => who === "everyone" || a.owner === "me");
  const late = items.filter((a) => a.due && a.due < day);
  const due = items.filter((a) => a.due === day);
  if (!items.length) return { status: "ok", summary: who === "me" ? "Nothing open for you." : "Nothing open." };
  const named = (list: typeof items) =>
    list
      .slice(0, 5)
      .map((a) => (who === "everyone" && a.owner ? `${a.text} (${a.owner})` : a.text))
      .join("; ");
  let summary = `${items.length} open${who === "me" ? " for you" : ""}.`;
  if (late.length) summary += ` Late: ${named(late)}.`;
  if (due.length) summary += ` Due today: ${named(due)}.`;
  if (!late.length && !due.length) summary += ` ${named(items)}.`;
  return { status: late.length ? "attention" : "ok", summary: cut(summary), data: { items, late, due } };
}

/** Every action not done, with its note: the late first, then by day, then the rest. */
export function openActions(notes: Note[]): (Item & { note: string; title: string })[] {
  return notes
    .flatMap((n) => n.actions.filter((a) => !a.done).map((a) => ({ ...a, note: n.name, title: n.title })))
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

function cut(text: string): string {
  return text.length <= 480 ? text : `${text.slice(0, 479)}…`;
}

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
