import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { FriendsPage } from "./pages/friends/friends-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/account/account.css";
import "./pages/friends/friends.css";
renderDocument(
  document.getElementById("root")!,
  <StrictMode>
    <FriendsPage />
  </StrictMode>,
);
