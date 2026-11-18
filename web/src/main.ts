import "./shared/ui/tokens.css";
import "@fontsource-variable/noto-sans-jp/wght.css";

const root = document.getElementById("root")!;
void Promise.all([import("./app/app"), import("./app/map-screen")]).then(
  async ([app, screen]) => {
    await app.prepareRecords();
    app.startScreens(root, "map", screen.default);
  },
);
