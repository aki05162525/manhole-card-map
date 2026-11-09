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
    innerHeight - top <= Math.min(innerHeight * 0.56, 440) + 2,
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
    const hours = rect(".summary-hours");
    requireLayout(
      hours.height > 0 && hours.top >= top && hours.bottom <= actions.top,
      "K2: keep hours before the primary action",
    );
    if (panel.hasAttribute("data-sheet-compact")) {
      requireLayout(
        rect(".hours-continue-short").height > 0,
        "K2: retain the short continuation link",
      );
      requireLayout(
        [
          ...panel.querySelectorAll(".detail-status > span:not(:first-child)"),
        ].every((node) => getComputedStyle(node).display === "none"),
        "K2: omit notes before other content",
      );
    }
    const header = rect(".map-search-bar"),
      entry = rect(".map-search-entry");
    requireLayout(
      entry.top >= header.top &&
        entry.bottom <= header.bottom &&
        entry.right <= header.right,
      "K3: search button must fit inside the search bar",
    );
    const attrib = rect(".maplibregl-ctrl-attrib"),
      locate = rect("#locate");
    requireLayout(
      locate.bottom <= attrib.top || locate.left >= attrib.right,
      "K3: attribution must not overlap locate",
    );
  }
  const icon = document.querySelector(".sheet-more svg");
  requireLayout(
    icon?.getAttribute("width") === "16" &&
      icon.getAttribute("aria-hidden") === "true",
    "K4: use an accessible decorative 16px ChevronUp",
  );
  return { top, height: innerHeight - top, buttonBottom: actions.bottom };
}
