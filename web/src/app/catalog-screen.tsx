import { StrictMode } from "react";
import { CardsPage } from "../pages/cards/cards-page";
import { readCatalogSummary } from "../domain/catalog-summary";
import { applyDocumentMeta, prefectureMeta, screenMeta } from "./document-meta";

/**
 * `cards.html` carries the build's summary on its root, so the first view
 * needs no data. Opened from the map, the root has none, and the map has
 * usually loaded the data already.
 */
export const catalogSummary = readCatalogSummary(
  document.getElementById("root")?.dataset ?? {},
);
/**
 * The head names the list on view: a prefecture's, as that prefecture's
 * own HTML does, or the whole list's. The URL changes within the screen, so
 * the screen says when.
 */
const showHead = (pref: string | null) =>
  applyDocumentMeta(prefectureMeta(pref) ?? screenMeta.catalog(0));
export default function CatalogScreen() {
  return (
    <StrictMode>
      <CardsPage summary={catalogSummary} onPrefecture={showHead} />
    </StrictMode>
  );
}
