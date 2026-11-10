import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { TermsPage } from "./pages/terms/terms-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./shared/ui/static-pages.css";

renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <TermsPage />
  </StrictMode>,
);
