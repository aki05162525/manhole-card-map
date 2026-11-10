import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { AccountPage } from "./pages/account/account-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/account/account.css";

renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <AccountPage />
  </StrictMode>,
);
