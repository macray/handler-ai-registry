# impeccable

Design commands and a UI slop detector for the agents that build your interfaces, with
[Impeccable](https://github.com/pbakaus/impeccable) by **Paul Bakaus** (Apache-2.0). The skill
and its engine are his and Impeccable's contributors' work, unchanged; this tool adds only what
Handler needs to run them.

An agent with it has words for what you want: `critique` (a scored UX review), `audit`
(accessibility, performance, theming, responsive, ranked P0 to P3), `polish`, `harden`,
`bolder`, `quieter`, `typeset`, `layout` and more, each with its own playbook. It writes your
product's context to `PRODUCT.md` and its visual system to `DESIGN.md`, so every change stays
on-brand. Its detector finds 62 tells of generated UI (purple gradients, nested cards, gray text
on color, skipped headings…) in source files and in rendered pages, without a model.

## What it brings

- **The skill `impeccable`**, given to the agents that have this tool, with its license
  (`LICENSE`), its third-party notices (`NOTICE.md`) and where it comes from (`ORIGIN.md`: the
  upstream commit).
- **Its engine**, a program built by the project: this tool's image downloads the version the
  skill pins from the project's GitHub releases, and keeps it only when its checksum is the one
  the skill lists. Agents never download it.
- **Chromium** in the toolbox, where the detector renders pages.
- **The hosts it reaches**: Google Fonts.

Left out: upstream's design hook (a Handler tool cannot bring hooks; the agent runs the detector
itself), live mode's Apply (it would start another coding agent with its approvals off), its
update check (updates come with the tool), its browser and editor extensions.

Problems with the skill itself: report them
[upstream](https://github.com/pbakaus/impeccable/issues).
