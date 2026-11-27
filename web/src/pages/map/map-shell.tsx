import { renderToStaticMarkup } from "react-dom/server";
import type { LevelCounts } from "../../domain/map-summary";
import { NationalStageShell } from "../../features/map/level-stage";
import { MapShell } from "./search-bar-parts";

// Loaded by the build only (`scripts/build/first-paint.mjs`): the page's
// script never imports the server renderer.

/**
 * The map's first paint, as markup for its HTML: the search bar, and the
 * national level with the public `counts`, which the HTML's own script
 * places, or takes away where the page opens elsewhere (`first-stage.ts`).
 */
export const renderMapShell = (counts: LevelCounts) =>
  renderToStaticMarkup(
    <MapShell>
      <NationalStageShell counts={counts} />
    </MapShell>,
  );

/**
 * The map's HTML with `shell` in the root the script later renders into,
 * and `script` (the HTML's own) run right after it.
 */
export function withMapShell(html: string, shell: string, script = "") {
  const root = /(<div id="root"[^>]*>)<\/div>/;
  if (!root.test(html)) throw new Error("index.html: no empty #root to fill");
  if (/<\/script/i.test(script))
    throw new Error("The map's own script cannot close its element");
  return html.replace(
    root,
    (_, open: string) =>
      `${open}${shell}</div>${script && `<script>${script}</script>`}`,
  );
}
