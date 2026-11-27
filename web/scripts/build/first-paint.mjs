// The map's first paint, from its HTML alone: the search bar and the
// national level (`src/pages/map/map-shell.tsx`), placed by a script the
// HTML carries (`src/map-stage-main.ts`), and styled by the rules they use,
// written into the HTML. The page's stylesheets are linked after them, so
// the first paint waits for no file (`checkFirstPaint`).
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { atRule, parse } from "postcss";
import { build } from "vite";

const web = fileURLToPath(new URL("../../", import.meta.url));

const prefecturesFile = fileURLToPath(
  new URL("../../src/prefectures.ts", import.meta.url),
);
/**
 * The prefectures and regions as the HTML's script reads them: their names,
 * the regions they belong to, and the codes the page's counts are written
 * by. It draws the national level alone, and only where it shows the
 * regions (`first-stage.ts`): no prefecture's badge or bounds, nor a
 * region's bounds, is placed by it.
 */
const regionsOnly = {
  name: "prefectures-without-places",
  enforce: "pre",
  async load(id) {
    if (id !== prefecturesFile) return null;
    const { prefectures, areas } = await import(prefecturesFile);
    const named = prefectures.map(({ code, name, area }) => ({
      code,
      name,
      area,
    }));
    const regions = areas.map(({ id, name, prefs }) => ({ id, name, prefs }));
    return `export const prefectures = ${JSON.stringify(named)};\nexport const areas = ${JSON.stringify(regions)};`;
  },
};

/**
 * The HTML's own script: one classic script that loads nothing, built with
 * the page's environment (`mode`), so it decides as the page's script does.
 */
export async function buildStageScript(mode) {
  const [result] = [
    await build({
      configFile: false,
      root: web,
      mode,
      logLevel: "warn",
      plugins: [regionsOnly],
      build: {
        write: false,
        minify: true,
        lib: {
          entry: "src/map-stage-main.ts",
          formats: ["iife"],
          name: "mapStage",
        },
      },
    }),
  ].flat();
  const chunks = result.output.filter((output) => output.type === "chunk");
  if (chunks.length !== 1) throw new Error("The map's own script is one file");
  return chunks[0].code.trim();
}

// What a selector still says of the page's elements without the states a
// first paint cannot be in yet, and without the parts of an element it
// styles: a rule kept for them is kept for the element itself. A form
// control's own parts are kept for the controls alone.
const controlParts =
  /(?<!\\)::?(?:placeholder|file-selector-button|-webkit-(?:date|datetime|calendar|inner|outer|search|clear)[\w-]*)/g;
const parts =
  /(?<!\\)::?(?:before|after|first-line|first-letter|marker|selection|backdrop|-(?:webkit|moz)-[\w-]+|view-transition[\w-]*(?:\([^)]*\))?)/g;
const states =
  /(?<!\\):(?:hover|focus|focus-visible|focus-within|active|visited|target|enabled|disabled|checked|indeterminate|placeholder-shown|autofill|user-invalid|invalid|valid|open|popover-open|modal|fullscreen)(?![\w-])/g;
function matcher(documents) {
  return (selector) => {
    const plain = selector
      .replace(controlParts, ":is(input,textarea,select)")
      .replace(parts, "")
      .replace(states, "")
      .replace(/\s+/g, " ")
      .replace(/ ?([>+~,]) ?/g, "$1")
      // A part or a state alone stood for any element there.
      .replace(/(^|[ >+~(,])(?=$|[ >+~),])/g, "$1*")
      .trim();
    try {
      return documents.some((document) => document.querySelector(plain));
    } catch {
      // A selector the matcher cannot read is kept.
      return true;
    }
  };
}
const grouping = new Set([
  "media",
  "supports",
  "layer",
  "container",
  "scope",
  "starting-style",
]);
const references = (value) =>
  [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);

/**
 * The rules of `css` (the page's stylesheets, in order) that style an
 * element of `html` as its first paint shows it: placed or not, a choice
 * marked as pressed, either form of the choices. Media queries, layers and
 * the at-rules those rules name are kept with them, in the order they come,
 * so that once the stylesheets load they win as before. Custom properties
 * nothing kept reads are left out.
 */
