import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { CardsPage } from "./pages/cards/cards-page";
import "@fontsource-variable/noto-sans-jp/wght.css";

renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <CardsPage />
  </StrictMode>,
);
