import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./style.css";

void import("./app").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(createElement(App));
});
