// Manual theme checks against an existing real-data server. No data mutation.
// Run: node tools/design/theme-fault-server.mjs (backend 4187, proxy 4188).
// /__theme-test/{data-loading,data-failure,map-failure}/{map,cards}
import { createServer } from "node:http";
const origin = "http://127.0.0.1:4187";
const server = createServer(async (request, response) => {
  try {
    const match = request.url.match(
      /^\/__theme-test\/(data-loading|data-failure|map-failure)\/(map|cards)$/,
    );
    const path = match ? (match[2] === "cards" ? "/cards.html" : "/") : request.url;
    const upstream = await fetch(origin + path, { headers: { "accept-encoding": "identity" } });
    let body = Buffer.from(await upstream.arrayBuffer());
    if (match) {
      const condition =
        match[1] === "map-failure"
          ? 'String(url?.url || url).includes("style.json")'
          : 'String(url?.url || url).includes("/data/")';
      const fault =
        match[1] === "data-loading"
          ? "new Promise(() => {})"
          : 'Promise.reject(new Error("Theme check: simulated network failure"))';
      const script = `<script>const originalFetch=window.fetch;window.fetch=(url,...args)=>${condition}?${fault}:originalFetch(url,...args);</script>`;
      body = Buffer.from(body.toString().replace("<head>", "<head>" + script));
    }
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch (error) {
    response.writeHead(502);
    response.end(String(error));
  }
});
server.listen(4188, "127.0.0.1", () =>
  console.log(
    "Theme fault preview http://127.0.0.1:4188 (simulated faults, real data backend 4187)",
  ),
);
