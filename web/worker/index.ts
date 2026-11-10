import { createApp } from "./app";
import type { Env } from "./env";
import { openInDefaultBrowser } from "./external-browser";
import { routes } from "./routes";

const handle = createApp({ routes });
// Static Assets, for the pages that reach the script.
type Assets = { ASSETS: { fetch(request: Request): Promise<Response> } };

// Only `/api/*` and the pages reach this script (`assets.run_worker_first`);
// every other path is served by Static Assets without invoking the Worker.
export default {
  fetch: (request: Request, env: Env & Assets) =>
    new URL(request.url).pathname.startsWith("/api/")
      ? handle(request, env)
      : (openInDefaultBrowser(request) ?? env.ASSETS.fetch(request)),
};
