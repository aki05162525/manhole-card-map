import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { TimingSequencer } from "./scripts/ci/ci-tests.ts";

export default defineConfig({
  cacheDir: ".cache/vitest",
  test: {
    sequence: { sequencer: TimingSequencer },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "worker",
          environment: "node",
          include: ["worker/**/*.test.ts"],
          // Worker tests start workerd with local D1 databases, and the
          // authorization matrices send hundreds of requests per test.
          hookTimeout: 60_000,
          testTimeout: 20_000,
        },
      },
      {
        resolve: {
          alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.dom.test.tsx"],
        },
      },
    ],
  },
});
