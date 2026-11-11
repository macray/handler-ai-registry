# Tracker

Count anything that matters to you: glasses of water, minutes walked, pages read, focus
sessions, interruptions. One tap on **+**, on your computer or your phone. Your **Coach** agent
looks at your numbers when you ask, and on its own if you turn on its check-ins.

Everything is in one folder of yours (`trackers.json`, `log.jsonl`, `messages.jsonl`, as
[`agent/README.md`](agent/README.md) says): the app reads and writes it, the agent works in it,
no copy. `log.jsonl` is plain JSON Lines: open it in any editor or spreadsheet tool.

## Set it up

**Discover → tracker → Install** (or Apps → Get more). Its install page asks:

1. **A folder**, where what you track is kept: a new one (`~/tracker`) or one you already use.
   Handler copies `agent/README.md` into it when it has none.
2. **Its agent**, Coach: set up from [`agent/`](agent/) (you choose its model), or one of yours
   that fits. It reaches nothing but its model.
3. **Who opens it**: tick *you* for your phone.
4. **Its check-ins**, each off until you turn it on, results in your inbox: an evening check-in
   every day at 20:00 (*which goals can you still reach today*), and a weekly review on Sundays at
   18:00.

## What it does

- **Trackers**: tap a suggestion (Water, Coffee, Walk, Reading, Focus, Interruptions) or make your
  own: a name, a unit, a goal a day, what one tap adds. Each shows today against its goal, the
  last 7 days, and your streak. Tap its name to log another amount, change it or stop it.
- **Today**: what you logged, with *Undo*.
- **What you can ask it** (Ask, or its page in Handler, *Try*): *"I drank 2 glasses of water"*,
  *"I ran 5 km"* (a tracker that does not exist yet is made), *"How am I doing today?"*: its code,
  instant. *"How was my week?"*: its Coach.
- **Coach**: ask it anything about your numbers; what it told you shows here and in your inbox.

## Make it yours

It is plain on purpose. On its page in Handler, **Change it** and tell the App creator what you
want, for example:

- *"Add a monthly chart for each tracker."*
- *"Let me track things per week, not per day (3 runs a week)."*
- *"Add a note field when I log, and show the notes in the history."*
- *"Notify me at 18:00 if I have not logged any water."*

Try the draft (**Open the draft**: it works on copies of your data), then **Use it**.

## Change it by hand

```bash
cd server && bun install && cd ../ui && bun install && cd ..   # the tools, once (from npm)
cd server && bun run test          # the backend's tests (handler runs them before each deploy)
cd server && bun run check         # its types
cd ui && bun run build             # the UI handler serves (ui/dist)
cd server && bun run dev           # preview: backend on 127.0.0.1:8787, folder .data/tracker, no agent
cd ui && bun run dev               # preview: UI on 127.0.0.1:5173
```

Raise `version` in `app.toml` before each deploy.
