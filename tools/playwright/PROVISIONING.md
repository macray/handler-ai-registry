# Playwright tool — what a connection needs

Nothing, for pages that need no login: a local preview in the sandbox, public sites.

```toml
# ~/.config/handler-ai/connections/browser.toml
apiVersion  = "handler.connection/v1"
tool        = "playwright"
description = "Web browser, no login"
```

## To watch the browser

Give the agent a display (web UI agent setting: **Show windows on my screen**; CLI:
`handler run … --display`). The daemon then gives the sandbox your Wayland session's socket, and
nothing else of your desktop (contract A.6); the browser opens as a window you can watch and use.
Without a display the browser is headless and the agent shows screenshots. `settings = { headless
= "1" }` keeps it headless even with a display.

## Sites that need a login

Not supported: the browser starts with an empty profile every session, and a connection cannot give
it a login.
