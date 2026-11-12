import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

import { dataVersion } from "./scripts/data-version.ts";
import { fixtureData } from "./scripts/fixtures.ts";
import { summarizeAbout } from "./src/pages/about/about-summary.ts";
import {
  embedCatalogSummary,
  summarizeCatalog,
} from "./src/domain/catalog-summary.ts";
import type { Data } from "./src/domain/types.ts";

// The modules the map's first view imports one after another.
const mapChain =
  /\/(?:src\/app\/(?:app|map-screen)|src\/pages\/map\/map-page|src\/features\/map\/card-map)\.tsx$|\/maplibre-gl\/dist\/maplibre-gl\.mjs$/;

// mapcn's light style, which the map uses without VITE_MAP_STYLE_URL
// (`components/ui/map.tsx`, `features/map/card-map.tsx`).
const defaultStyle =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
/** Where the map's style and tiles come from, for its connections. */
function basemapOrigins(style: string) {
  let origin: string;
  try {
    origin = new URL(style).origin;
  } catch {
    // A style on the site itself needs no connection of its own.
    return [];
  }
  // CARTO serves the tiles, sprites and glyphs from a host of their own.
  return origin === "https://basemaps.cartocdn.com"
    ? [origin, "https://tiles.basemaps.cartocdn.com"]
    : [origin];
}

