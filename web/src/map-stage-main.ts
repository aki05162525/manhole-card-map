import { drawFirstStage } from "./pages/map/first-stage";

// Written into the map's HTML after its root, run as the HTML is read and
// before its first paint (`scripts/build/first-paint.mjs`). It loads nothing.
drawFirstStage(document.getElementById("root")!, {
  accounts: import.meta.env.VITE_ACCOUNTS_ENABLED === "true",
});
