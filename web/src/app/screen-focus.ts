/** What a screen left gets back when it returns. */
export type Kept = { scroll: number; focus: WeakRef<Element> | null };

/**
 * Before the screen in `element` is hidden: closes its popovers, fixes the
 * box a hidden map keeps (app.css), and notes the scroll and the focus.
 */
export function leaveScreen(element: HTMLElement | null): Kept {
  if (element) {
    try {
      for (const popover of element.querySelectorAll<HTMLElement>(
        ":popover-open",
      ))
        popover.hidePopover();
    } catch {
      // Without the Popover API, the menu closes with its own script.
    }
    const box = element.firstElementChild?.getBoundingClientRect();
    if (box) {
      element.style.setProperty("--app-screen-width", `${box.width}px`);
      element.style.setProperty("--app-screen-height", `${box.height}px`);
    }
  }
  const active = document.activeElement;
  return {
    scroll: window.scrollY,
    focus:
      active && active !== document.body && element?.contains(active)
        ? new WeakRef(active)
        : null,
  };
}

/**
 * Moves focus into the screen shown in `element`, for keyboards and readers:
 * to what was focused there, to the part a link's fragment names (scrolled
 * to), or to its main heading.
 */
export function enterScreen(
  element: HTMLElement,
  back: Kept | undefined,
  fragment: boolean,
) {
  const restored = back?.focus?.deref();
  if (
    restored instanceof HTMLElement &&
    restored.isConnected &&
    element.contains(restored)
  ) {
    restored.focus({ preventScroll: true });
    if (document.activeElement === restored) return;
  }
  const named =
    fragment && location.hash
      ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
      : null;
  if (named && element.contains(named)) named.scrollIntoView();
  const heading =
    (named && element.contains(named) ? named : null) ??
    element.querySelector<HTMLElement>("h1") ??
    element.querySelector<HTMLElement>("main") ??
    element;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}
