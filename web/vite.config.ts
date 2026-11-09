import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";

import { fixtureData } from "./scripts/fixtures";
import { summarizeAbout } from "./src/pages/about/about-summary";

export default defineConfig(({ mode, command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "about-data-summary",
      async transformIndexHtml(html, context) {
        if (!context.filename.endsWith("/about.html")) return html;
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
        return html.replace(
          "data-about-summary",
          `data-card-count="${summary.cardCount}" data-place-count="${summary.placeCount}" data-as-of="${summary.asOf}" data-fixture="${summary.fixture}"`,
        );
      },
    },
    {
      name: "local-maplibre-worker",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!/^\/maplibre-gl-(worker|shared)\.mjs$/.test(req.url || ""))
            return next();
          try {
            const bytes = await readFile(
              new URL(
                `./node_modules/maplibre-gl/dist${req.url}`,
                import.meta.url,
              ),
            );
            res.setHeader("Content-Type", "text/javascript");
            res.end(bytes);
          } catch (error) {
            next(error);
          }
        });
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
      },
    },
    outDir: mode === "fixture" ? "dist-fixture" : "dist",
  },
}));
