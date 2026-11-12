import { StrictMode } from "react";
import { CardsPage } from "../pages/cards/cards-page";
import { readCatalogSummary } from "../domain/catalog-summary";

/**
 * `cards.html` carries the build's summary on its root, so the first view
 * needs no data. Opened from the map, the root has none, and the map has
 * usually loaded the data already.
 */
export const catalogSummary = readCatalogSummary(
  document.getElementById("root")?.dataset ?? {},
);
export default function CatalogScreen() {
  return (
    <StrictMode>
      <CardsPage summary={catalogSummary} />
    </StrictMode>
  );
}
