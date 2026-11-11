import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { CardsPage } from "./pages/cards/cards-page";
import { readCatalogSummary } from "./domain/catalog-summary";
import "@fontsource-variable/noto-sans-jp/wght.css";

const root = document.getElementById("root")!;
renderDocument(
  root,
  <StrictMode>
    <CardsPage summary={readCatalogSummary(root.dataset)} />
  </StrictMode>,
);
