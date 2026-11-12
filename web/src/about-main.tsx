import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { AboutPage } from "./pages/about/about-page";
import { readAboutSummary } from "./pages/about/about-summary";
import { startScreens } from "./app/app";
import AboutScreen from "./app/about-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/about/about.css";

const root = document.getElementById("root")!;
// The build flag turns the switch to the other screens off (`app/app.tsx`).
if (import.meta.env.VITE_SCREEN_SWITCH === "false")
  renderDocument(
    root,
    <StrictMode>
      <AboutPage summary={readAboutSummary(root.dataset)} />
    </StrictMode>,
  );
else startScreens(root, "about", AboutScreen, Number(root.dataset.cardCount));
