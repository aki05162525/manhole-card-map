import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

// Named header snapshots must see the committed DOM before the module's render
// block is released. Data loading remains asynchronous inside the page.
export function renderDocument(root: HTMLElement, page: ReactNode) {
  flushSync(() => createRoot(root).render(page));
}
