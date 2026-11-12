import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { build } from "vite";

// The map, the list and the account pages will share one document, and a
// stylesheet stays after its screen is left. A rule that names no class, id
// or attribute reaches every screen, so only the shared ones below may exist.
// `--*` stands for custom properties, which change nothing by themselves.
const shared: Record<string, string[]> = {
  // shared/ui/tokens.css, loaded by every page.
  ":root": [
    "--*",
    "color-scheme",
    "color",
    "background",
    "font",
    "font-synthesis",
    "letter-spacing",
    "font-variant-numeric",
  ],
  body: ["margin"],
  p: ["word-break", "text-wrap"],
  li: ["word-break", "text-wrap"],
  ...Object.fromEntries(
    ["h1", "h2", "h3", "h4", "h5", "h6"].map((heading) => [
      heading,
      ["word-break", "font-feature-settings", "text-wrap"],
    ]),
  ),
  ":is(:root,.cards-page,.map-search-bar,.map-search-dialog) :focus-visible": [
    "outline",
    "outline-offset",
    "box-shadow",
  ],
  button: ["transition"],
  ":is(button:enabled,.map-link,.catalog-map-link,.logo-link):active": [
    "transform",
    "box-shadow",
    "transition-duration",
  ],
  "input::placeholder": ["color", "opacity"],
  // shared/ui/document-transitions.css.
  "::view-transition-old(site-band)": ["display"],
  "::view-transition-new(site-band)": [
    "height",
    "object-fit",
    "object-position",
  ],
  "::view-transition-group(*)": ["animation-duration"],
  "::view-transition-old(root)": ["animation-duration"],
  "::view-transition-new(root)": ["animation-duration"],
  // Tailwind's theme variables and the fallback for registered properties.
  ":host": ["--*"],
  "*": ["--*"],
  ":before": ["--*"],
  ":after": ["--*"],
  "::backdrop": ["--*"],
};

type Rule = { selector: string; properties: string[] };

function split(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!;
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth++;
    else if (char === ")" || char === "]" || char === "}") depth--;
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** Style rules of minified CSS, with `&` of nested rules written out. */
function rules(css: string, parent = ""): Rule[] {
  const found: Rule[] = [];
  const own: string[] = [];
  let rest = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  while (rest.trim()) {
    // A statement ends at `;`, or at the `}` closing its block.
    let depth = 0;
    let quote = "";
    let end = rest.length;
    let open = -1;
    for (let index = 0; index < rest.length; index++) {
      const char = rest[index]!;
      if (quote) {
        if (char === "\\") index++;
        else if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "(" || char === "[") depth++;
      else if (char === ")" || char === "]") depth--;
      else if (char === "{") {
        if (depth === 0 && open < 0) open = index;
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0 && open >= 0) {
          end = index + 1;
          break;
        }
      } else if (char === ";" && depth === 0) {
        end = index + 1;
        break;
      }
    }
    const statement = rest.slice(0, end).trim();
    rest = rest.slice(end);
    if (open < 0) {
      const property = statement.split(":")[0]!.trim();
      if (property && !statement.startsWith("@")) own.push(property);
      continue;
    }
    const prelude = statement.slice(0, statement.indexOf("{")).trim();
    const body = statement.slice(statement.indexOf("{") + 1, -1);
    if (/^@(?:media|supports|layer|container|starting-style)\b/.test(prelude))
      found.push(...rules(body, parent));
    else if (!prelude.startsWith("@"))
      for (const selector of split(prelude, ","))
        found.push(
          ...rules(
            body,
            !parent
              ? selector
              : selector.includes("&")
                ? selector.replaceAll("&", parent)
                : `${parent} ${selector}`,
          ),
        );
  }
  if (parent && own.length) found.push({ selector: parent, properties: own });
  return found;
}

/** Whether every element the selector matches is named by a class, id or attribute. */
function anchored(selector: string): boolean {
  let outside = "";
  const groups: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index]!;
    if (char === "(") {
      if (depth === 0) start = index + 1;
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) {
        const name = outside.match(/:{1,2}[\w-]+$/)?.[0] ?? "";
        if (name === ":is" || name === ":where")
          groups.push(selector.slice(start, index));
      }
    } else if (depth === 0) outside += char;
  }
  return (
    /[.#[]/.test(outside) ||
    groups.some((group) => split(group, ",").every(anchored))
  );
}

it("leaves no rule that reaches other screens, except the shared ones", async () => {
  const result = await build({
    mode: "fixture",
    logLevel: "silent",
    // Includes the signed-in records styles.
    define: { "import.meta.env.VITE_ACCOUNTS_ENABLED": '"true"' },
    build: { write: false },
  });
  const css = (Array.isArray(result) ? result : [result])
    .flatMap((bundle) => ("output" in bundle ? bundle.output : []))
    .filter(
      (asset) => asset.type === "asset" && asset.fileName.endsWith(".css"),
    )
    .map((asset) => (asset.type === "asset" ? String(asset.source) : ""));
  expect(css.length).toBeGreaterThan(5);
  const leaks = new Set<string>();
  const used = new Set<string>();
  for (const sheet of css)
    for (const { selector, properties } of rules(sheet)) {
      if (anchored(selector)) continue;
      const allowed = shared[selector] ?? [];
      for (const property of properties) {
        const name = property.startsWith("--") ? "--*" : property;
        if (allowed.includes(name)) used.add(`${selector} { ${name} }`);
        else leaks.add(`${selector} { ${property} }`);
      }
    }
  expect([...leaks].sort()).toEqual([]);
  // An entry nothing uses would let that rule come back unnoticed.
  expect(
    Object.entries(shared).flatMap(([selector, properties]) =>
      properties
        .map((property) => `${selector} { ${property} }`)
        .filter((entry) => !used.has(entry)),
    ),
  ).toEqual([]);
}, 60_000);

it("keeps the map's preflight copy in step with Tailwind's", async () => {
  // pages/map/preflight.css is Tailwind's preflight.css nested under the map
  // screen. When this fails, bring upstream's change over, then update the hash.
  const upstream = await readFile(
    new URL("../node_modules/tailwindcss/preflight.css", import.meta.url),
  );
  expect(createHash("sha256").update(upstream).digest("hex")).toBe(
    "ace8310eed6dc5568a56fc16e1d695cf58da7528d81d66d81649e93cce644df6",
  );
});
