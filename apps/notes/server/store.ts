// The Notes' data, in the folder you gave it (shared with the agent, read-write on both sides):
//   notes/<name>.md       your notes: written by the app, or dropped here from any editor
//   actions/<name>.md     what the agent made of the note of that name: actions, decisions,
//                         questions, a follow-up (a note without one is not done yet)
//   messages.jsonl        one Message per line: appended by the agent (what it told you)
// The format is written down for the agent in agent/README.md. Both sides may write at once: read
// again just before changing, write whole files to a temporary file then rename it.
//
// actions/<name>.md:
//
//   # Weekly sync
//
//   ## Actions
//   - [ ] Send the Q3 report @me due:2026-10-28
//   - [x] Fix the login bug @Alice
//
//   ## Decisions
//   - We ship on Friday
//
//   ## Questions
//   - Who owns the billing page?
//
//   ## Follow-up
//   Hi all, …
//
// An action is `- [ ]` (`- [x]` once done), its text, then maybe its owner (`@me` is you) and its
// day (`due:YYYY-MM-DD`). The app only ever changes an action's box: the rest is the agent's.

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";

export type Item = {
  line: number; // its line in the actions file (0-based): what ticking it names
  text: string; // without its owner and day
  owner?: string; // "me", "Alice"
  due?: string; // YYYY-MM-DD
  done: boolean;
};

export type Note = {
  name: string; // its file's name, without ".md"
  title: string;
  at: string; // ISO 8601: from its name (2026-10-24-1030-…), else the file's time
  text: string;
  done: boolean; // the agent made its actions file
  actions: Item[];
  decisions: string[];
  questions: string[];
  followup?: string;
};

export type Message = { id: string; at: string; text: string };

export class InputError extends Error {}

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NOTE = 50_000;

export class Store {
  #queue: Promise<unknown> = Promise.resolve();

  constructor(readonly folder: string) {}

  // ── reading ──────────────────────────────────────────────────────────

