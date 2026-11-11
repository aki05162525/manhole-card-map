import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let origin: string;
beforeAll(async () => {
  server = await createServer({
    mode: "fixture",
    server: { host: "127.0.0.1", port: 0, ws: false, watch: null },
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw new Error("No port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  await server?.close();
});
it.each(["cards", "about", "account", "terms", "friends", "friends/invite"])(
  "serves the matching Vite document at /%s with its query intact",
  async (path) => {
    const response = await fetch(`${origin}/${path}?pref=13`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    // Check the entry module, so a fallback to the map document cannot pass.
    const module = path === "friends/invite" ? "invite" : path;
    expect(html).toContain(`/src/${module}-main.tsx`);
    expect(new URL(response.url).search).toBe("?pref=13");
  },
);
