import "./shared/ui/tokens.css";
import { StrictMode } from "react";
import { renderDocument } from "./shared/browser/render-document";
import { CardsPage } from "./pages/cards/cards-page";
import { readCatalogSummary } from "./domain/catalog-summary";
import { preloadRecords } from "./features/records/records-entry";
import { signedIn } from "./shared/browser/signed-in";
import { startScreens } from "./app/app";
import CatalogScreen, { catalogSummary } from "./app/catalog-screen";
import "@fontsource-variable/noto-sans-jp/wght.css";

// A signed-in page wraps the content in the records feature, a lazy chunk.
// Loaded before the first render, it cannot suspend that render and leave
// the first paint without the content; a failure is left for the boundary.
if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && signedIn())
  await preloadRecords().catch(() => undefined);

const root = document.getElementById("root")!;
if (import.meta.env.VITE_SCREEN_SWITCH === "false")
  renderDocument(
    root,
    <StrictMode>
      <CardsPage summary={readCatalogSummary(root.dataset)} />
    </StrictMode>,
  );
else
  startScreens(
    root,
    "catalog",
    CatalogScreen,
    Object.values(catalogSummary?.totals ?? {}).reduce((a, b) => a + b, 0),
  );
