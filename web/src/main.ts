import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const engine = new URLSearchParams(location.search).get("engine");
if (engine && ["a", "b", "c", "d"].includes(engine)) {
  location.replace(`/legacy.html${location.search}`);
} else {
  void import("./app").then(({ default: App }) => {
    createRoot(document.getElementById("root")!).render(createElement(App));
  });
}
