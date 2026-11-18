import { defineConfig } from "@mizchi/mutator";

// Mutation testing is a refactoring tool, not a CI gate: see README.md.
export default defineConfig({
  // Code that fast in-process tests (node, jsdom) can check.
  include: [
    "src/domain/**/*.{ts,tsx}",
    "src/contract/**/*.{ts,tsx}",
    "src/shared/**/*.{ts,tsx}",
    "src/session/**/*.{ts,tsx}",
    "src/features/**/*.{ts,tsx}",
    // The other Worker files are tested through workerd (test-harness.ts):
    // a run over them took over 15 minutes, so they are left out.
    "worker/card-ids.ts",
    "worker/rows.ts",
  ],
  exclude: [
    "**/*.test.{ts,tsx}",
    "**/*.d.ts",
    // Test helpers.
    "**/fake-*.ts",
    "**/test-*.ts",
  ],
  // The same projects as vitest.config.ts, without the workerd tests.
  vitestConfig: "vitest.mutator.config.ts",
});
