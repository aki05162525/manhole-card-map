import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createServer } from "vite";
import { linkedStylesheets } from "../perf/size-budgets.mjs";

export async function generateStaticPages(output) {
  // Vite resolves the same TSX/CSS modules as the app; no listening HTTP server.
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const server = await createServer({
    root,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
  });
  try {
    const { renderStaticPages } = await server.ssrLoadModule(
      "/src/pages/card/static-pages.tsx",
    );
    const data = JSON.parse(await readFile(`${output}/data/full.json`, "utf8"));
    // The terms page is the same kind of page, built by Vite: its font,
    // tokens, header, menu and text styles serve these pages too, as the
    // files browsers already hold. Only what the generated pages add is
    // written here.
    const shared = linkedStylesheets(
      await readFile(`${output}/terms.html`, "utf8"),
    );
    if (!shared.length)
      throw new Error("Expected the stylesheets of terms.html to reuse");
    // With the state chip's rules, which the pages draw states with.
    const css = (
      await Promise.all(
        [
          "../../src/pages/card/generated-pages.css",
          "../../src/shared/ui/status-chip.css",
        ].map((file) => readFile(new URL(file, import.meta.url), "utf8")),
      )
    ).join("\n");
    const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
    const stylesheet = `/assets/static-pages-${hash}.css`;
    // The entries of vite.config.ts the card pages name, by the names Vite
    // gave them: the record (with accounts) and the image's fallback.
    const assets = await readdir(`${output}/assets`);
    const built = (entry) => {
      const found = assets.filter((name) =>
        new RegExp(`^${entry}-[\\w-]+\\.js$`).test(name),
      );
      if (found.length !== 1)
        throw new Error(`Expected one built ${entry} entry in assets`);
      return `/assets/${found[0]}`;
    };
    const pages = renderStaticPages(data, [...shared, stylesheet], {
      record: built("cardRecord"),
      image: built("cardImage"),
    });
    await mkdir(`${output}/assets`, { recursive: true });
    await writeFile(output + stylesheet, css);
    for (const [path, html] of pages) {
      await mkdir(dirname(`${output}/${path}`), { recursive: true });
      await writeFile(`${output}/${path}`, html);
    }
    // The list's HTML, read by a visitor or a search engine without its
    // script: the prefectures in `cards.html`, and a copy of it for each
    // prefecture at `/pref/<slug>/`, with that prefecture's cards.
    const { renderCatalogPages } = await server.ssrLoadModule(
      "/src/pages/cards/static-catalog.tsx",
    );
    const lists = renderCatalogPages(
      data,
      await readFile(`${output}/cards.html`, "utf8"),
    );
    for (const [path, html] of lists) {
      await mkdir(dirname(`${output}/${path}`), { recursive: true });
      await writeFile(`${output}/${path}`, html);
    }
    console.log(
      `Static pages: ${data.cards.length} card pages, ${lists.size - 1} prefecture lists, sitemap.xml, robots.txt`,
    );
    // The map's HTML shows its search bar before its script has loaded.
    const { renderMapShell, withMapShell } = await server.ssrLoadModule(
      "/src/pages/map/map-shell.tsx",
    );
    const index = `${output}/index.html`;
    await writeFile(
      index,
      withMapShell(await readFile(index, "utf8"), renderMapShell()),
    );
  } finally {
    await server.close();
  }
}
