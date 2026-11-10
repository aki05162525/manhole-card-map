import { createApp } from "./app";
import type { Env } from "./env";
import { routes } from "./routes";

const handle = createApp({ routes });

// Only `/api/*` reaches this script (`assets.run_worker_first`); every other
// path is served by Static Assets without invoking the Worker.
export default {
  fetch: (request: Request, env: Env) => handle(request, env),
};
