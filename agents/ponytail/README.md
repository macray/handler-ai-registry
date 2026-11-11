# Ponytail

[Ponytail](https://github.com/DietrichGebert/ponytail) by **DietrichGebert** (MIT) as two
agents. Its rules and skills are their work; this package adds only the agents around them.

- **Ponytail** codes like a lazy senior developer: it reads the code a task touches, then writes
  the smallest change that fully solves it (what the codebase, the standard library or an
  installed dependency already does comes first), and leaves one small test for logic that can
  break. It never cuts validation, error handling, security or accessibility. Each reply ends
  with what it skipped and any risk. Its instructions are Ponytail's rules (upstream's
  `AGENTS.md`), on in every session. Ask it for a review, an audit of the repository, or the
  list of the shortcuts it left (`shortcut:` comments in the code).
- **Ponytail audit** is a job: each run audits the project's code and gives back its findings,
  most important first, each with what it is, the problem, the fix and what happens if you skip
  it. Run it on a schedule (Library → Automations, e.g. every Monday) and the report comes to
  your inbox. It is told never to change a file; it runs unattended, so nothing else stops it.

## What it brings

Three skills in Library → Skills, upstream's unchanged, each with its license (`LICENSE`) and
where it comes from (`ORIGIN.md`: the upstream commit): `ponytail-review`, `ponytail-audit`,
`ponytail-debt`. Upstream's hooks, status line and band are for agents Handler does not need
them for: Handler gives an agent its instructions in every session.

With the **Web designer** in the same project: Ponytail asks for the least code, taste-skill for a
page with substance. Give pages to the Web designer and the rest of the code to Ponytail.

Problems with the rules or skills themselves: report them
[upstream](https://github.com/DietrichGebert/ponytail/issues).
