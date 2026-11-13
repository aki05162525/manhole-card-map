// Manual check that one screen's CSS does not change another screen.
// Each state is captured as built, then again with the other screens'
// stylesheets appended to the same document; pixels and boxes must match.
//
//   node scripts/css-isolation.browser-check.mjs [--dir dist-fixture]
//     [--save <dir>]     keep the as-built captures
//     [--against <dir>]  also compare them with captures kept from another build
//     [--card <id>]      only the details of this card, in the list and on
//                        the map (real data)
//     [--only <text>]    only the states whose name contains the text
//     [--out <dir>]      where images of failures go
//
// The ephemeral server and browser are always closed.
import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values: options } = parseArgs({
  options: {
    dir: { type: "string", default: "dist-fixture" },
    save: { type: "string" },
    against: { type: "string" },
    card: { type: "string" },
    only: { type: "string" },
    out: { type: "string", default: "css-isolation-failures" },
  },
});
const dir = resolve(options.dir);

const server = spawn(
  process.execPath,
  [
    "--input-type=module",
    "--eval",
    `
  import { Server } from 'node:http';
  const listen = Server.prototype.listen;
  Server.prototype.listen = function (...args) {
    this.once('listening', () => process.send({ port: this.address().port }));
    return listen.apply(this, args);
  };
  await import(${JSON.stringify(new URL("./serve.mjs", import.meta.url).href)});
`,
  ],
  {
    env: { ...process.env, PORT: "0", SERVE_DIR: dir },
    stdio: ["ignore", "ignore", "inherit", "ipc"],
  },
);

const mapReady = async (page) => {
  await page.locator(".maplibregl-canvas").waitFor();
  // The locate button turns on once the basemap is ready.
  await page.locator("#locate:not([disabled])").waitFor();
};
const mapStates = [
  { name: "map-national", path: "/", ready: mapReady },
  {
    name: "map-detail",
    path: "/?card=TEST-TOKYO-1",
    ready: async (page) => {
      await mapReady(page);
      await page.locator("#detail .detail-heading h2").waitFor();
    },
  },
  {
    name: "map-search",
    path: "/",
    ready: async (page) => {
      await mapReady(page);
      await page.locator(".map-search-entry").click();
      await page.locator(".map-search-dialog[open] input").waitFor();
      // The text cursor's edge differs between captures of the same state.
      await page.evaluate(() => document.activeElement?.blur());
    },
  },
  {
    name: "map-menu",
    path: "/",
    ready: async (page) => {
      await mapReady(page);
      // Wide screens list the links beside the bar instead of the menu.
      const menu = page.locator(".map-search-bar .site-menu-button");
      if (!(await menu.isVisible()))
        return page.locator(".map-nav a").first().waitFor();
      await menu.click();
      await page.locator(".site-menu-panel a").first().waitFor();
    },
  },
].map((state) => ({ ...state, add: [["cards"], ["account"]] }));
const cardStates = (
  options.card
    ? [
        {
          name: `cards-detail-${options.card}`,
          path: `/cards?${new URLSearchParams({ card: options.card })}`,
          ready: (page) => page.locator(".catalog-detail").waitFor(),
        },
      ]
    : [
        {
          name: "cards-national",
          path: "/cards",
          ready: (page) => page.locator("[data-pref]").first().waitFor(),
        },
        {
          name: "cards-pref",
          path: "/cards?pref=13",
          ready: (page) => page.locator(".catalog-row").first().waitFor(),
        },
        {
          name: "cards-detail",
          path: "/cards?pref=13&card=TEST-TOKYO-1",
          ready: (page) => page.locator(".catalog-detail").waitFor(),
        },
      ]
).map((state) => ({ ...state, add: [["map"], ["account"]] }));
const documentStates = ["account", "friends", "about"].map((name) => ({
  name,
  path: `/${name}`,
  ready: (page) => page.locator("main").waitFor(),
  add: [["map", "cards"]],
}));
const states = (
  options.card
    ? [
        ...cardStates,
        // Real tiles are blocked below, so the map itself is not awaited.
        {
          name: `map-detail-${options.card}`,
          path: `/?${new URLSearchParams({ card: options.card })}`,
          ready: (page) => page.locator("#detail .detail-heading h2").waitFor(),
          add: [["cards"], ["account"]],
        },
      ]
    : [...cardStates, ...mapStates, ...documentStates]
).filter((state) => state.name.includes(options.only ?? ""));
const card = options.card ?? "TEST-TOKYO-1";

