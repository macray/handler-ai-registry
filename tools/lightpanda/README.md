# Lightpanda

Gives agents a headless web browser made for them: [Lightpanda](https://github.com/lightpanda-io/browser),
through its own MCP server. It opens pages, runs their JavaScript, reads them as markdown, follows
links, fills forms and clicks, using much less memory and time than Chromium.

- **Not a full browser**: it draws nothing, so the agent cannot check how a page looks (its
  screenshots are a text layout), and some sites that work in Chrome do not work in it yet. For a
  window you watch, or visual checks, use the `playwright` tool.
- **Commands**: `lightpanda` (`lightpanda fetch --dump markdown <url>` for one page).
- **Reaches**: nothing of its own: the sites the agent visits, which you allow for the agent
  (log-only mode shows which hosts a site needs). A server the agent starts in its sandbox needs
  nothing.
- **Skill**: `lightpanda`, which tools to use, what it cannot do, and what the agent asks you first
  (orders, payments, messages, deleting).
- **Starts empty**: no cookies, no logins, every session.
- **No telemetry**: Lightpanda's usage reports are turned off.
- **Updates**: every rebuild installs the latest Lightpanda release.
- **Size**: about 75 MB.
