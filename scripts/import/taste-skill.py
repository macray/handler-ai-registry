"""Build tools/taste/skills/design-taste-frontend/ from a clone of Leonxlnx's taste-skill
(https://github.com/Leonxlnx/taste-skill, MIT).

    python3 scripts/import/taste-skill.py /path/to/taste-skill

The skill is copied unchanged (upstream's skills/taste-skill/, in a folder named as its SKILL.md
says, as Agent Skills require), with upstream's LICENSE and ORIGIN.md (who wrote it, from which
commit, what changed).
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

UPSTREAM = "https://github.com/Leonxlnx/taste-skill"
TOOL = Path(__file__).resolve().parents[2] / "tools/taste"
MAX_FILES = 500  # Handler's limit for one skill (control-plane skills.py), SKILL.md aside


def main(upstream: Path) -> None:
    upstream = upstream.resolve()
    commit, date = subprocess.run(
        ["git", "-C", upstream, "log", "-1", "--format=%H %cs"],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    source = upstream / "skills/taste-skill"
    found = re.search(r"^name:\s*(\S+)\s*$", (source / "SKILL.md").read_text(), re.M)
    if found is None:
        sys.exit("skills/taste-skill/SKILL.md: no name in its frontmatter")
    name = found.group(1)

    for old in (TOOL / "skills").glob("*"):
        shutil.rmtree(old)
    target = TOOL / "skills" / name
    shutil.copytree(source, target, ignore=shutil.ignore_patterns(".*"))
    shutil.copy2(upstream / "LICENSE", target / "LICENSE")
    (target / "ORIGIN.md").write_text(ORIGIN.format(
        upstream=UPSTREAM, commit=commit, date=date, name=name,
    ))

    files = [p for p in target.rglob("*") if p.is_file() and p != target / "SKILL.md"]
    if len(files) > MAX_FILES:
        sys.exit(f"{len(files)} files: more than the {MAX_FILES} Handler allows in one skill")
    print(f"{name} from {commit[:7]} ({date}), {len(files)} files (max {MAX_FILES})")


ORIGIN = """\
# Origin

**Author:** Leonxlnx
**Source:** {upstream}
**Commit:** `{commit}` ({date})
**License:** MIT, in LICENSE (upstream's, unchanged)

## What this package changes

- Upstream's `skills/taste-skill/` is this folder, its files unchanged. The folder is named
  `{name}`, the name its SKILL.md gives it.
- Added: LICENSE (upstream's, from its repository's root) and this file.

Everything else is Leonxlnx's work. Report problems with the skill itself upstream.
"""

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
