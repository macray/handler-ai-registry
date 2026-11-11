# Impeccable

[Impeccable](https://github.com/pbakaus/impeccable) by **Paul Bakaus** (Apache-2.0) as two
agents. The skill and its engine are his and Impeccable's contributors' work; this package adds
only the agents around them.

- **Interface designer** improves the interface you already have: it critiques it (a scored UX
  review), polishes and hardens it, makes it bolder or quieter, fixes type, layout, color and
  motion, and documents your visual system in `DESIGN.md`. It checks its own changes with
  Impeccable's detector before calling them done.
- **Design audit** is a job: each run audits the interface for accessibility, performance,
  theming and responsive behavior, and gives back a score out of 20 and its findings, P0
  (blocking) first, each with the command that fixes it. Run it on a schedule (Library →
  Automations) and the report comes to your inbox. It is told never to change a file; it runs
  unattended, so nothing else stops it.

**They need the `impeccable` tool**, installed with them when you set them up: it brings the
skill, its engine and the browser it checks pages in.

With the **Web designer** in the same project, new pages are the Web designer's, and what exists
is the Interface designer's. With the **Marketer**, the Interface designer takes your product's
audience and voice from the Marketer's `.agents/product-marketing.md`.

Problems with the skill itself: report them
[upstream](https://github.com/pbakaus/impeccable/issues).
