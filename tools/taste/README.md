# taste

Art direction for the web pages and app screens your agents build, with
[taste-skill](https://github.com/Leonxlnx/taste-skill) by **Leonxlnx** (MIT). The skill is their
work, unchanged; this tool adds only what Handler needs to run it.

An agent with it no longer builds the average landing page. It lists what only this client has,
is dealt three art directions from a library drawn from 247 studied sites and picks one, builds
the page, then checks it in a real browser (at 1440, 768 and 390 px) and looks at the screenshots
until it holds up. Dashboards, settings and other app screens have their own rules.

## What it brings

- **The skill `design-taste-frontend`**, given to the agents that have this tool. It holds its
  license (`LICENSE`) and where it comes from (`ORIGIN.md`: the upstream commit).
- **Chromium** in the toolbox, which the skill's scripts drive (Node runs them).
- **The hosts it reaches**: open collections of pictures free to use with a credit (Openverse,
  Wikimedia Commons, the Art Institute of Chicago, the Met, the Internet Archive, NASA), the
  photographs its direction sheets suggest (picsum.photos) and Google Fonts. A picture Openverse
  finds on another site needs that site in the agent's allow-list.
- **What it keeps**: the directions dealt lately, so that two projects do not get the same.

Its working files go to `.taste-skill/` in the agent's folder.

Problems with the skill itself: report them
[upstream](https://github.com/Leonxlnx/taste-skill/issues).
