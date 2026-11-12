import "./shared/ui/tokens.css";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/noto-sans-jp/wght.css";
import "./pages/map/style.css";

const root = document.getElementById("root")!;
// A friend's map stays a document of its own, and the build flag turns the
// switch between the map and the catalog off (`app/app.tsx`).
if (
  import.meta.env.VITE_SCREEN_SWITCH === "false" ||
  (import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    new URLSearchParams(location.search).has("friend"))
)
  void import("./pages/map/map-page").then(({ default: App }) => {
    createRoot(root).render(createElement(App));
  });
else
  void Promise.all([import("./app/app"), import("./app/map-screen")]).then(
    async ([app, screen]) => {
      await app.prepareRecords();
      app.startScreens(root, "map", screen.default);
    },
  );
