// The map's first paint, from its HTML alone: the search bar and the
// national level (`src/pages/map/map-shell.tsx`), placed by a script the
// HTML carries (`src/map-stage-main.ts`), and styled by the rules they use,
// written into the HTML. The page's stylesheets are linked after them, so
// the first paint waits for no file (`checkFirstPaint`).
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { parse } from "postcss";
import { build } from "vite";

const web = fileURLToPath(new URL("../../", import.meta.url));

const prefecturesFile = fileURLToPath(
  new URL("../../src/prefectures.ts", import.meta.url),
);
/**
 * The prefectures as the HTML's script reads them: it draws the national
 * level alone, and never fits a prefecture's bounds, the bulk of the table.
 */
const regionsOnly = {
  name: "prefectures-without-bounds",
  enforce: "pre",
  async load(id) {
    if (id !== prefecturesFile) return null;
    const { prefectures, areas } = await import(prefecturesFile);
    const named = prefectures.map(({ code, name, area, badge }) => ({
      code,
      name,
      area,
      badge,
    }));
    return `export const prefectures = ${JSON.stringify(named)};\nexport const areas = ${JSON.stringify(areas)};`;
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
        prune(node);
        if (!node.nodes.length) node.remove();
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
  // What is left empty.
  const empty = (node) =>
    (node.type === "rule" ||
      (node.type === "atrule" && grouping.has(node.name) && node.nodes)) &&
    !node.nodes.length;
  for (let removed = true; removed;) {
    removed = false;
    root.walk((node) => {
      if (empty(node)) {
        node.remove();
        removed = true;
      }
    });
  }
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

/** `headers` (`_headers`) with the CSP allowing `hashes` too. */
export function withCspHashes(headers, hashes) {
  let found = 0;
  const allowed = headers.replace(
    /^( {2}Content-Security-Policy: .*)$/m,
    (line) => {
      found++;
      return line.replace(/\b(script|style)-src 'self'/g, (directive, kind) =>
        [directive, ...hashes[kind]].join(" "),
      );
    },
  );
  if (found !== 1 || !allowed.includes("script-src 'self'"))
    throw new Error("_headers: one CSP with script-src and style-src 'self'");
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
 * entry's `state`, on a phone (412×915, the search bar 72px deep). Only the
 * HTML's own scripts run: no file it names is read.
 */
export function firstPaint(
  html,
  { url = "https://example.test/", state } = {},
) {
  return new JSDOM(html, {
    url,
    runScripts: "dangerously",
    beforeParse(window) {
      if (state !== undefined) window.history.replaceState(state, "");
      window.HTMLElement.prototype.getBoundingClientRect = function () {
        const stage = this.matches(".map-stage, .level-stage");
        const bar = this.matches(".map-search-bar");
        return new window.DOMRect(
          0,
          0,
          stage ? 412 : 0,
          stage ? 915 : bar ? 72 : 0,
        );
      };
    },
  }).window.document;
}

/**
 * Checks that the map's `html` draws its first view by itself: no
 * stylesheet holds its first paint back, and its own script, run with no
 * other file, places the national level on a phone (`firstPaint`) with the
 * public counts. With `headers` (`_headers`), the CSP allows that script
 * and style. Returns the badges as placed.
 */
export function checkFirstPaint(html, { headers } = {}) {
  const head = html.slice(0, html.indexOf("</head>"));
  if (/<link\b[^>]*\brel="stylesheet"/.test(head))
    throw new Error("index.html: a stylesheet holds the first paint back");
  const hashes = inlineHashes(html);
  if (hashes.script.length !== 1 || hashes.style.length !== 1)
    throw new Error("index.html: one script and one style of its own");
  if (headers !== undefined) {
    const policy = headers.match(/^ {2}Content-Security-Policy: (.+)$/m)?.[1];
    for (const kind of ["script", "style"]) {
      const sources = policy?.match(new RegExp(`${kind}-src ([^;]+)`))?.[1];
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
