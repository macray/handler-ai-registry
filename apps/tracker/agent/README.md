# The Tracker's folder

How the Coach agent and the Tracker app share this folder (Handler copies this file here when you
give the app the folder). Both read and write these files; neither keeps a copy. They are yours
too: open them in any editor, or `log.jsonl` in a spreadsheet tool.

## `trackers.json`: what you track

```json
{
  "trackers": [
    { "id": "water", "name": "Water", "unit": "glasses", "goal": 8, "step": 1 },
    { "id": "run", "name": "Run", "unit": "km", "step": 5 }
  ]
}
```

- `id`: made from the name (lowercase letters, digits and `-`), unique; what `log.jsonl` names.
- `name` (40 characters at most); `unit` (optional); `goal`: a day's goal, in its unit (optional);
  `step`: what one tap adds in the app (1 when absent).
- To change it: read it again just before, write the whole file to a temporary file in this
  folder (`.trackers.json.tmp`), then rename it to `trackers.json`. The app may change it at any
  time.

## `log.jsonl`: what you logged

One JSON object per line, appended (an undo in the app rewrites the file without that line):

```json
{"id": "e_1a2b3c4d", "at": "2026-10-24T07:30:00Z", "day": "2026-10-24", "tracker": "water", "amount": 2}
{"id": "e_5e6f7a8b", "at": "2026-10-24T18:02:00Z", "day": "2026-10-24", "tracker": "run", "amount": 5, "note": "by the river"}
```

- `id`: `e_` and 8 hex digits. `at`: when it was logged (UTC). `day`: the local day it counts for
  (`YYYY-MM-DD`; may be earlier than `at`'s, for "yesterday"). `tracker`: a tracker's `id`.
  `amount`: a number above 0, in the tracker's unit. `note`: optional, 200 characters at most.
- A day's total is the sum of its amounts. Lines of a tracker that is no longer in
  `trackers.json` stay: it was removed, not its history.
- To log something, append one line.

## `messages.jsonl`: what the Coach told you

One JSON object per line, appended by the agent, never rewritten:

```json
{"id": "m_9c0d1e2f", "at": "2026-10-24T20:00:00Z", "text": "5 of 8 glasses so far: three more before bed and you are there."}
```

- `id`: `m_` and 8 hex digits. `text`: what it said, as you would say it (the app shows it).
- Append a line **before** giving the run's result, for every message: this file is the agent's
  memory of what it already told you.