// With real data the blocked tiles are retried, so the network may never rest.
const quiet = (page) =>
  page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

const failures = [];
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
  console.log(`CSS isolation check: ${origin} (${dir})`);
  browser = await chromium.launch({
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  async function open(viewport, colorScheme) {
    const context = await browser.newContext({
      viewport,
      colorScheme,
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
    });
    context.setDefaultTimeout(20000);
    // The fixture map has no tiles; real tiles would differ between captures.
    await context.route("**/*", (route) =>
      /^(?:data|blob):/.test(route.request().url()) ||
      route.request().url().startsWith(origin)
        ? route.continue()
        : route.abort(),
    );
    return context;
  }
  const loaded = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].map(
        (link) => new URL(link.href).pathname,
      ),
    );

  // What each screen loads, found by using it rather than from file names.
  const groups = {};
  {
    const context = await open({ width: 412, height: 915 }, "light");
    const page = await context.newPage();
    const visit = async (path) => {
      await page.goto(origin + path);
      await quiet(page);
    };
    await visit(`/?${new URLSearchParams({ card })}`);
    await page.locator(".map-search-entry").click();
    await quiet(page);
    groups.map = await loaded(page);
    await visit(`/cards?${new URLSearchParams({ card })}`);
    groups.cards = await loaded(page);
    await visit("/account");
    groups.account = await loaded(page);
    await visit("/friends");
    groups.account = [...new Set([...groups.account, ...(await loaded(page))])];
    await context.close();
  }
  // Every stylesheet of the app, lazy and signed-in ones included. The
  // prerendered pages' own bundle is left out: those documents stay separate.
  groups.all = (await readdir(resolve(dir, "assets")))
    .filter((file) => /^(?!static-pages-).*\.css$/.test(file))
    .map((file) => `/assets/${file}`);
  for (const [name, files] of Object.entries(groups))
    console.log(`${name}: ${files.length} stylesheets`);

  const boxes = (page) =>
    page.evaluate(() =>
      [document.documentElement, ...document.body.querySelectorAll("*")].map(
        (element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return [
            element.tagName.toLowerCase() +
              (element.id ? `#${element.id}` : "") +
              (typeof element.className === "string" && element.className
                ? `.${element.className.trim().replaceAll(/\s+/g, ".")}`
                : ""),
            x,
            y,
            width,
            height,
          ].join(" ");
        },
      ),
    );
  // Sheets and panels move after they appear; wait until nothing does.
  async function settle(page) {
    let last = "";
    for (let tries = 0; tries < 40; tries++) {
      const now = (await boxes(page)).join("\n");
      if (now === last) return;
      last = now;
      await page.waitForTimeout(250);
    }
  }
  const capture = async (page) => {
    await settle(page);
    return {
      image: await page.screenshot({ fullPage: true, animations: "disabled" }),
      boxes: await boxes(page),
    };
  };
  async function differingPixels(page, a, b) {
    if (a.equals(b)) return 0;
    return page.evaluate(
      async ([first, second]) => {
        const pixels = async (source) => {
          const bitmap = await createImageBitmap(
            await (await fetch(`data:image/png;base64,${source}`)).blob(),
          );
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          return context.getImageData(0, 0, bitmap.width, bitmap.height);
        };
        const [left, right] = await Promise.all([
          pixels(first),
          pixels(second),
        ]);
        if (left.width !== right.width || left.height !== right.height)
          return `size ${left.width}x${left.height} vs ${right.width}x${right.height}`;
        const one = new Uint32Array(left.data.buffer);
        const other = new Uint32Array(right.data.buffer);
        let count = 0;
        const box = [Infinity, Infinity, 0, 0];
        for (let index = 0; index < one.length; index++)
          if (one[index] !== other[index]) {
            count++;
            const x = index % left.width;
            const y = Math.floor(index / left.width);
            box[0] = Math.min(box[0], x);
            box[1] = Math.min(box[1], y);
            box[2] = Math.max(box[2], x);
            box[3] = Math.max(box[3], y);
          }
        return count && `${count} within ${box.join(",")}`;
      },
      [a.toString("base64"), b.toString("base64")],
    );
  }
  async function compare(page, label, expected, actual) {
    const pixels = await differingPixels(page, expected.image, actual.image);
    const box = expected.boxes.findIndex(
      (line, index) => line !== actual.boxes[index],
    );
    const boxes =
      box >= 0 || expected.boxes.length !== actual.boxes.length
        ? `${expected.boxes[box]} -> ${actual.boxes[box]}`
        : "";
    if (!pixels && !boxes) return false;
    failures.push(label);
    console.log(
      `FAIL ${label}: pixels ${pixels}${boxes ? `; box ${boxes}` : ""}`,
    );
    await mkdir(options.out, { recursive: true });
    await writeFile(
      resolve(options.out, `${label}.expected.png`),
      expected.image,
    );
    await writeFile(resolve(options.out, `${label}.actual.png`), actual.image);
    return true;
  }

  const attach = (page, files) =>
    page.evaluate(
      (hrefs) =>
        Promise.all(
          hrefs.map(
            (href) =>
              new Promise((done, fail) => {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                link.dataset.cssIsolation = "";
                link.onload = done;
                link.onerror = fail;
                document.head.append(link);
              }),
          ),
        ),
      files,
    );
  const detach = (page) =>
    page.evaluate(() => {
      for (const link of document.querySelectorAll("link[data-css-isolation]"))
        link.remove();
    });
  // Names the declarations behind a difference: one line per element and
  // property whose computed value the added stylesheets changed.
  const computed = (page) =>
    page.evaluate(() => {
      // Custom properties change nothing alone; sizes follow from the rest.
      const derived =
        /^--|^(?:(?:block|inline)-size|width|height|(?:perspective|transform)-origin)$/;
      return [
        document.documentElement,
        ...document.body.querySelectorAll("*"),
      ].flatMap((element) => {
        const name =
          element.tagName.toLowerCase() +
          (typeof element.className === "string" && element.className
            ? `.${element.className.trim().replaceAll(/\s+/g, ".")}`
            : "");
        return [null, "::before", "::after"].flatMap((pseudo) => {
          const style = getComputedStyle(element, pseudo);
          return [...style]
            .filter((property) => !derived.test(property))
            .map(
              (property) =>
                `${name}${pseudo ?? ""} ${property}: ${style.getPropertyValue(property)}`,
            );
        });
      });
    });

  for (const viewport of [
    { width: 412, height: 915 },
    { width: 1280, height: 800 },
  ])
    for (const colorScheme of ["light", "dark"]) {
      const context = await open(viewport, colorScheme);
      for (const state of states) {
        const label = `${state.name}-${viewport.width}-${colorScheme}`;
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.goto(origin + state.path);
        await state.ready(page);
        await quiet(page);
        await page.evaluate(() => document.fonts.ready);
        const plain = await capture(page);
        if (options.save) {
          await mkdir(options.save, { recursive: true });
          await writeFile(resolve(options.save, `${label}.png`), plain.image);
          await writeFile(
            resolve(options.save, `${label}.json`),
            JSON.stringify(plain.boxes),
          );
        }
        if (options.against)
          await compare(
            page,
            `${label}.against`,
            {
              image: await readFile(resolve(options.against, `${label}.png`)),
              boxes: JSON.parse(
                await readFile(
                  resolve(options.against, `${label}.json`),
                  "utf8",
                ),
              ),
            },
            plain,
          );
        // A state that changes by itself cannot show what a stylesheet did.
        await compare(page, `${label}.unstable`, plain, await capture(page));
        const present = new Set(await loaded(page));
        for (const add of [...state.add, ["all"]]) {
          const files = [
            ...new Set(add.flatMap((group) => groups[group])),
          ].filter((file) => !present.has(file));
          await attach(page, files);
          const changed = await compare(
            page,
            `${label}+${add.join("+")}`,
            plain,
            await capture(page),
          );
          await detach(page);
          if (changed) {
            const before = await computed(page);
            await attach(page, files);
            const after = await computed(page);
            await detach(page);
            const lines = [
              ...new Set(
                before.flatMap((line, index) =>
                  line === after[index]
                    ? []
                    : [`  ${line}\n   -> ${after[index]}`],
                ),
              ),
            ].slice(0, 40);
            console.log(lines.join("\n"));
          }
        }
        if (errors.length) {
          failures.push(label);
          console.log(`FAIL ${label}: ${errors.join("; ")}`);
        }
        await page.close();
      }
      await context.close();
    }
} finally {
  await browser?.close();
  server.kill();
}
if (failures.length) {
  console.log(
    `${failures.length} differences; images in ${resolve(options.out)}`,
  );
  process.exitCode = 1;
} else console.log("CSS isolation check passed");
