import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Remove once the first behavior tests land. No placeholder tests.
    passWithNoTests: true,
  },
});
