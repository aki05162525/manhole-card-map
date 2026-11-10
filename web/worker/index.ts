import { createApp } from "./app";
import { serveData, type Assets } from "./data";
import type { Env } from "./env";
import { routes } from "./routes";

const handle = createApp({ routes });

// Only `/api/*` and `/data/*` reach this script (`assets.run_worker_first`);
// every other path is served by Static Assets without invoking the Worker.
export default {
  fetch: (request: Request, env: Env & { ASSETS: Assets }) =>
    new URL(request.url).pathname.startsWith("/data/")
      ? serveData(request, env.ASSETS)
      : handle(request, env),
};
