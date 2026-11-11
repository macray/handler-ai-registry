# Playwright

Gives agents a web browser, through [Playwright MCP](https://github.com/microsoft/playwright-mcp):
it opens pages, reads them, clicks, types, resizes the window and takes screenshots. To check
the site or app the agent works on (a local preview in its sandbox, at desktop and phone widths),
or any site you allow it.

- **A window you watch**: give the agent a display (its settings: *Show windows on my screen*)
  and the browser opens as a window on your screen; without one it is headless and the agent shows
  screenshots. The connection's `headless` setting keeps it headless anyway.
- **Needs**: the toolbox's Chromium (installing the tool adds the `chromium` system package when
  the toolbox lacks it), and a connection, with no secret (`PROVISIONING.md`).
- **Reaches**: nothing of its own: the sites the agent visits, which you allow for the agent
  (log-only mode shows which hosts a site needs). A server the agent starts in its sandbox needs
  nothing.
- **Skill**: `browser`, how to check a page and what to do when a site does not load.
- **Starts empty**: no cookies, no logins, every session. Sites that need a login are not
  supported.
- **Updates**: every rebuild installs the latest Playwright MCP release.

For a lighter browser that draws nothing, see the `lightpanda` tool.
