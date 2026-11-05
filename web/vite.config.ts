import { defineConfig } from "vite";

export default defineConfig(({ mode, command }) => ({
  publicDir: command === "serve" ? "public" : false,
  build: { outDir: mode === "fixture" ? "dist-fixture" : "dist" },
}));
