# Handler's official source

> **Experimental, for Handler 0.3.0.** This format will change in future releases of Handler:
> items here may need updating, and an older Handler may stop reading this source.

The apps, agents and tools [Handler](https://github.com/macray/handler-ai) offers to install
(Discover), reviewed by its maintainer. Every Handler reads this repository; nothing here is
installed until you choose it.

**Your own source**: any git repository laid out like this one. Add its `https://` address in
Settings → Expert → Sources → *Add a source* ([how](https://github.com/macray/handler-ai/blob/main/docs/sources.md)).
Handler does not check a source you add: you trust whoever writes it.

```
handler-source.toml      the source's name and description
apps/<name>/             an app: app.toml, server/, ui/dist/ built and committed
agents/<name>/           agents to set up: agents.toml, agents/<agent>/
tools/<name>/            a tool for agents: tool.toml, its Containerfile, skills/
system-packages/<name>/  a part of the toolbox a tool needs (package.toml), installed with it
```

Each folder is named as its manifest names it; its `README.md` is its page in Discover. Handler
reads the default branch's last commit. Items from other authors keep their license and credit
in their folder; `scripts/import/` rebuilds each from its upstream repository.

To try a change before pushing it: `scripts/check.sh /path/to/handler` reads this checkout with
a Handler checkout and fails on any item in error.

**A problem** with an item: open an issue
[here](https://github.com/macray/handler-ai-registry/issues); with Handler itself, in
[Handler's](https://github.com/macray/handler-ai/issues).
