import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  type PointerEvent,
  type SyntheticEvent,
} from "react";
import { useScreenActive } from "../../shared/browser/screen-activity";
import type { MapSearchSession } from "./map-search-state";

const outside = (event: PointerEvent<HTMLDialogElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
};

/**
 * The search's modal dialog: it opens and closes with the session's phase,
 * moves the focus in and out, and stays within the part of the screen an
 * on-screen keyboard leaves. Closing is the caller's (`onClose`): the dialog
 * only asks for it, so the history stays the one that decides.
 */
export function useSearchDialog({
  session,
  onClose,
  onClosed,
}: {
  session: MapSearchSession;
  onClose: () => void;
  /** The exit has finished and the focus is back on the bar's entry. */
  onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const pressedOutside = useRef(false);
  const open = session.phase === "search";
  // A modal left open would keep the screen shown instead inert.
  const active = useScreenActive();
  const afterClose = useEffectEvent(onClosed);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    let cancelled = false;
    element.removeAttribute("data-closing");
    if (!active) {
      // Hidden, not closed: the search reopens with the screen.
      if (element.open) element.close();
    } else if (open && !element.open) {
      element.showModal();
      if (scroller.current) scroller.current.scrollTop = session.scroll;
      if (session.restore) {
        input.current?.blur();
        const row = Array.from(
          element.querySelectorAll<HTMLButtonElement>("[data-card]"),
        ).find((node) => node.dataset.card === session.selected);
        (row ?? heading.current)?.focus({ preventScroll: true });
      } else input.current?.focus();
    } else if (!open && element.open) {
      // Retain the top layer during exit even where discrete display/overlay
      // transitions are unavailable. Reopening cancels the pending close.
      element.setAttribute("data-closing", "");
      const finish = () => {
        if (cancelled || !element.hasAttribute("data-closing")) return;
        element.close();
        element.removeAttribute("data-closing");
        entry.current?.focus({ preventScroll: true });
        afterClose();
      };
      const animations = element.getAnimations?.() ?? [];
      if (animations.length) {
        void Promise.allSettled(
          animations.map((animation) => animation.finished),
        ).then(finish);
      } else finish();
    }
    return () => {
      cancelled = true;
      element.removeAttribute("data-closing");
    };
  }, [open, active, session.restore, session.scroll, session.selected]);
  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const measure = () => {
      dialog.current?.style.setProperty(
        "--search-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.current?.style.setProperty(
        "--search-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
    };
  }, [open]);
  return {
    dialog,
    input,
    scroller,
    heading,
    entry,
    resetScroll() {
      if (scroller.current) scroller.current.scrollTop = 0;
    },
    /** Escape, and a press outside where the browser has no `closedby`. */
    dismissal: {
      onPointerDown(event: PointerEvent<HTMLDialogElement>) {
        if (!("closedBy" in HTMLDialogElement.prototype))
          pressedOutside.current = outside(event);
      },
      onPointerUp(event: PointerEvent<HTMLDialogElement>) {
        if (
          !("closedBy" in HTMLDialogElement.prototype) &&
          pressedOutside.current &&
          outside(event)
        )
          onClose();
        pressedOutside.current = false;
      },
      onCancel(event: SyntheticEvent<HTMLDialogElement>) {
        event.preventDefault();
        onClose();
      },
    },
  };
}
