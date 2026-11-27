import "./shared/ui/tokens.css";
import { START_FAILED } from "./pages/map/early-choice";

// The HTML's own script has drawn the first view already, the search bar
// and the national level (`pages/map/first-stage.ts`, `map-stage-main.ts`).
const root = document.getElementById("root")!;
void Promise.all([import("./app/app"), import("./app/map-screen")])
  .then(async ([app, screen]) => {
    await app.prepareRecords();
    app.startScreens(root, "map", screen.default);
  })
  // A region pressed on the HTML's drawing then goes to the list.
  .catch(() => dispatchEvent(new Event(START_FAILED)));
