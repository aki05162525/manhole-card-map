import { defineConfig } from "vite";
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
        // The page's own fetches (`features/card-data/card-data.ts`), started
        // with the HTML: the map's pins and, behind them, its details; the
        // catalog's full data. `crossorigin` keeps fetch()'s same-origin
        // credentials, so the browser hands these responses to those fetches.
        name: "card-data-preload",
        transformIndexHtml: {
          order: "post",
          handler(html, context) {
            const page = /\/(index|cards)\.html$/.exec(context.filename)?.[1];
            if (!page) return html;
            const name = generation();
            const href = (file: string) =>
              name ? `/data-v/${name}/${file}.json` : `/data/${file}.json`;
            const preload = (file: string, low = false) => ({
              tag: "link",
              attrs: {
                rel: "preload",
                as: "fetch",
                href: href(file),
                crossorigin: true,
                ...(low ? { fetchpriority: "low" } : {}),
              },
              injectTo: "head" as const,
            });
            return {
              html,
              tags:
                page === "index"
                  ? [preload("pins"), preload("details", true)]
                  : [preload("full")],
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