export function criticalCss(html, css) {
  const page = new JSDOM(html).window.document;
  const drawn = page.cloneNode(true);
  drawn.querySelector("[data-first-stage]")?.setAttribute("data-measured", "");
  for (const button of drawn.querySelectorAll("[data-choice]"))
    button.setAttribute("aria-current", "true");
  const matches = matcher([page, drawn]);
  const root = parse(css);
  const prune = (container) => {
    container.each((node) => {
      if (node.type === "comment") node.remove();
      else if (node.type === "rule") {
        if (!node.selectors.some(matches)) node.remove();
      } else if (node.type === "atrule" && grouping.has(node.name)) {
        // `@layer a, b;` orders the layers, and is kept.
        if (!node.nodes) return;
        // Left empty, it goes with the rest of what is empty below.
        prune(node);
      }
    });
  };
  prune(root);
  // The custom properties read by what is kept, and those they read.
  const read = new Set();
  root.walkDecls((decl) => {
    if (!decl.prop.startsWith("--"))
      for (const name of references(decl.value)) read.add(name);
  });
  for (let size = -1; size !== read.size;) {
    size = read.size;
    root.walkDecls((decl) => {
      if (read.has(decl.prop))
        for (const name of references(decl.value)) read.add(name);
    });
  }
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--") && !read.has(decl.prop)) decl.remove();
  });
  // The animations and registered properties the kept rules name.
  const used = new Set(read);
  root.walkDecls((decl) => {
    if (/^(?:-webkit-)?animation(?:-name)?$/.test(decl.prop))
      for (const word of decl.value.match(/[\w-]+/g) ?? []) used.add(word);
  });
  root.walkAtRules((rule) => {
    if (
      (rule.name === "keyframes" || rule.name === "property") &&
      !used.has(rule.params.trim())
    )
      rule.remove();
  });
  // What is left empty. A named layer is ordered where it first comes,
  // whatever it holds: left empty there, it still says its place, as the
  // stylesheets that load later cannot reorder it.
  const named = (node) =>
    node.type === "atrule" && node.name === "layer" && node.params.trim();
  const empty = (node) =>
    (node.type === "rule" ||
      (node.type === "atrule" && grouping.has(node.name) && node.nodes)) &&
    !node.nodes.length;
  const dropEmpty = () => {
    for (let removed = true; removed;) {
      removed = false;
      root.walk((node) => {
        if (empty(node) && !named(node)) {
          node.remove();
          removed = true;
        }
      });
    }
  };
  dropEmpty();
  const ordered = new Set();
  const layerPath = (node, name) => {
    const names = [name];
    for (let parent = node.parent; parent; parent = parent.parent)
      if (named(parent)) names.unshift(parent.params.trim());
    return names.join(".");
  };
  root.walkAtRules("layer", (rule) => {
    const names = rule.params.split(",").map((name) => name.trim());
    const paths = names.filter(Boolean).map((name) => layerPath(rule, name));
    const unordered = paths.some((path) => !ordered.has(path));
    for (const path of paths) ordered.add(path);
    if (!rule.nodes || rule.nodes.length || !named(rule)) return;
    if (unordered)
      rule.replaceWith(atRule({ name: "layer", params: names.join(",") }));
    else rule.remove();
  });
  dropEmpty();
  // A statement last in a block still ends with its semicolon.
  const ends = (block) => {
    if (block.last?.type === "atrule" && !block.last.nodes)
      block.raws.semicolon = true;
  };
  ends(root);
  root.walk((node) => {
    if (node.nodes) ends(node);
  });
  return root.toString().trim();
}

