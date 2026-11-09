import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { AboutPage } from "./pages/about/about-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/about/about.css";

const root = document.getElementById("root")!;
const summary = root.dataset.asOf
  ? {
      cardCount: Number(root.dataset.cardCount),
      placeCount: Number(root.dataset.placeCount),
      asOf: root.dataset.asOf,
      fixture: root.dataset.fixture === "true",
    }
  : undefined;
renderDocument(
  root,
  <StrictMode>
    <AboutPage summary={summary} />
  </StrictMode>,
);
