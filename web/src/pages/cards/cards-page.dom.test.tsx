import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Data } from "../../domain/types";
import { CardsPage } from "./cards-page";

const data: Data = {
  schema: 1,
  updated: "",
  evaluatedAt: "2026-11-06",
  cards: Array.from({ length: 52 }, (_, index) => ({
    id: `test-${String(index).padStart(3, "0")}`,
    city: index === 51 ? "別の市" : "検索市",
    pref: index === 51 ? "東京都" : "北海道",
    series: "",
    issued: "",
    acquired: "",
    status: index === 0 ? "ended" : "unknown",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
  })),
  places: [
    {
      id: "facility",
      name: "試験施設",
      address: "試験住所",
      phone: "",
      coordinate: { status: "confirmed", lat: 43, lng: 141 },
    },
  ],
  relations: [
    {
      cardId: "test-001",
      placeId: "facility",
      condition: "",
      periodRaw: "",
      alternativeRaw: "",
      review: "verified",
    },
  ],
  pins: [
    {
      id: "facility",
      cardIds: ["test-001"],
      kind: "place",
      pref: "北海道",
      status: "unknown",
      lat: 43,
      lng: 141,
      reference: false,
    },
  ],
};
vi.mock("../../domain/card-catalog", { spy: true });
vi.mock("../../features/card-data/use-catalog-data", () => ({
  useCatalogData: () => ({ data, error: "", fixture: false, reload() {} }),
}));
beforeEach(() => {
  window.history.replaceState({ owner: "preserved" }, "", "/cards.html");
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function traverse(direction: "back" | "forward", search: string) {
  window.history[direction]();
  await waitFor(() => expect(window.location.search).toBe(search));
}
function results() {
  return within(screen.getByRole("region", { name: /枚/ }));
}

it("keeps prefecture, submitted search and pagination in history through back and forward", async () => {
  render(<CardsPage />);
  expect(results().getAllByRole("article")).toHaveLength(50);
  expect(results().getByText("配布施設ピンあり 1枚 ／ なし 51枚")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /北海道.*51.*枚/ }));
  expect(window.location.search).toBe("?pref=01");
  expect(screen.getByRole("combobox")).toHaveProperty("value", "01");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: " 検索市 " },
  });
  expect(window.location.search).toBe("?pref=01");
  fireEvent.submit(screen.getByRole("search"));
  const searched = `?pref=01&q=${encodeURIComponent("検索市")}`;
  expect(window.location.search).toBe(searched);
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  expect(window.location.search).toBe(`${searched}&page=2`);
  expect(results().getAllByRole("article")).toHaveLength(1);
  expect(results().getByText("配布施設ピンあり 1枚 ／ なし 50枚")).toBeTruthy();
  expect(document.activeElement).toBe(
    results().getByRole("heading", { level: 2 }),
  );
  await traverse("back", searched);
  await waitFor(() =>
    expect(results().getAllByRole("article")).toHaveLength(50),
  );
  await traverse("back", "?pref=01");
  await waitFor(() =>
    expect(screen.getByRole("searchbox")).toHaveProperty("value", ""),
  );
  await traverse("back", "");
  await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
  await traverse("forward", "?pref=01");
  await waitFor(() =>
    expect(screen.getByRole("combobox")).toHaveProperty("value", "01"),
  );
  expect(window.history.state.owner).toBe("preserved");
});

it("focuses detail and restores the originating row when closing, including null source fields", async () => {
  render(<CardsPage />);
  const row = screen.getByRole("button", {
    name: /詳細を見る：検索市 test-000/,
  });
  row.focus();
  fireEvent.click(row);
  expect(window.location.search).toBe("?card=test-000");
  const detail = screen.getByRole("region", { name: "検索市" });
  expect(document.activeElement).toBe(
    within(detail).getByRole("heading", { level: 2 }),
  );
  for (const text of ["原文リンクの記載なし", "配布時間の記載なし", "配布終了"])
    expect(within(detail).getByText(text, { exact: false })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  await waitFor(() => expect(document.activeElement).toBe(row));
  expect(window.location.search).toBe("");
  await traverse("forward", "?card=test-000");
  await waitFor(() =>
    expect(document.activeElement?.id).toBe("catalog-detail-title"),
  );
});

it("closes a direct detail URL with replace and falls back to the results heading", () => {
  window.history.replaceState(
    { owner: "direct" },
    "",
    "/cards.html?card=test-000",
  );
  const back = vi.spyOn(window.history, "back");
  render(<CardsPage />);
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  expect(back).not.toHaveBeenCalled();
  expect(window.location.search).toBe("");
  expect(window.history.state.owner).toBe("direct");
  expect(document.activeElement?.id).toBe("catalog-results-title");
});

it("builds the catalog once, reusing it across detail renders", () => {
  render(<CardsPage />);
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole("button", { name: /詳細を見る：検索市 test-000/ }),
  );
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "draft" },
  });
  expect(createCardCatalog).toHaveBeenCalledTimes(1);
});

it("does not rebuild IDs, recount pins or render rows when only draft input changes", () => {
  render(<CardsPage />);
  const catalog = vi.mocked(createCardCatalog).mock.results[0].value;
  const keys = vi.spyOn(catalog.cardsById, "keys");
  const entries = vi.spyOn(catalog.entriesById, "get");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "draft" },
  });
  expect(keys).not.toHaveBeenCalled();
  expect(entries).not.toHaveBeenCalled();
  expect(results().getAllByRole("article")).toHaveLength(50);
});
