# Origin

**Author:** Paul Bakaus (pbakaus) and Impeccable's contributors
**Source:** https://github.com/pbakaus/impeccable (`.agents/skills/impeccable/`, its build for agents reading `.agents/`)
**Commit:** `9fadc41729c38fd47d7ae622b501558653f9d2e9` (2026-11-02)
**Engine:** 0.1.18, downloaded from the project's releases when the `impeccable` tool's image is
built, and checked against `scripts/engine-checksums.txt`
**License:** Apache-2.0, in LICENSE; third-party notices in NOTICE.md (both upstream's, unchanged)

## What this package changes

- Upstream's `.agents/skills/impeccable/` is this folder, its files unchanged.
- Added: LICENSE and NOTICE.md (upstream's, from its repository's root) and this file.
- Around it, not in it: the `impeccable` tool installs the engine, points the skill at it
  (`IMPECCABLE_BIN`), turns off its update check and live mode's Apply, and lets its browser
  start in Handler's sandbox.

Everything else is Impeccable's work. Report problems with the skill itself upstream.
