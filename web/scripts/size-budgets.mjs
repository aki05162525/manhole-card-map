// Bytes, Brotli quality 11, without depending on generated chunk hashes.
// "all …" budgets sum every page's assets, shared and lazy chunks included, so
// they catch growth anywhere. "map entry CSS" sums only the stylesheets that
// index.html links, so growth on map startup shows up on its own.
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
  // signed-in records panel add about 2.3 kB, none of it in the map entry.
  // Shared rules live in shared/ui/controls.css to keep one copy.
  { name: "all CSS", pattern: /\/assets\/.*\.css$/, limit: 57_000 },
  // 29,608 bytes in both account builds at the redesign, plus 2%.
  {
    name: "map entry CSS",
    pattern: /\/assets\/.*\.css$/,
    entry: "index.html",
    limit: 30_200,
  },
];
export function checkBudgets(rows, limits = budgets) {
  return limits.map(({ name, pattern, entry, limit }) => {
    const matches = rows.filter(
      (row) =>
        pattern.test(row.file) && (!entry || row.entries?.includes(entry)),
    );
    if (!matches.length) throw new Error(`${name}: missing budget inputs`);
    const bytes = matches.reduce((total, row) => total + row.brotli, 0);
    if (!Number.isFinite(bytes) || bytes > limit)
      throw new Error(
        `${name}: ${bytes} bytes exceeds ${limit} bytes Brotli budget`,
      );
    return { name, brotli: bytes, limit };
  });
}

/** Stylesheet hrefs an HTML page links (not preloads or other links). */
export function linkedStylesheets(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)]
    .map(([tag]) => tag)
    .filter((tag) => /\brel=["']?stylesheet\b/i.test(tag))
    .map((tag) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1])
    .filter(Boolean);
}
