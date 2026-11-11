# Bun

Lets agents work on JavaScript and TypeScript projects that use Bun: run, test, install
packages, bundle.

- **Commands**: `bun`, `bunx`.
- **Reaches**: the npm registry (registry.npmjs.org).
- **Keeps**: Bun's packages and the commands it installs (`~/.bun`, its `bin` on the agent's
  PATH), as your project's caches setting says.
- **Updates**: every rebuild installs the latest Bun release.
- **Size**: about 100 MB.

An agent that writes Handler apps already has Bun, from the built-in `app-builder` tool, at the
version apps run on: it cannot also have this one.
