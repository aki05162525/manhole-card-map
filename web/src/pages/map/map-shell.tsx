import { renderToStaticMarkup } from "react-dom/server";
import { MapShell } from "./search-bar-parts";

// Loaded by the build only (`scripts/build/generate-static-pages.mjs`): the
// page's script never imports the server renderer.

/** The map's first paint, as markup for its HTML. */
export const renderMapShell = () => renderToStaticMarkup(<MapShell />);

/** The map's HTML with `shell` in the root the script later renders into. */
export function withMapShell(html: string, shell: string) {
  const root = /(<div id="root"[^>]*>)<\/div>/;
  if (!root.test(html)) throw new Error("index.html: no empty #root to fill");
  return html.replace(root, (_, open: string) => `${open}${shell}</div>`);
}
