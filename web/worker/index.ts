import { createApp } from "./app";
import { cardImagePrefix, serveCardImage } from "./card-images";
import type { Env } from "./env";
import { openInDefaultBrowser } from "./external-browser";
import { routes } from "./routes";

const handle = createApp({ routes });
// Static Assets, for the pages that reach the script.
type Assets = { ASSETS: { fetch(request: Request): Promise<Response> } };
type Context = { waitUntil(promise: Promise<unknown>): void };

// Only `/api/*`, the card images and the pages reach this script
// (`assets.run_worker_first`); every other path is served by Static Assets
// without invoking the Worker.
export default {
  fetch(request: Request, env: Env & Assets, context: Context) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) return handle(request, env);
    if (pathname.startsWith(cardImagePrefix))
      return serveCardImage(request, env.CARD_IMAGES, context);
    return openInDefaultBrowser(request) ?? env.ASSETS.fetch(request);
  },
};
