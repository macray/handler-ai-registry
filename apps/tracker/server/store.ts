// The Tracker's data, in the folder you gave it (shared with the Coach agent, read-write on both sides):
//   trackers.json        what you track: {"trackers": [Tracker, …]}
//   log.jsonl            one Entry per line: what you logged (appended; an undo rewrites it)
//   messages.jsonl       one Message per line: appended by the agent (what it told you)
// The format is written down for the agent in agent/README.md. Both sides may write at once: read
// again just before changing, write whole files to a temporary file then rename it; append-only
// lines are one short write each.

import { appendFile, readFile, rename, stat, writeFile } from "node:fs/promises";

export type Tracker = {
  id: string; // from its name: "water", "run-km"
  name: string; // "Water"
  unit?: string; // "glasses"
  goal?: number; // a day's goal, in its unit
  step: number; // what one tap adds (default 1)
};

export type Entry = {
  id: string; // "e_" + 8 hex
  at: string; // ISO 8601, when it was logged
  day: string; // YYYY-MM-DD, the (local) day it counts for
  tracker: string; // a tracker's id
  amount: number;
  note?: string;
};

export type Message = { id: string; at: string; text: string };

export type TrackerInput = { name?: unknown; unit?: unknown; goal?: unknown; step?: unknown };
export type EntryInput = { tracker?: unknown; amount?: unknown; day?: unknown; note?: unknown };

export class InputError extends Error {}

export const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX = 1_000_000;

export class Store {
  #queue: Promise<unknown> = Promise.resolve();

  constructor(readonly folder: string) {}

  // ── reading ──────────────────────────────────────────────────────────

  async trackers(): Promise<Tracker[]> {
    const text = await this.read("trackers.json");
    if (text === null || !text.trim()) return [];
    const list = JSON.parse(text)?.trackers;
    return (Array.isArray(list) ? list : [])
      .filter((t) => t && typeof t.id === "string" && typeof t.name === "string")
      .map((t) => ({ ...t, step: typeof t.step === "number" && t.step > 0 ? t.step : 1 }));
  }

  async entries(): Promise<Entry[]> {
    return (await this.lines<Entry>("log.jsonl")).filter(
      (e) => typeof e.id === "string" && typeof e.tracker === "string" && typeof e.amount === "number" && DAY.test(e.day),
    );
  }

  /** What the agent told you, newest first. */
  async messages(limit = 20): Promise<Message[]> {
    const all = (await this.lines<Message>("messages.jsonl")).filter((m) => typeof m.id === "string" && typeof m.text === "string");
    return all.reverse().slice(0, limit);
  }

