import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { AccountPage } from "./pages/account/account-page";
import { startScreens } from "./app/app";
import AccountScreen from "./app/account-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./shared/ui/controls.css";
import "./pages/account/account.css";

const root = document.getElementById("root")!;
// The build flag turns the switch to the other screens off (`app/app.tsx`).
if (import.meta.env.VITE_SCREEN_SWITCH === "false")
  renderDocument(
    root,
    <StrictMode>
      <AccountPage />
    </StrictMode>,
  );
else
  startScreens(root, "account", AccountScreen, Number(root.dataset.cardCount));
