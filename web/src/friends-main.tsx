import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { FriendsPage } from "./pages/friends/friends-page";
import { startScreens } from "./app/app";
import FriendsScreen from "./app/friends-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./shared/ui/controls.css";
import "./pages/account/account.css";
import "./pages/friends/friends.css";

const root = document.getElementById("root")!;
// The build flag turns the switch to the other screens off (`app/app.tsx`).
if (import.meta.env.VITE_SCREEN_SWITCH === "false")
  renderDocument(
    root,
    <StrictMode>
      <FriendsPage />
    </StrictMode>,
  );
else
  startScreens(root, "friends", FriendsScreen, Number(root.dataset.cardCount));
