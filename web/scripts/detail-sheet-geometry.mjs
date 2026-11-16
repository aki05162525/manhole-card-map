// Read-only assertions for the real-data browser, at 412 × 915.
// Import in the shared browser and call after fonts and sheet animations settle.
function requireLayout(condition, message) {
  if (!condition) throw new Error(message);
}
function rect(selector) {
  const element = document.querySelector(selector);
  requireLayout(element, `Missing ${selector}`);
  return element.getBoundingClientRect();
}
export function checkFullSheet() {
  requireLayout(
    document.querySelector("#detail.is-full"),
    "Full sheet is required",
  );
  requireLayout(
    document.querySelector(".card-stamp")?.textContent === "01-226-A001",
    "Use the long Sunagawa card",
  );
  requireLayout(
    document.querySelector(".detail-body").scrollTop === 0,
    "Start at the top of full content",
  );
  const footer = rect("#sheet-action-bar");
  requireLayout(
    footer.top > 0 && Math.abs(footer.bottom - innerHeight) <= 2,
    "K1: primary destinations must stay at the viewport bottom",
  );
  const handle = rect(".detail-drag-handle"),
    prelude = rect(".detail-heading");
  requireLayout(
    prelude.top >= handle.bottom,
    "K6: full-view heading must start below the drag handle",
  );
  return { footer: footer.toJSON(), gap: prelude.top - handle.bottom };
}
export function checkSummarySheet({ scaled = false } = {}) {
  const panel = document.querySelector("#detail.is-summary");
  requireLayout(panel, "Summary sheet is required");
  const top = panel.getBoundingClientRect().top;
  const actions = rect(".summary-actions");
  requireLayout(
    innerHeight - top <=
      Math.min(Math.max(innerHeight * 0.56, 352), innerHeight * 0.7, 440) + 2,
    "Summary exceeds its height budget",
  );
  requireLayout(
    actions.bottom <= innerHeight && actions.top >= top,
    "K2: primary actions must be visible",
  );
  requireLayout(
    document.querySelector(".detail-body").scrollTop === 0,
    "Summary must not scroll",
  );
  if (scaled) {
    requireLayout(
      getComputedStyle(document.documentElement).fontSize === "32px",
      "Use 200% text",
    );
    const header = rect(".map-search-bar"),
      entry = rect(".map-search-entry");
    requireLayout(
      entry.top >= header.top &&
        entry.bottom <= header.bottom &&
        entry.right <= header.right,
      "K3: search button must fit inside the search bar",
    );
    // A background without sources (the fixture's) has no attribution to place.
    if (
      document.querySelector(
        ".maplibregl-ctrl-attrib:not(.maplibregl-attrib-empty)",
      )
    ) {
      const attrib = rect(".maplibregl-ctrl-attrib"),
        locate = rect("#locate");
      requireLayout(
        locate.bottom <= attrib.top || locate.left >= attrib.right,
        "K3: attribution must not overlap locate",
      );
    }
  }
  return { top, height: innerHeight - top, buttonBottom: actions.bottom };
}
const overlaps = (a, b) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
/** With a prefecture in focus, on a phone: the breadcrumbs are at the top right. */
export function checkBreadcrumbs() {
  const trail = rect(".map-actions");
  requireLayout(
    trail.left >= 0 && trail.right <= innerWidth,
    "K7: breadcrumbs must stay inside the screen's width",
  );
  requireLayout(
    trail.top >= rect(".map-search-bar").bottom &&
      innerWidth - trail.right <= trail.left,
    "K7: breadcrumbs belong under the search bar, at the right",
  );
  for (const selector of [
    ".map-notices",
    "#locate",
    "#detail",
    ".maplibregl-ctrl-attrib:not(.maplibregl-attrib-empty)",
  ]) {
    const other = document.querySelector(selector);
    requireLayout(
      !other || !overlaps(trail, other.getBoundingClientRect()),
      `K7: breadcrumbs must not overlap ${selector}`,
    );
  }
  return { trail: trail.toJSON() };
}
export function checkCollapsedSheet() {
  const panel = document.querySelector("#detail.is-collapsed");
  requireLayout(panel, "Collapsed sheet is required");
  const top = panel.getBoundingClientRect().top;
  const name = rect(".sheet-bar-name"),
    meta = rect(".sheet-bar-meta"),
    handle = rect(".detail-drag-handle"),
    close = rect(".detail-close");
  requireLayout(
    meta.height > 0 &&
      getComputedStyle(document.querySelector(".sheet-bar-meta")).visibility ===
        "visible" &&
      name.top >= top &&
      meta.bottom <= innerHeight + 1 &&
      meta.right <= close.left,
    "K8: the folded sheet shows the name, the series and the number whole",
  );
  requireLayout(
    innerHeight - top >= 60,
    "K8: the folded sheet must leave room to swipe",
  );
  // The swipe starts on the handle wherever the folded sheet is touched,
  // and the close button stays on top of it.
  const hit = (x, y) => document.elementFromPoint(x, y);
  requireLayout(
    hit(name.left + 4, meta.bottom - 2)?.matches(".detail-drag-handle") &&
      hit(handle.left + handle.width / 2, innerHeight - 3)?.matches(
        ".detail-drag-handle",
      ) &&
      hit(close.left + close.width / 2, close.top + close.height / 2)?.closest(
        ".detail-close",
      ),
    "K8: the whole folded sheet takes the swipe, except the close button",
  );
  const locate = rect("#locate");
  requireLayout(
    locate.bottom <= top,
    "K8: the location control stays above the folded sheet",
  );
  const attrib = document.querySelector(
    ".maplibregl-ctrl-attrib:not(.maplibregl-attrib-empty)",
  );
  requireLayout(
    !attrib || attrib.getBoundingClientRect().bottom <= top,
    "K8: the attribution stays above the folded sheet",
  );
  return { top, peek: innerHeight - top, locateBottom: locate.bottom };
}
