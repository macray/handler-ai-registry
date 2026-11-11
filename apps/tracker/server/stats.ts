// What the screen and the actions say about each tracker, from log.jsonl: done by code, no model.
import type { Entry, Tracker } from "./store.ts";

export type Summary = Tracker & {
  today: number; // logged today
  week: { day: string; total: number }[]; // the last 7 days, today last
  streak: number; // days in a row at the goal (or with something logged, without a goal)
};

export function summaries(trackers: Tracker[], entries: Entry[], today: string): Summary[] {
  return trackers.map((t) => {
    const totals = new Map<string, number>();
    for (const e of entries) if (e.tracker === t.id) totals.set(e.day, (totals.get(e.day) ?? 0) + e.amount);
    const total = (day: string) => round(totals.get(day) ?? 0);
    const met = (day: string) => (t.goal ? total(day) >= t.goal : total(day) > 0);
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => ({ day, total: total(day) }));
    // today counts once met; until then the streak is the one up to yesterday
    let streak = 0;
    for (let day = met(today) ? today : addDays(today, -1); met(day); day = addDays(day, -1)) streak++;
    return { ...t, today: total(today), week, streak };
  });
}

/** "5 of 8 glasses", "3 km", "2". */
export function amount(t: Tracker, n: number): string {
  const unit = t.unit ? ` ${t.unit}` : "";
  return t.goal ? `${n} of ${t.goal}${unit}` : `${n}${unit}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The day on this computer's clock: YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