const executable = /<script(?![^>]*\b(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g;
const styles = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
const hash = (text) =>
  `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
/** The CSP sources of the HTML's own scripts and styles. */
export const inlineHashes = (html) => ({
  script: [...html.matchAll(executable)].map(([, text]) => hash(text)),
  style: [...html.matchAll(styles)].map(([, text]) => hash(text)),
});

// The rules of a `_headers` file, in order: a path, then its headers
// indented under it, `! Name` detaching one an earlier rule set.
function headerRules(headers) {
  const rules = [];
  for (const line of headers.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), lines: [] });
    else rules.at(-1)?.lines.push(line.trim());
  }
  return rules;
}
const pathPattern = (path) =>
  new RegExp(
    `^${path
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*")}$`,
  );

/**
 * The headers `headers` (`_headers`) gives the response at `path`, as
 * Static Assets applies them: every rule that matches, in order, a header
 * set twice joined by a comma, and `! Name` removing what came before.
 */
export function headersFor(headers, path) {
  const applied = new Map();
  for (const rule of headerRules(headers)) {
    if (!pathPattern(rule.path).test(path)) continue;
    for (const line of rule.lines) {
      const detached = /^!\s*(.+)$/.exec(line);
      if (detached) {
        applied.delete(detached[1].trim().toLowerCase());
        continue;
      }
      const [, name, value] = /^([^:]+):\s*(.*)$/.exec(line) ?? [];
      if (!name) continue;
      const key = name.trim().toLowerCase();
      applied.set(
        key,
        applied.has(key) ? `${applied.get(key)}, ${value}` : value,
      );
    }
  }
  return applied;
}
/** The CSP the response at `path` carries (`headersFor`). */
export const cspFor = (headers, path) =>
  headersFor(headers, path).get("content-security-policy") ?? "";

/**
 * `headers` (`_headers`) with the CSP allowing `hashes` too, in the policy
 * every page has. A rule for the map's path alone, detaching that policy
 * and setting its own, is not what Cloudflare serves: the map then answers
 * with both policies, and the stricter one blocks its script (seen on a
 * preview; `wrangler dev` serves one). A hash allows that one script and
 * that one style, which the build wrote, on the other pages too.
 */
export function withCspHashes(headers, hashes) {
  let found = 0;
  const allowed = headers.replace(
    /^( {2}Content-Security-Policy: .*)$/gm,
    (line) => {
      found++;
      return line.replace(/\b(script|style)-src 'self'/g, (directive, kind) =>
        [directive, ...hashes[kind]].join(" "),
      );
    },
  );
  if (found !== 1 || !allowed.includes("script-src 'self'"))
    throw new Error("_headers: one CSP with script-src and style-src 'self'");
  // Static Assets reads no longer line.
  if (allowed.split("\n").some((line) => line.length > 2000))
    throw new Error("_headers: the CSP is too long");
  return allowed;
}

/**
 * The map's HTML drawn by itself: `style` written into its head, the
 * stylesheets it links moved to the end of its body, after the drawing and
 * the script that places it.
 */
export function withFirstPaint(html, style) {
  if (!html.includes("</head>")) throw new Error("index.html: no head");
  const links = [];
  const head = html
    .slice(0, html.indexOf("</head>"))
    .replace(/\s*<link\b[^>]*\brel="stylesheet"[^>]*>/g, (tag) => {
      links.push(tag.trim());
      return "";
    });
  if (!links.length) throw new Error("index.html: no stylesheets to move");
  const body = html.slice(html.indexOf("</head>"));
  return `${head}<style>${style}</style>\n${body.replace(
    "</body>",
    `${links.join("\n")}\n</body>`,
  )}`;
}

/**
 * The map's `html` as its own script leaves it, at `url` with the history
 * entry's `state`, on a screen of `size` (a phone, 412×915, unless given;
 * the search bar 72px deep). Only the HTML's own scripts run: no file it
 * names is read. `onError` hears what the script throws.
 */
export function firstPaint(
  html,
  {
    url = "https://example.test/",
    state,
    size = { width: 412, height: 915 },
    onError,
  } = {},
) {
  return new JSDOM(html, {
    url,
    runScripts: "dangerously",
    beforeParse(window) {
      if (state !== undefined) window.history.replaceState(state, "");
      if (onError)
        window.addEventListener("error", (event) => onError(event.error));
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        const stage = this.matches(".map-stage, .level-stage");
        const bar = this.matches(".map-search-bar");
        return new window.DOMRect(
          0,
          0,
          stage ? size.width : 0,
          stage ? size.height : bar ? 72 : 0,
        );
      };
    },
  }).window.document;
}

/**
 * Checks that the map's `html` draws its first view by itself: no
 * stylesheet holds its first paint back, and its own script, run with no
 * other file, places the national level on a phone (`firstPaint`) with the
 * public counts. With `headers` (`_headers`), the one CSP the map's HTML is
 * served with allows that script and style. Returns the badges as placed.
 */
export function checkFirstPaint(html, { headers } = {}) {
  const head = html.slice(0, html.indexOf("</head>"));
  if (/<link\b[^>]*\brel="stylesheet"/.test(head))
    throw new Error("index.html: a stylesheet holds the first paint back");
  const hashes = inlineHashes(html);
  if (hashes.script.length !== 1 || hashes.style.length !== 1)
    throw new Error("index.html: one script and one style of its own");
  if (headers !== undefined) {
    // Every policy the response carries has to allow them.
    if (/^\s*!\s*Content-Security-Policy/im.test(headers))
      throw new Error("_headers: a detached CSP is served beside the other");
    const policies = cspFor(headers, "/").split(/,\s*(?=default-src)/);
    for (const policy of policies)
      for (const kind of ["script", "style"]) {
        const sources = policy.match(new RegExp(`${kind}-src ([^;]+)`))?.[1];
        if (!hashes[kind].every((hash) => sources?.split(" ").includes(hash)))
          throw new Error(`_headers: the CSP blocks the map's own ${kind}`);
      }
  }
  const document = firstPaint(html);
  const stage = document.querySelector("[data-first-stage]");
  if (!stage?.hasAttribute("data-measured"))
    throw new Error("index.html: its script did not place the national level");
  const badges = [...stage.querySelectorAll(".level-badge")].map((badge) => ({
    id: badge.dataset.choice,
    label: badge.getAttribute("aria-label"),
    x: parseFloat(badge.style.left),
    y: parseFloat(badge.style.top),
  }));
  if (
    !badges.length ||
    !badges.every(
      ({ x, y, label }) =>
        x > 0 && x < 412 && y > 72 && y < 915 && /\d+枚$/.test(label),
    ) ||
    !stage.querySelector("path")?.getAttribute("transform")
  )
    throw new Error("index.html: the national level is not drawn on a phone");
  document.defaultView.close();
  return badges;
}
