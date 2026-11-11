// What GET /api/state gives (server/store.ts, server/routes.ts).
export type Item = { line: number; text: string; owner?: string; due?: string; done: boolean };

export type Note = {
  name: string;
  title: string;
  at: string;
  text: string;
  done: boolean; // Scribe made its actions file
  actions: Item[];
  decisions: string[];
  questions: string[];
  followup?: string;
};

export type Message = { id: string; at: string; text: string };

export type Ask = {
  runId?: string;
  request: string;
  at: string;
  state: "waiting" | "running" | "succeeded" | "failed" | "cancelled";
  status?: "ok" | "attention" | "failed";
  summary?: string;
  error?: string;
};

export type State = { folder: string; notes: Note[]; messages: Message[]; asks: Ask[] };
