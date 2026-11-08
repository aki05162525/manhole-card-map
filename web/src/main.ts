import "./shared/ui/tokens.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/map/style.css";

void import("./pages/map/map-page").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(createElement(App));
});
