import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: { outDir: mode === "fixture" ? "dist-fixture" : "dist" },
}));
