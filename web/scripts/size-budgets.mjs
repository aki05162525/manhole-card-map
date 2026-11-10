// Bytes, Brotli quality 11. All-page totals conservatively bound map startup,
// including shared/dynamic chunks, without depending on generated chunk hashes.
export const budgets = [
  {
    name: "module worker",
    pattern: /\/assets\/maplibre-gl-worker-.*\.m?js$/,
    limit: 130_000,
  },
  { name: "all JavaScript", pattern: /\/assets\/.*\.m?js$/, limit: 520_000 },
  {
    name: "MapLibre",
    pattern: /\/assets\/maplibre-gl-(?!worker-).*\.m?js$/,
    limit: 250_000,
  },
  // 57 kB since the collected-records redesign: the account pages and the
  // signed-in records panel add about 2.3 kB, none of it on signed-out map
  // startup. Shared rules live in shared/ui/controls.css to keep one copy.
  { name: "all CSS", pattern: /\/assets\/.*\.css$/, limit: 57_000 },
  {
    name: "legacy worker",
    pattern: /\/maplibre-gl-(worker|shared)\.mjs$/,
    limit: 130_000,
  },
];
export function checkBudgets(rows, limits = budgets) {
  return limits.map(({ name, pattern, limit }) => {
    const matches = rows.filter((row) => pattern.test(row.file));
    if (!matches.length) throw new Error(`${name}: missing budget inputs`);
    const bytes = matches.reduce((total, row) => total + row.brotli, 0);
    if (!Number.isFinite(bytes) || bytes > limit)
      throw new Error(
        `${name}: ${bytes} bytes exceeds ${limit} bytes Brotli budget`,
      );
    return { name, brotli: bytes, limit };
  });
}