  /** Every note, newest first, with what the agent made of it. */
  async notes(): Promise<Note[]> {
    const out: Note[] = [];
    for (const name of await this.names()) {
      const path = `${this.folder}/notes/${name}.md`;
      const [text, info] = await Promise.all([readFile(path, "utf8").catch(() => null), stat(path).catch(() => null)]);
      if (text === null || !info) continue; // gone meanwhile
      const made = await readFile(`${this.folder}/actions/${name}.md`, "utf8").catch((e) => (missing(e) ? null : Promise.reject(e)));
      out.push({ name, title: titleOf(text, name), at: atOf(name) ?? info.mtime.toISOString(), text, done: made !== null, ...parse(made ?? "") });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** The notes' names (their files in notes/, without ".md"). */
  async names(): Promise<string[]> {
    try {
      return (await readdir(`${this.folder}/notes`)).filter((f) => f.endsWith(".md") && !f.startsWith(".")).map((f) => f.slice(0, -3));
    } catch (e) {
      if (missing(e)) return [];
      throw e;
    }
  }

  /** What the agent told you, newest first. */
  async messages(limit = 20): Promise<Message[]> {
    let text: string;
    try {
      text = await readFile(`${this.folder}/messages.jsonl`, "utf8");
    } catch (e) {
      if (missing(e)) return [];
      throw e;
    }
    const out: Message[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const m = JSON.parse(line);
        if (typeof m?.id === "string" && typeof m?.text === "string") out.push(m);
      } catch {
        // a line being written, or broken by hand: skipped
      }
    }
    return out.reverse().slice(0, limit);
  }

  // ── changing ─────────────────────────────────────────────────────────

  /** A new note, notes/<YYYY-MM-DD-HHMM>-<its title>.md, its title as its first line. */
  add(input: { text?: unknown; title?: unknown }, now = new Date()): Promise<string> {
    return this.serial(async () => {
      const body = typeof input.text === "string" ? input.text.trim() : "";
      if (!body) throw new InputError("text: what are your notes?");
      if (body.length > MAX_NOTE) throw new InputError(`text: ${MAX_NOTE} characters at most`);
      let title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
      if (title.length > 100) throw new InputError("title: 100 characters at most");
      if (!title) title = titleOf(body, "Note").slice(0, 60);
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const names = new Set(await this.names());
      const base = `${stamp}-${slug(title) || "note"}`;
      let name = base;
      for (let n = 2; names.has(name); n++) name = `${base}-${n}`;
      const text = /^#\s/.test(body) ? `${body}\n` : `# ${title}\n\n${body}\n`;
      await mkdir(`${this.folder}/notes`, { recursive: true });
      await this.writeWhole(`notes/${name}.md`, text);
      return name;
    });
  }

  /** The note and what the agent made of it. */
  remove(name: string): Promise<void> {
    return this.serial(async () => {
      await this.check(name);
      await rm(`${this.folder}/notes/${name}.md`, { force: true });
      await rm(`${this.folder}/actions/${name}.md`, { force: true });
    });
  }

  /** An action ticked (or not): its box only, in actions/<name>.md, the line read again first. */
  tick(name: string, line: unknown, done: boolean): Promise<Item> {
    return this.serial(async () => {
      await this.check(name);
      const file = `actions/${name}.md`;
      const text = await readFile(`${this.folder}/${file}`, "utf8").catch((e) => (missing(e) ? "" : Promise.reject(e)));
      const lines = text.split("\n");
      const item = parse(text).actions.find((a) => a.line === line);
      if (!item) throw new InputError(`no action at line ${line} of ${name}`);
      lines[item.line] = lines[item.line].replace(/\[( |x|X)\]/, done ? "[x]" : "[ ]");
      await this.writeWhole(file, lines.join("\n"));
      return { ...item, done };
    });
  }

  /** A name of a note that is there: anything else is refused (it names a file). */
  async check(name: string): Promise<void> {
    if (!(await this.names()).includes(name)) throw new InputError(`no note ${name}`);
  }

  async writeWhole(file: string, content: string): Promise<void> {
    const at = `${this.folder}/${file}`;
    const tmp = `${at.slice(0, at.lastIndexOf("/"))}/.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, content);
    await rename(tmp, at);
  }

  serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(work, work);
    this.#queue = next.catch(() => {});
    return next;
  }

  async exists(): Promise<boolean> {
    try {
      await stat(this.folder);
      return true;
    } catch (e) {
      if (missing(e)) return false;
      throw e;
    }
  }
}

// ── actions/<name>.md ───────────────────────────────────────────────────

/** What an actions file holds; its sections by their heading, in any order, any case. */
export function parse(text: string): Pick<Note, "actions" | "decisions" | "questions" | "followup"> {
  const out: Pick<Note, "actions" | "decisions" | "questions" | "followup"> = { actions: [], decisions: [], questions: [] };
  let section = "";
  const followup: string[] = [];
  for (const [i, line] of text.split("\n").entries()) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      section = heading[1].trim().toLowerCase();
      continue;
    }
    if (section.startsWith("follow")) {
      followup.push(line);
      continue;
    }
    const item = /^\s*[-*]\s+(?:\[( |x|X)\]\s+)?(.*\S)\s*$/.exec(line);
    if (!item) continue;
    if (section.startsWith("action") && item[1] !== undefined) out.actions.push(action(item[2], i, item[1].toLowerCase() === "x"));
    else if (section.startsWith("decision")) out.decisions.push(item[2]);
    else if (section.startsWith("question")) out.questions.push(item[2]);
  }
  const rest = followup.join("\n").trim();
  if (rest) out.followup = rest;
  return out;
}

function action(raw: string, line: number, done: boolean): Item {
  let text = raw;
  const item: Item = { line, text, done };
  const due = /\s+due:(\d{4}-\d{2}-\d{2})\b/.exec(text);
  if (due) {
    item.due = due[1];
    text = text.replace(due[0], "");
  }
  const owner = /\s+@([^\s@]+)/.exec(text);
  if (owner) {
    item.owner = owner[1].toLowerCase() === "me" ? "me" : owner[1];
    text = text.replace(owner[0], "");
  }
  item.text = text.trim();
  return item;
}

/** A note's title: its first heading, else its first line, else its name. */
export function titleOf(text: string, name: string): string {
  const first = text.split("\n").find((l) => l.trim());
  return first ? first.replace(/^#+\s*/, "").trim().slice(0, 100) || name : name;
}

/** "2026-10-24-1030-weekly-sync" → that time (local), or nothing. */
function atOf(name: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/.exec(name);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function slug(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** A file or folder that is not there (ENOENT). */
export function missing(e: unknown): boolean {
  return (e as { code?: string }).code === "ENOENT";
}
