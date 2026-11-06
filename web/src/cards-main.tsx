import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CardsPage } from "./cards-page";
import "@fontsource-variable/noto-sans-jp/wght.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CardsPage />
  </StrictMode>,
);