export default defineConfig(({ mode, command }) => {
  // Read on first use in a hook, so that tools which only load this file
  // need no data. Fixture and dev data keep the plain, revalidated URL.
  let version: string | undefined;
  const generation = () =>
    (version ??=
      command === "build" && mode !== "fixture"
        ? dataVersion(
            readFileSync(
              new URL("./public/data/manifest.json", import.meta.url),
            ),
          )
        : "");
  // One read per build; the dev server reads again for each page, so data
  // regenerated while it runs reaches the HTML.
  let full: Promise<Data> | undefined;
  const readFull = (): Promise<Data> =>
    mode === "fixture"
      ? Promise.resolve(fixtureData)
      : readFile(
          new URL("./public/data/full.json", import.meta.url),
          "utf8",
        ).then(JSON.parse);
  const fullData = () =>
    command === "build" ? (full ??= readFull()) : readFull();
  return {
    plugins: [
      {
        name: "data-version",
        config: () => ({
          define: {
            "import.meta.env.VITE_DATA_VERSION": JSON.stringify(generation()),
          },
        }),
      },
      {
        // The page's own fetch (`features/card-data/card-data.ts`), started
        // with the HTML: the map's pins (its details wait for the map), the
        // catalog's full data. `crossorigin` keeps fetch()'s same-origin
        // credentials, so the browser hands this response to that fetch.
        name: "card-data-preload",
        transformIndexHtml: {
          order: "post",
          handler(html, context) {
            const page = /\/(index|cards)\.html$/.exec(context.filename)?.[1];
            if (!page) return html;
            const name = generation();
            const file = page === "index" ? "pins" : "full";
            return {
              html,
              tags: [
                {
                  tag: "link",
                  attrs: {
                    rel: "preload",
                    as: "fetch",
                    href: name
                      ? `/data-v/${name}/${file}.json`
                      : `/data/${file}.json`,
                    crossorigin: true,
                  },
                  injectTo: "head",
                },
              ],
            };
          },
        },
      },
      {
        // The map's first requests after its code go to the basemap: open
        // those connections with the HTML. The fixture's blank style is the
        // site's own; the other pages draw no map (`scripts/check-deploy.mjs`).
        name: "basemap-preconnect",
        transformIndexHtml: {
          order: "post",
          handler(html, { filename }) {
            if (!filename.endsWith("/index.html") || mode === "fixture")
              return html;
            const style =
              loadEnv(
                mode,
                fileURLToPath(new URL(".", import.meta.url)),
                "VITE_",
              ).VITE_MAP_STYLE_URL || defaultStyle;
            return {
              html,
              tags: basemapOrigins(style).map((href) => ({
                tag: "link",
                attrs: { rel: "preconnect", href, crossorigin: true },
                injectTo: "head" as const,
              })),
            };
          },
        },
      },
      {
        // The map is found at the end of a chain of imports (main → app and
        // map-screen → card-map → maplibre-gl), seconds into a slow first
        // visit. The map's page names those files and their CSS for the
        // browser to fetch with the HTML; the other pages load no map code
        // before a switch (`scripts/check-deploy.mjs`).
        name: "map-chunk-preload",
        apply: "build",
        transformIndexHtml: {
          order: "post",
          handler(html, { filename, bundle }) {
            if (!filename.endsWith("/index.html") || !bundle) return html;
            const chunks = Object.values(bundle).filter(
              (output) => output.type === "chunk",
            );
            const files = new Map<string, "script" | "style">();
            const visit = (chunk: (typeof chunks)[number]) => {
              if (files.has(chunk.fileName)) return;
              files.set(chunk.fileName, "script");
              for (const css of chunk.viteMetadata?.importedCss ?? [])
                files.set(css, "style");
              for (const name of chunk.imports) {
                const next = chunks.find((item) => item.fileName === name);
                if (next) visit(next);
              }
            };
            for (const chunk of chunks)
              if (
                chunk.facadeModuleId &&
                mapChain.test(chunk.facadeModuleId.replaceAll("\\", "/"))
              )
                visit(chunk);
            // MapLibre's module worker is left out: Chromium preloads none.
            return {
              html,
              tags: [...files]
                // What the HTML names already (the entry's own imports).
                .filter(([file]) => !html.includes(`/${file}"`))
                .map(([file, kind]) => ({
                  tag: "link",
                  attrs:
                    kind === "style"
                      ? {
                          rel: "preload",
                          as: "style",
                          href: `/${file}`,
                          crossorigin: true,
                        }
                      : {
                          rel: "modulepreload",
                          href: `/${file}`,
                          crossorigin: true,
                        },
                  injectTo: "head" as const,
                })),
            };
          },
        },
      },
      {
        name: "seo-assets",
        async generateBundle() {
          for (const fileName of [
            "og-image.png",
            "apple-touch-icon.png",
            "site.webmanifest",
          ]) {
            this.emitFile({
              type: "asset",
              fileName,
              source: await readFile(
                new URL("./public/" + fileName, import.meta.url),
              ),
            });
          }
        },
      },
      react(),
      tailwindcss(),
      {
        name: "document-render-block",
        transformIndexHtml: {
          order: "post",
          handler(html, context) {
            if (
              !/\/(?:about|cards|404|account|terms|friends|invite)\.html$/.test(
                context.filename,
              )
            )
              return html;
            // Vite emits fresh module tags and drops the source tag's attributes.
            return html.replace(
              /<script\b(?=[^>]*\btype="module")(?![^>]*\bblocking=)/g,
              '<script blocking="render"',
            );
          },
        },
      },
      {
        name: "about-data-summary",
        async transformIndexHtml(html, context) {
          if (context.filename.endsWith("/cards.html"))
            return embedCatalogSummary(
              html,
              summarizeCatalog(await fullData()),
            );
          // The friends and the account name the count for the map's head
          // (`src/app/document-meta.ts`).
          if (
            !/\/(?:about|index|friends|account)\.html$/.test(context.filename)
          )
            return html;
          const summary = summarizeAbout(await fullData());
          return html
            .replaceAll("__CARD_COUNT__", String(summary.cardCount))
            .replace(
              "data-about-summary",
              `data-card-count="${summary.cardCount}" data-place-count="${summary.placeCount}" data-as-of="${summary.asOf}" data-fixture="${summary.fixture}"`,
            );
        },
      },
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    publicDir: command === "serve" ? "public" : false,
    build: {
      rolldownOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          cards: fileURLToPath(new URL("./cards.html", import.meta.url)),
          notFound: fileURLToPath(new URL("./404.html", import.meta.url)),
          about: fileURLToPath(new URL("./about.html", import.meta.url)),
          account: fileURLToPath(new URL("./account.html", import.meta.url)),
          friends: fileURLToPath(new URL("./friends.html", import.meta.url)),
          invite: fileURLToPath(
            new URL("./friends/invite.html", import.meta.url),
          ),
          terms: fileURLToPath(new URL("./terms.html", import.meta.url)),
        },
      },
      outDir: mode === "fixture" ? "dist-fixture" : "dist",
    },
  };
});
