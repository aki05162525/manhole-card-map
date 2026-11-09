import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MapLegend } from "./map-legend";
import { labels } from "../../shared/ui/labels";
import { mapPalette } from "./map-theme";
const container = document.createElement("div");
vi.mock("../../components/ui/map", () => {
  const map = { getContainer: () => container };
  return { useMap: () => ({ map, isLoaded: true }) };
});
afterEach(() => {
  cleanup();
  container.replaceChildren();
  container.remove();
});
it("puts all pin symbols inside attribution, keeping attribution links intact", () => {
  container.innerHTML =
    '<details class="maplibregl-ctrl-attrib maplibregl-compact" open><summary aria-label="Toggle attribution"></summary><div class="maplibregl-ctrl-attrib-inner"><a href="https://example.com">出典</a></div></details>';
  document.body.append(container);
  const { unmount } = render(<MapLegend />);
  const legend = screen.getByRole("region", { name: "地図の凡例" });
  expect(legend.closest(".maplibregl-ctrl-attrib")).toBeTruthy();
  for (const label of Object.values(labels))
    expect(within(legend).getByText(label)).toBeTruthy();
  expect(within(legend).getByText("配布場所")).toBeTruthy();
  expect(within(legend).getByText("蓋")).toBeTruthy();
  for (const dark of [false, true])
    for (const color of Object.values(mapPalette(dark).pins))
      expect(legend.innerHTML).toContain(color);
  expect(legend.textContent).not.toMatch(/在庫|基準日|非公式|数字/);
  expect(screen.getByRole("link", { name: "出典" }).getAttribute("href")).toBe(
    "https://example.com",
  );
  container.querySelector(".maplibregl-ctrl-attrib-inner")!.innerHTML =
    "更新した帰属情報";
  expect(screen.getByRole("region", { name: "地図の凡例" })).toBe(legend);
  unmount();
  expect(container.querySelector(".map-attribution-legend")).toBeNull();
});
