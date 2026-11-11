"""Build tools/impeccable/skills/impeccable/ from a clone of pbakaus's Impeccable
(https://github.com/pbakaus/impeccable, Apache-2.0).

    python3 scripts/import/impeccable.py /path/to/impeccable

Copies upstream's cross-agent build of the skill (`.agents/skills/impeccable/`) unchanged, with
upstream's LICENSE and NOTICE.md (Apache-2.0 4(d): the NOTICE goes with every copy) and ORIGIN.md
(who wrote it, from which commit, what changed). The tool's Containerfile downloads the engine
the skill pins (scripts/VERSION) and checks it against scripts/engine-checksums.txt, so a new
upstream engine comes with the next run of this script.
"""

import shutil
import subprocess
import sys
from pathlib import Path

UPSTREAM = "https://github.com/pbakaus/impeccable"
TARGET = Path(__file__).resolve().parents[2] / "tools/impeccable/skills/impeccable"
MAX_FILES = 500  # Handler's limit for one skill (control-plane skills.py), SKILL.md aside
MAX_FILE_BYTES = 5 * 1024 * 1024  # and for one of its files


def main(upstream: Path) -> None:
    upstream = upstream.resolve()
    commit, date = subprocess.run(
        ["git", "-C", upstream, "log", "-1", "--format=%H %cs"],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    source = upstream / ".agents/skills/impeccable"
    engine = (source / "scripts/VERSION").read_text().strip()

    shutil.rmtree(TARGET, ignore_errors=True)
    shutil.copytree(source, TARGET, ignore=shutil.ignore_patterns(".*"))
    shutil.copy2(upstream / "LICENSE", TARGET / "LICENSE")
    shutil.copy2(upstream / "NOTICE.md", TARGET / "NOTICE.md")
    (TARGET / "ORIGIN.md").write_text(ORIGIN.format(
        upstream=UPSTREAM, commit=commit, date=date, engine=engine,
    ))

    files = [p for p in TARGET.rglob("*") if p.is_file() and p != TARGET / "SKILL.md"]
    if len(files) > MAX_FILES:
        sys.exit(f"{len(files)} files: more than the {MAX_FILES} Handler allows in one skill")
    if big := [p.relative_to(TARGET) for p in files if p.stat().st_size > MAX_FILE_BYTES]:
        sys.exit(f"larger than {MAX_FILE_BYTES} bytes, more than Handler allows: {big}")
    print(f"impeccable from {commit[:7]} ({date}), engine {engine}, {len(files)} files")


ORIGIN = """\
# Origin

**Author:** Paul Bakaus (pbakaus) and Impeccable's contributors
**Source:** {upstream} (`.agents/skills/impeccable/`, its build for agents reading `.agents/`)
**Commit:** `{commit}` ({date})
**Engine:** {engine}, downloaded from the project's releases when the `impeccable` tool's image is
built, and checked against `scripts/engine-checksums.txt`
**License:** Apache-2.0, in LICENSE; third-party notices in NOTICE.md (both upstream's, unchanged)

## What this package changes

- Upstream's `.agents/skills/impeccable/` is this folder, its files unchanged.
- Added: LICENSE and NOTICE.md (upstream's, from its repository's root) and this file.
- Around it, not in it: the `impeccable` tool installs the engine, points the skill at it
  (`IMPECCABLE_BIN`), turns off its update check and live mode's Apply, and lets its browser
  start in Handler's sandbox.

Everything else is Impeccable's work. Report problems with the skill itself upstream.
"""

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
