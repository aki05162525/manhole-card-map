import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { fixtureData } from "../../../scripts/build/fixtures";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Card } from "../../domain/types";
import { ScreenActivity } from "../../shared/browser/screen-activity";
import { CardDetail } from "./card-detail";

beforeEach(() => {
  // jsdom does not implement the browser's modal dialog methods.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);

const card = fixtureData.cards[0];
const image = {
  path: "/card-images/14-100-B001-0123456789abcdef.webp",
  credit: "旭区役所　地域振興課",
  width: 640,
  height: 855,
};

function detail(shown: Card, variant: "map" | "catalog" = "map") {
  const data = { ...fixtureData, cards: [shown] };
  return (
    <CardDetail
      card={shown}
      data={data}
      catalog={createCardCatalog(data)}
      variant={variant}
    />
  );
}
const renderDetail = (shown: Card, variant?: "map" | "catalog") =>
  render(detail(shown, variant));
const enlarge = () =>
  fireEvent.click(screen.getByRole("button", { name: /を大きく表示$/ }));

it.each(["map", "catalog"] as const)(
  "shows a permitted image whole, with its credit, in %s detail",
  (variant) => {
    const { container } = renderDetail({ ...card, image }, variant);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe(image.path);
    // The size is reserved before the image arrives.
    expect(img.getAttribute("width")).toBe("640");
    expect(img.getAttribute("height")).toBe("855");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("alt")).toContain(card.id);
    // Exactly as the municipality wrote it, full-width space included.
    expect(container.querySelector("figcaption")?.textContent).toBe(
      "画像：旭区役所　地域振興課",
    );
  },
);

it("removes the image and its credit when it fails to load", () => {
  const { container } = renderDetail({ ...card, image });
  fireEvent.error(screen.getByRole("img"));
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByText(/旭区役所/)).toBeNull();
  expect(container.querySelector("figure")).toBeNull();
});

it("shows no image or frame for a card without a permission", () => {
  const { container } = renderDetail(card);
  expect(screen.queryByRole("img")).toBeNull();
  expect(container.querySelector("figure")).toBeNull();
});

it("puts the image before the route, where the summary sheet shows it", () => {
  const { container } = renderDetail({ ...card, image });
  const figure = container.querySelector(".sheet-summary figure")!;
  expect(
    figure.compareDocumentPosition(container.querySelector(".detail-route")!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("enlarges the same image with its credit", () => {
  renderDetail({ ...card, image });
  expect(screen.queryByRole("dialog")).toBeNull();
  enlarge();
  const dialog = screen.getByRole<HTMLDialogElement>("dialog");
  expect(dialog.open).toBe(true);
  const img = within(dialog).getByRole("img");
  // The one file the detail already read.
  expect(img.getAttribute("src")).toBe(image.path);
  expect(img.getAttribute("alt")).toContain(card.id);
  expect(dialog.querySelector("figcaption")?.textContent).toBe(
    "画像：旭区役所　地域振興課",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "閉じる" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("closes on a tap beside the enlarged image, not on the image", () => {
  renderDetail({ ...card, image });
  enlarge();
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("img"));
  expect(screen.queryByRole("dialog")).not.toBeNull();
  fireEvent.click(dialog);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps taps and keys in the enlarged image from the sheet around the detail", () => {
  // The map's sheet widens on a tap in its body and folds on Escape.
  const onClick = vi.fn();
  const onKeyDown = vi.fn();
  render(
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stands in for the sheet's own handlers.
    <div onClick={onClick} onKeyDown={onKeyDown}>
      {detail({ ...card, image })}
    </div>,
  );
  enlarge();
  onClick.mockClear();
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.keyDown(dialog, { key: "Tab" });
  fireEvent.click(within(dialog).getByRole("img"));
  fireEvent.click(dialog);
  expect(onClick).not.toHaveBeenCalled();
  expect(onKeyDown).not.toHaveBeenCalled();
});

it("leaves no modal over another screen while its own is hidden", () => {
  const shown = { ...card, image };
  const { rerender } = render(
    <ScreenActivity value={true}>{detail(shown)}</ScreenActivity>,
  );
  enlarge();
  expect(screen.getByRole<HTMLDialogElement>("dialog").open).toBe(true);
  rerender(<ScreenActivity value={false}>{detail(shown)}</ScreenActivity>);
  expect(document.querySelector("dialog")).toBeNull();
});

it("removes the enlarged image too when the image fails", () => {
  renderDetail({ ...card, image });
  enlarge();
  fireEvent.error(within(screen.getByRole("dialog")).getByRole("img"));
  expect(document.querySelector("dialog")).toBeNull();
  expect(document.querySelector("figure")).toBeNull();
  expect(screen.queryByText(/旭区役所/)).toBeNull();
});
