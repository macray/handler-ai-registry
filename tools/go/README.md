# Go

Lets agents build, test and run Go projects, with the official Go toolchain.

- **Commands**: `go`, `gofmt`.
- **Reaches**: Go's module proxy and checksum database (proxy.golang.org, sum.golang.org). A
  private module (`GOPRIVATE`) is fetched from its own host, which you then allow for the agent.
- **Keeps**: Go modules and the commands `go install` adds (`~/go`, its `bin` on the agent's
  PATH), as your project's caches setting says.
- **Updates**: every rebuild installs the latest Go release. A project whose `go.mod` asks for a
  newer Go than the tool's fails, and says so: rebuild the tool (Settings → Expert →
  Sandboxes). Go does not download another version by itself in a session.
- **Size**: about 280 MB.
