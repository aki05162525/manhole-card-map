import "./shared/ui/tokens.css";
import { prepareRecords, startScreens } from "./app/app";
import CatalogScreen, { catalogSummary } from "./app/catalog-screen";

await prepareRecords();

const root = document.getElementById("root")!;
startScreens(
  root,
  "catalog",
  CatalogScreen,
  Object.values(catalogSummary?.totals ?? {}).reduce((a, b) => a + b, 0),
);
