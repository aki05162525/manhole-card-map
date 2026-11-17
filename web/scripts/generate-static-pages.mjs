import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createServer } from "vite";
import { linkedStylesheets } from "./size-budgets.mjs";

export async function generateStaticPages(output) {
  // Vite resolves the same TSX/CSS modules as the app; no listening HTTP server.
  const root = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({
    root,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: "custom",
  });
  try {
    const { renderStaticPages } = await server.ssrLoadModule(
      "/scripts/static-pages.tsx",
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
    const css = await readFile(
      new URL("../src/shared/ui/generated-pages.css", import.meta.url),
      "utf8",
    );
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
    console.log(
      `Static pages: ${pages.size - 2} HTML documents, sitemap.xml, robots.txt`,
    );
  } finally {
    await server.close();
  }
}
