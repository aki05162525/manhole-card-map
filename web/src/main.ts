import "./shared/ui/tokens.css";

const root = document.getElementById("root")!;
// Direct friend links share the static HTML of the public map.
if (
  import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
  new URLSearchParams(location.search).has("friend")
)
  root.querySelector(".map-search-bar[inert]")?.remove();
void Promise.all([import("./app/app"), import("./app/map-screen")]).then(
  async ([app, screen]) => {
    await app.prepareRecords();
    app.startScreens(root, "map", screen.default);
  },
);
