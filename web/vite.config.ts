import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";

import { fixtureData } from "./scripts/fixtures.ts";
import { summarizeAbout } from "./src/pages/about/about-summary.ts";

export default defineConfig(({ mode, command }) => ({
  plugins: [
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
        if (!/\/(?:about|index)\.html$/.test(context.filename)) return html;
        const data =
          mode === "fixture"
            ? fixtureData
            : JSON.parse(
                await readFile(
                  new URL("./public/data/full.json", import.meta.url),
                  "utf8",
                ),
              );
        const summary = summarizeAbout(data);
        return html
          .replaceAll("__CARD_COUNT__", String(summary.cardCount))
          .replace(
            "data-about-summary",
            `data-card-count="${summary.cardCount}" data-place-count="${summary.placeCount}" data-as-of="${summary.asOf}" data-fixture="${summary.fixture}"`,
          );
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
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
}));
