# The Notes' folder

How the Scribe agent and the Notes app share this folder (Handler copies this file here when you
give the app the folder). Both read and write these files; neither keeps a copy. They are yours
too: write a note in any editor and drop it in `notes/`, read the actions in any markdown viewer.

## `notes/<name>.md`: your notes

Markdown or plain text, as you wrote them. The app names a note it saves after its date, time
and title (`notes/2026-10-24-1030-weekly-sync.md`, the title as its first line, `# Weekly sync`);
a note you drop here may have any name ending in `.md`. Its title is its first line. Nobody but
you changes a note.

## `actions/<name>.md`: what Scribe made of the note of the same name

Written once by the agent, for each note that has none yet (a note without one is "not done
yet"); the app then only ticks the boxes. Sections, each optional, in this order:

```markdown
# Weekly sync

## Actions
- [ ] Send the Q3 report to Sam @me due:2026-10-27
- [ ] Fix the login bug @Alice
- [ ] Book a room for the demo

## Decisions
- We ship on Friday 30 October

## Questions
- Who owns the billing page?

## Follow-up
Hi all, thanks for today. We ship on Friday 30 October. Alice fixes the login bug,
I send the Q3 report to Sam by Tuesday. Open: who owns the billing page?
```

- An action: `- [ ] ` (`- [x] ` once done), what to do, then maybe its owner (`@me` is you,
  `@Name` someone else, one word) and its day (`due:YYYY-MM-DD`). One line each.
- Decisions and questions: `- ` and one line each. The follow-up: plain text, to the end of the
  file.
- The app changes nothing but an action's box (`[ ]` ↔ `[x]`), in place. To write the file:
  write it whole to a temporary file in `actions/` (`.<name>.md.tmp`), then rename it.

## `messages.jsonl`: what Scribe told you

One JSON object per line, appended by the agent, never rewritten:

```json
{"id": "m_9c0d1e2f", "at": "2026-10-24T09:00:00Z", "text": "Late: the Q3 report to Sam (due Tuesday)."}
```

- `id`: `m_` and 8 hex digits. `text`: what it said, as you would say it (the app shows it).
- Append a line **before** giving the run's result, for every message: this file is the agent's
  memory of what it already told you.
