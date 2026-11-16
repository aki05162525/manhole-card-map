import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fixtureData } from "../../../scripts/fixtures";
import { createCardCatalog } from "../../domain/card-catalog";
import type { Card } from "../../domain/types";
import { CardDetail } from "./card-detail";

afterEach(cleanup);

const card = fixtureData.cards[0]!;
const image = {
  path: "/card-images/14-100-B001-0123456789abcdef.webp",
  credit: "旭区役所　地域振興課",
  width: 640,
  height: 855,
};

function renderDetail(shown: Card, variant: "map" | "catalog" = "map") {
  const data = { ...fixtureData, cards: [shown] };
  return render(
    <CardDetail
      card={shown}
      data={data}
      catalog={createCardCatalog(data)}
      variant={variant}
    />,
  );
}

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