  async lines<T>(file: string): Promise<T[]> {
    const text = await this.read(file);
    const out: T[] = [];
    for (const line of (text ?? "").split("\n")) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // a line being written, or broken by hand: skipped
      }
    }
    return out;
  }

  async read(file: string): Promise<string | null> {
    try {
      return await readFile(`${this.folder}/${file}`, "utf8");
    } catch (e) {
      if (missing(e)) return null;
      throw e;
    }
  }

  // ── changing ─────────────────────────────────────────────────────────

  addTracker(input: TrackerInput): Promise<Tracker> {
    return this.serial(async () => {
      const trackers = await this.trackers();
      const fields = checkedTracker(input);
      const base = slug(fields.name);
      let id = base;
      for (let n = 2; trackers.some((t) => t.id === id); n++) id = `${base}-${n}`;
      const tracker: Tracker = { id, ...fields };
      trackers.push(tracker);
      await this.writeTrackers(trackers);
      return tracker;
    });
  }

  updateTracker(id: string, input: TrackerInput): Promise<Tracker> {
    return this.serial(async () => {
      const trackers = await this.trackers();
      const tracker = find(trackers, id);
      const { name, unit, goal, step } = tracker;
      const fields = checkedTracker({ name, unit, goal, step, ...input }); // what is not sent stays
      delete tracker.unit;
      delete tracker.goal;
      Object.assign(tracker, fields);
      await this.writeTrackers(trackers);
      return tracker;
    });
  }

  /** The tracker goes; what was logged for it stays in log.jsonl. */
  removeTracker(id: string): Promise<Tracker> {
    return this.serial(async () => {
      const trackers = await this.trackers();
      const tracker = find(trackers, id);
      trackers.splice(trackers.indexOf(tracker), 1);
      await this.writeTrackers(trackers);
      return tracker;
    });
  }

  log(input: EntryInput, today: string): Promise<Entry> {
    return this.serial(async () => {
      const tracker = find(await this.trackers(), typeof input.tracker === "string" ? input.tracker : "");
      const amount = input.amount === undefined || input.amount === null ? tracker.step : input.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > MAX) {
        throw new InputError("amount: a number above 0");
      }
      const day = text(input.day) ?? today;
      if (!DAY.test(day)) throw new InputError("day: a day, YYYY-MM-DD");
      const note = text(input.note);
      if (note && note.length > 200) throw new InputError("note: 200 characters at most");
      const entry: Entry = { id: newId("e_"), at: new Date().toISOString(), day, tracker: tracker.id, amount: round(amount) };
      if (note) entry.note = note;
      await appendFile(`${this.folder}/log.jsonl`, JSON.stringify(entry) + "\n");
      return entry;
    });
  }

  /** An undo: log.jsonl written again without that entry. */
  unlog(id: string): Promise<Entry> {
    return this.serial(async () => {
      const text = (await this.read("log.jsonl")) ?? "";
      let found: Entry | undefined;
      const kept = text.split("\n").filter((line) => {
        if (!line.trim()) return false;
        try {
          const e = JSON.parse(line);
          if (e?.id === id && !found) {
            found = e;
            return false;
          }
        } catch {
          // kept as it is
        }
        return true;
      });
      if (!found) throw new InputError(`no entry ${id}`);
      await this.writeWhole("log.jsonl", kept.map((l) => l + "\n").join(""));
      return found;
    });
  }

  async writeTrackers(trackers: Tracker[]): Promise<void> {
    await this.writeWhole("trackers.json", JSON.stringify({ trackers }, null, 2) + "\n");
  }

  async writeWhole(file: string, content: string): Promise<void> {
    const tmp = `${this.folder}/.${file}.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, content);
    await rename(tmp, `${this.folder}/${file}`);
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

type Fields = Omit<Tracker, "id">;

/** A tracker's fields, checked: a name, then optional ones (left out when empty). */
export function checkedTracker(input: TrackerInput): Fields {
  const name = text(input.name)?.replace(/\s+/g, " ");
  if (!name) throw new InputError("name: what do you track?");
  if (name.length > 40) throw new InputError("name: 40 characters at most");
  if (!slug(name)) throw new InputError("name: at least one letter or digit");
  const out: Fields = { name, step: 1 };
  const unit = text(input.unit);
  if (unit && unit.length > 20) throw new InputError("unit: 20 characters at most");
  if (unit) out.unit = unit;
  const goal = number(input.goal, "goal");
  if (goal !== undefined) out.goal = goal;
  out.step = number(input.step, "step") ?? 1;
  return out;
}

function number(v: unknown, what: string): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > MAX) throw new InputError(`${what}: a number above 0`);
  return round(n);
}

function text(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** "Run (km)" → "run-km": a tracker's id. */
export function slug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function newId(prefix: string): string {
  return prefix + [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function find(trackers: Tracker[], id: string): Tracker {
  const tracker = trackers.find((t) => t.id === id);
  if (!tracker) throw new InputError(`no tracker ${id || "given"}`);
  return tracker;
}

/** A file or folder that is not there (ENOENT). */
export function missing(e: unknown): boolean {
  return (e as { code?: string }).code === "ENOENT";
}
