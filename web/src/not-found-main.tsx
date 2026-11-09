import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import "@fontsource-variable/noto-sans-jp/wght.css";
import { NotFoundPage } from "./pages/not-found/not-found-page";
import "./pages/not-found/not-found.css";

renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <NotFoundPage />
  </StrictMode>,
);
