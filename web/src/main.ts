import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

void import("./app").then(({ default: App }) => {
  createRoot(document.getElementById("root")!).render(createElement(App));
});
