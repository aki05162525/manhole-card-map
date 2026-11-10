import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createServer } from "vite";

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
    const fontFiles = [];
    for (const name of await readdir(`${output}/assets`)) {
      if (!name.endsWith(".css")) continue;
      const bytes = await readFile(`${output}/assets/${name}`, "utf8");
      if (bytes.includes("@font-face") && bytes.includes("Noto Sans JP"))
        fontFiles.push(name);
    }
    const css =
      fontFiles.map((name) => `@import url("/assets/${name}");`).join("\n") +
      (
        await Promise.all(
          [
            "src/shared/ui/tokens.css",
            "src/shared/ui/site-header.css",
            "src/shared/ui/site-menu.css",
            "src/shared/ui/static-pages.css",
          ].map((path) =>
            readFile(new URL(`../${path}`, import.meta.url), "utf8"),
          ),
        )
      ).join("\n");
    const hash = createHash("sha256").update(css).digest("hex").slice(0, 12);
    const stylesheet = `/assets/static-pages-${hash}.css`;
    const pages = renderStaticPages(data, stylesheet);
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
