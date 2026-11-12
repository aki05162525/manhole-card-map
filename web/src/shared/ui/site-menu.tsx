import {
  CircleUserRound,
  Info,
  List,
  Map as MapIcon,
  Menu,
  Users,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useAccountLabel } from "./account-link";
import "./site-menu.css";

export type SitePage = "map" | "cards" | "friends" | "account" | "about";

/**
 * Fired (bubbling) from the menu once it opens: a page that switches screens
 * starts preparing the ones it links to (`app/app.tsx`).
 */
export const MENU_OPEN = "sitemenuopen";
const announce = (element: Element) =>
  element.dispatchEvent(new Event(MENU_OPEN, { bubbles: true }));

// Prerendered pages run no script, so they always get the native popover.
const nativePopover = () =>
  typeof HTMLElement === "undefined" || "popover" in HTMLElement.prototype;

function entries(listHref: string, account: string | null) {
  const accounts = import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
  // The account label needs the cookie; like AccountLink, pages rendered
  // without a document get no account entry.
  const label = accounts ? account : null;
  return [
    { page: "map", href: "/", label: "地図", Icon: MapIcon },
    { page: "cards", href: listHref, label: "一覧", Icon: List },
    ...(accounts
      ? [{ page: "friends", href: "/friends", label: "フレンド", Icon: Users }]
      : []),
    ...(label
      ? [
          {
            page: "account",
            href: "/account",
            label,
            Icon: CircleUserRound,
          },
        ]
      : []),
    {
      page: "about",
      href: "/about",
      label: "このサイトについて",
      Icon: Info,
    },
  ];
}

export function SiteMenu({
  current,
  listHref = "/cards",
  landmark = true,
}: {
  current?: SitePage | undefined;
  listHref?: string;
  // False where the caller already wraps the menu in its navigation landmark.
  landmark?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const Root = landmark ? "nav" : "div";
  const button = useRef<HTMLButtonElement>(null);
  const native = nativePopover();
  // Only the scripted fallback keeps the state; a popover is the browser's.
  const [open, setOpen] = useState(false);
  const account = useAccountLabel();
  useEffect(() => {
    if (native || !open) return;
    const close = () => {
      setOpen(false);
      button.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [native, open]);
  const list = (
    <ul>
      {entries(listHref, account).map(({ page, href, label, Icon }) => (
        <li key={page}>
          <a href={href} aria-current={page === current ? "page" : undefined}>
            <Icon aria-hidden="true" size={20} />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
  return (
    <Root
      ref={root as React.RefObject<HTMLDivElement | null>}
      className="site-menu"
      aria-label={landmark ? "メインナビゲーション" : undefined}
    >
      {native ? (
        <>
          <button
            ref={button}
            className="site-menu-button"
            type="button"
            aria-label="メニュー"
            popoverTarget={id}
          >
            <Menu aria-hidden="true" size={24} />
          </button>
          <div
            id={id}
            className="site-menu-panel"
            popover="auto"
            onBeforeToggle={(event) => {
              if (event.newState !== "open" || !button.current) return;
              // The top layer is laid out against the viewport, so place the
              // panel under the button, which the page may have put anywhere.
              const rect = button.current.getBoundingClientRect();
              const style = event.currentTarget.style;
              style.setProperty("--site-menu-top", `${rect.bottom + 4}px`);
              style.setProperty(
                "--site-menu-right",
                `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`,
              );
            }}
            onToggle={(event) => {
              if (event.newState === "open") announce(event.currentTarget);
              if (event.newState !== "closed") return;
              // Escape restores focus natively; a press outside does not.
              // Leave focus alone when that press moved it to another control.
              const active = document.activeElement;
              if (
                !active ||
                active === document.body ||
                event.currentTarget.contains(active)
              )
                button.current?.focus();
            }}
          >
            {list}
          </div>
        </>
      ) : (
        <>
          <button
            ref={button}
            className="site-menu-button"
            type="button"
            aria-label="メニュー"
            aria-expanded={open}
            aria-controls={id}
            onClick={(event) => {
              if (!open) announce(event.currentTarget);
              setOpen(!open);
            }}
          >
            <Menu aria-hidden="true" size={24} />
          </button>
          <div id={id} className="site-menu-panel is-open" hidden={!open}>
            {list}
          </div>
        </>
      )}
    </Root>
  );
}
