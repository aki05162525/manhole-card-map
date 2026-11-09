// Manual real-data check. The ephemeral server and browser are always closed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
const requests = [];
const workerResponses = [];
const server = spawn(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `
  import { Server } from 'node:http';
  const listen = Server.prototype.listen, emit = Server.prototype.emit;
  Server.prototype.listen = function (...args) {
    this.once('listening', () => process.send({ port: this.address().port }));
    return listen.apply(this, args);
  };
  Server.prototype.emit = function (event, ...args) {
    if (event === 'request') {
      process.send({ url: args[0].url });
      if (args[0].url.includes('maplibre-gl-worker')) {
        const response = args[1], end = response.end;
        response.end = function (body, ...rest) {
          process.send({ workerBodyBytes: Buffer.byteLength(body), encoding: this.getHeader('Content-Encoding') });
          return end.call(this, body, ...rest);
        };
      }
    }
    return emit.call(this, event, ...args);
  };
  await import(${JSON.stringify(pathToFileURL(resolve("scripts/serve.mjs")).href)});
`,
  ],
  {
    env: { ...process.env, PORT: "0", SERVE_DIR: resolve("dist") },
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  },
);
server.on("message", (message) => {
  if (message.url) requests.push(message.url);
  if (message.workerBodyBytes) workerResponses.push(message);
});
let browser;
try {
  const { port } = await new Promise((resolvePort, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server startup timeout")),
      5000,
    );
    server.on("message", (message) => {
      if (message.port) {
        clearTimeout(timer);
        resolvePort(message);
      }
    });
    server.once("error", reject);
    server.once("exit", (code) => reject(new Error(`Server exited: ${code}`)));
  });
  const origin = `http://127.0.0.1:${port}`;
  console.log(`Worker cache check: ${origin}`);
  browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
  assert.equal(await page.locator(".fixture-warning").count(), 0);
  const worker = page.workers()[0].url();
  assert.match(worker, /\/assets\/maplibre-gl-worker-[\w-]+\.js$/);
  assert.equal(
    requests.filter((url) => url.includes("maplibre-gl-worker")).length,
    1,
  );
  await page.reload();
  await page.waitForFunction(() => window.prototype?.metrics.ready > 0);
  assert.equal(
    requests.filter((url) => url === "/").length,
    2,
    "HTML must reach the server again",
  );
  assert.equal(
    requests.filter((url) => url.includes("maplibre-gl-worker")).length,
    1,
    "warm worker must use HTTP cache",
  );
  assert.equal(workerResponses.length, 1);
  assert.equal(workerResponses[0].encoding, "br");
  await context.setOffline(true);
  await page.getByRole("button", { name: "カードを検索", exact: true }).click();
  await page.getByRole("searchbox").fill("横浜駅観光案内所");
  await page
    .locator(".map-search-results button")
    .filter({ hasText: "14-100-A001" })
    .click();
  await page.locator("#detail").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("card"), "14-100-A001");
  assert.match(await page.locator("#detail").textContent(), /横浜駅観光案内所/);
  assert.equal(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
    0,
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      worker,
      workerNetworkRequests: 1,
      workerResponses,
      navigations: 2,
      offlineSearchAndDetail: true,
      serviceWorkers: 0,
    }),
  );
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
}
