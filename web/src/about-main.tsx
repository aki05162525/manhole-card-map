import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AboutPage } from "./pages/about/about-page";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/about/about.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AboutPage />
  </StrictMode>,
);
