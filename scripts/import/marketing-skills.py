# /// script
# requires-python = ">=3.11"
# dependencies = ["pyyaml"]
# ///
"""Build agents/marketer/agents/marketer/skills/marketing-skills/ from a clone of Corey Haines'
Marketing Skills (https://github.com/coreyhaines31/marketingskills, MIT).

    uv run scripts/import/marketing-skills.py /path/to/marketingskills

The skills are copied unchanged, without their evals/. The package mirrors upstream's layout
(skills/<name>/, tools/…) so their relative links keep working; of tools/ it takes only the
files the skills link to. It adds an index (SKILL.md), upstream's LICENSE and ORIGIN.md (who
wrote it, from which commit, what changed). Bump `version` in agents/marketer/agents.toml after.
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

UPSTREAM = "https://github.com/coreyhaines31/marketingskills"
NAME = "marketing-skills"
MAX_FILES = 500  # Handler's limit for one skill (control-plane skills.py), SKILL.md aside
TARGET = Path(__file__).resolve().parents[2] / "agents/marketer/agents/marketer/skills" / NAME
LINK = re.compile(r"\]\(([^)\s#]+)(?:#[^)]*)?\)")


def frontmatter(path: Path) -> dict:
    return yaml.safe_load(path.read_text().split("---", 2)[1])


def summary(description: str) -> str:
    """The first sentence of an upstream description, word for word."""
    first = re.split(r"(?<=\.)\s", description.strip(), maxsplit=1)[0]
    return first.replace("|", "\\|")


def linked_outside(skills: Path, root: Path) -> set[Path]:
    """Files outside skills/ that the skills link to with a relative path."""
    found = set()
    for md in skills.rglob("*.md"):
        for target in LINK.findall(md.read_text()):
            if re.match(r"^[a-z]+:", target):
                continue
            path = (md.parent / target).resolve()
            if path.is_relative_to(root) and not path.is_relative_to(skills):
                found.add(path)
    return found


def main(upstream: Path) -> None:
    upstream = upstream.resolve()
    commit = subprocess.run(
        ["git", "-C", upstream, "log", "-1", "--format=%H %cs"],
        check=True, capture_output=True, text=True,
    ).stdout.split()
    names = sorted(p.parent.name for p in (upstream / "skills").glob("*/SKILL.md"))

    shutil.rmtree(TARGET, ignore_errors=True)
    TARGET.mkdir(parents=True)
    ignore = shutil.ignore_patterns("evals", ".*")
    for name in names:
        shutil.copytree(upstream / "skills" / name, TARGET / "skills" / name, ignore=ignore)

    missing = []
    for path in sorted(linked_outside(TARGET / "skills", TARGET)):
        source = upstream / path.relative_to(TARGET)
        if source.is_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, path)
        else:
            missing.append(path.relative_to(TARGET))
    shutil.copy2(upstream / "LICENSE", TARGET / "LICENSE")

    rows = []
    for name in names:
        meta = frontmatter(TARGET / "skills" / name / "SKILL.md")
        if meta.get("name") != name:
            sys.exit(f"skills/{name}/SKILL.md: its name is {meta.get('name')!r}")
        rows.append(f"| `{name}` | {summary(meta['description'])} |")
    (TARGET / "SKILL.md").write_text(INDEX.format(
        upstream=UPSTREAM, commit=commit[0], short=commit[0][:7], count=len(names),
        rows="\n".join(rows),
    ))
    (TARGET / "ORIGIN.md").write_text(ORIGIN.format(
        upstream=UPSTREAM, commit=commit[0], date=commit[1], count=len(names),
    ))

    files = [p for p in TARGET.rglob("*") if p.is_file() and p != TARGET / "SKILL.md"]
    description = frontmatter(TARGET / "SKILL.md")["description"]
    assert len(description) <= 1024, "the index's description is longer than 1024 characters"
    if len(files) > MAX_FILES:
        sys.exit(f"{len(files)} files: more than the {MAX_FILES} Handler allows in one skill")
    print(f"{len(names)} skills from {commit[0][:7]} ({commit[1]}), {len(files)} files (max {MAX_FILES})")
    for path in missing:
        print(f"  linked but not in upstream: {path}")


INDEX = """\
---
name: marketing-skills
description: >-
  Marketing work of any kind: positioning, copywriting, CRO, SEO, paid ads, email, launches,
  pricing, growth, analytics, sales. Use it whenever the user asks for marketing help, then
  open the one matching skill from its index. Corey Haines' Marketing Skills, packaged as one.
license: MIT, Copyright (c) 2025 Corey Haines. See LICENSE
metadata:
  author: Corey Haines
  source: {upstream}
  commit: {commit}
---

# Marketing Skills, by Corey Haines

These are [Corey Haines' Marketing Skills]({upstream}) (MIT, commit `{short}`), packaged as one
skill. The {count} skills under `skills/` are his work, unchanged; this index is the only addition
(see ORIGIN.md).

## How to use them

1. Pick the skill below that matches the request, and read its `skills/<name>/SKILL.md`. Follow
   it as if it had been loaded on its own: its links are relative to its folder.
2. When a skill names another one (often in bold, like **copywriting**), that is
   `skills/<name>/SKILL.md` here.
3. Most skills first read the product's marketing context, `.agents/product-marketing.md`. When
   it is missing, the `product-marketing` skill writes it with the user.
4. Several skills fit? Start with the most specific one; a skill says itself when to hand over to
   another.

## Index

| Skill | When to use it (the first sentence of its description) |
|---|---|
{rows}
"""

ORIGIN = """\
# Origin

**Author:** Corey Haines
**Source:** {upstream}
**Commit:** `{commit}` ({date})
**License:** MIT, in LICENSE (upstream's, unchanged)

## What this package changes

- The {count} skills of upstream's `skills/` are under `skills/`, their files unchanged.
- Left out: each skill's `evals/` folder (upstream's tests of the skills).
- From upstream's `tools/`, only the files the skills link to with a relative path, unchanged,
  at the same place, so those links keep working.
- Added: `SKILL.md`, an index of the skills, so that an agent sees one skill instead of
  {count}; this file.

Everything else is Corey Haines' work. Report problems with the skills themselves upstream.
"""

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
