// What GET /api/state gives (server/stats.ts, server/routes.ts).
export type Tracker = {
  id: string;
  name: string;
  unit?: string;
  goal?: number;
  step: number;
  today: number;
  week: { day: string; total: number }[]; // the last 7 days, today last
  streak: number;
};

export type Entry = { id: string; at: string; day: string; tracker: string; amount: number; note?: string };

export type Message = { id: string; at: string; text: string };

export type Ask = {
  runId: string;
  request: string;
  at: string;
  state: "waiting" | "running" | "succeeded" | "failed" | "cancelled";
  status?: "ok" | "attention" | "failed";
  summary?: string;
  error?: string;
};

export type State = { folder: string; today: string; trackers: Tracker[]; entries: Entry[]; messages: Message[]; asks: Ask[] };
