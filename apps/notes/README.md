# Notes

Paste your notes from a meeting, a call or a brain dump, and get back what you have to do. Your
**Scribe** agent finds the actions (who does what, by when), the decisions, the open questions,
and writes a follow-up you can send. Your open actions, from every note, stay on top until you
tick them.

Everything is in one folder of yours (`notes/`, `actions/`, `messages.jsonl`, as
[`agent/README.md`](agent/README.md) says): the app reads and writes it, the agent works in it,
no copy. Notes and actions are plain markdown. A note you drop in `notes/` from any editor is
read too.

## Set it up

**Discover → notes → Install** (or Apps → Get more). Its install page asks:

1. **A folder**, where your notes are kept: a new one (`~/notes`) or one you already use.
   Handler copies `agent/README.md` into it when it has none.
2. **Its agent**, Scribe: set up from [`agent/`](agent/) (you choose its model), or one of yours
   that fits. It reaches nothing but its model.
3. **Who opens it**: tick *you* for your phone.
4. **What runs by itself**, each off until you turn it on, results in your inbox: notes you
   dropped in the folder turned into actions every 2 hours, and *what's still open for you* on
   weekdays at 9:00.

## What it does

- **Get the actions**: your note is saved and Scribe reads it (a minute or two; you can close the
  app, the result also comes to your inbox). No notes at hand? **Try with sample notes**.
- **Still open**: your actions (*Mine*) or everyone's, late ones first, ticked here.
- **Notes**: each with its actions, decisions, questions and follow-up (**Copy**).
- **What you can ask it** (Ask, or its page in Handler, *Try*): *"Take a note: call with Sam, he
  sends the quote Monday"* and *"What's still open for me?"*: its code, instant. *"What did we
  decide about pricing?"*: its Scribe.

## Make it yours

It is plain on purpose. On its page in Handler, **Change it** and tell the App creator what you
want, for example:

- *"Add my actions to Planner's calendar on their due day."*
- *"My team is Alice, Sam and Priya: show a column per person."*
- *"Write the follow-up in French, as a bulleted email."*
- *"Group my notes by project (a tag in the title)."*

Try the draft (**Open the draft**: it works on copies of your notes), then **Use it**.

## Change it by hand

```bash
cd server && bun install && cd ../ui && bun install && cd ..   # the tools, once (from npm)
cd server && bun run test          # the backend's tests (handler runs them before each deploy)
cd server && bun run check         # its types
cd ui && bun run build             # the UI handler serves (ui/dist)
cd server && bun run dev           # preview: backend on 127.0.0.1:8787, folder .data/notes, no agent
cd ui && bun run dev               # preview: UI on 127.0.0.1:5173
```

Raise `version` in `app.toml` before each deploy.
