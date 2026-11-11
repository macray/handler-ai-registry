// Entry point. handler runs `bun run server/main.ts` in a sandbox with:
//   HANDLER_APP_DATA    the app's own data folder (asks.json: the runs you started)
//   HANDLER_APP_SOCKET  the Unix socket to serve on (handler forwards /api/… of the app's address here)
//   HANDLER_APP_FILES   the folders you gave its needs: `notes` (notes/, actions/), shared with the agent
// Without HANDLER_APP_SOCKET (`bun run dev`), it serves on 127.0.0.1:8787 for the UI's dev server,
// on the folder .data/notes and without an agent.
import { mkdirSync } from "node:fs";
import { files, getRun, runAgent } from "./handler.ts";
import { type Context, handle } from "./routes.ts";
import { Store } from "./store.ts";

const data = process.env.HANDLER_APP_DATA ?? ".data";
mkdirSync(data, { recursive: true });
const socket = process.env.HANDLER_APP_SOCKET;
const folder = files().notes ?? `${data}/notes`;
if (!socket) mkdirSync(folder, { recursive: true });

const ctx: Context = {
  store: new Store(folder),
  data,
  agent: {
    run: (request, fields) => runAgent(request, "scribe", fields),
    get: getRun,
  },
};
const fetch = (req: Request) => handle(ctx, req);

if (socket) {
  Bun.serve({ unix: socket, fetch });
} else {
  Bun.serve({ hostname: "127.0.0.1", port: 8787, fetch });
}
