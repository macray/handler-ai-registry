"""Build agents/ponytail/'s upstream parts from a clone of DietrichGebert's Ponytail
(https://github.com/DietrichGebert/ponytail, MIT).

    python3 scripts/import/ponytail.py /path/to/ponytail

Writes the Ponytail agent's instructions.md (a credit line, then upstream's AGENTS.md, its
ruleset) and copies its skills unchanged, each with upstream's LICENSE and ORIGIN.md (who wrote
it, from which commit, what changed): ponytail-review, ponytail-audit and ponytail-debt to the
Ponytail agent, ponytail-audit to the Ponytail audit job. Its agent.toml, the job's and the
READMEs are written by hand. Bump `version` in agents/ponytail/agents.toml after.
"""

import shutil
import subprocess
import sys
from pathlib import Path

UPSTREAM = "https://github.com/DietrichGebert/ponytail"
FILE = Path(__file__).resolve().parents[2] / "agents/ponytail/agents"
AGENTS = {
    "ponytail": ["ponytail-audit", "ponytail-debt", "ponytail-review"],
    "ponytail-audit": ["ponytail-audit"],
}
# AGENTS.md's last line speaks to agents working on the ponytail repository itself
REPO_NOTE = "(Yes, this file also applies to agents working on the ponytail repo itself."


def main(upstream: Path) -> None:
    upstream = upstream.resolve()
    commit, date = subprocess.run(
        ["git", "-C", upstream, "log", "-1", "--format=%H %cs"],
        check=True, capture_output=True, text=True,
    ).stdout.split()

    for part, names in AGENTS.items():
        for old in (FILE / part / "skills").glob("*"):
            shutil.rmtree(old)
        for name in names:
            target = FILE / part / "skills" / name
            shutil.copytree(upstream / "skills" / name, target, ignore=shutil.ignore_patterns(".*"))
            shutil.copy2(upstream / "LICENSE", target / "LICENSE")
            (target / "ORIGIN.md").write_text(SKILL_ORIGIN.format(
                upstream=UPSTREAM, commit=commit, date=date, name=name,
            ))

    rules = (upstream / "AGENTS.md").read_text().rstrip().splitlines()
    if not rules[-1].startswith(REPO_NOTE):
        sys.exit("AGENTS.md no longer ends with its note on the ponytail repo: check what changed")
    (FILE / "ponytail/instructions.md").write_text(INSTRUCTIONS.format(
        upstream=UPSTREAM, short=commit[:7], rules="\n".join(rules[:-1]).rstrip(),
    ))
    print(f"ponytail from {commit[:7]} ({date}): " + "; ".join(
        f"{part}: {', '.join(names)}" for part, names in AGENTS.items()
    ))


INSTRUCTIONS = """\
These rules are Ponytail by DietrichGebert ({upstream}, MIT, commit {short}): its AGENTS.md,
without its last line, about working on the ponytail repository itself.

{rules}

## Reviews and reports

For a review of a change, follow the `ponytail-review` skill; for the whole repository,
`ponytail-audit`; for the list of `shortcut:` comments, `ponytail-debt`.
"""

SKILL_ORIGIN = """\
# Origin

**Author:** DietrichGebert
**Source:** {upstream} (`skills/{name}/`)
**Commit:** `{commit}` ({date})
**License:** MIT, in LICENSE (upstream's, unchanged)

## What this package changes

- Upstream's `skills/{name}/` is this folder, its files unchanged.
- Added: LICENSE (upstream's, from its repository's root) and this file.

Everything else is DietrichGebert's work. Report problems with the skill itself upstream.
"""

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
