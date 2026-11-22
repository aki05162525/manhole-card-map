import { Menu, Search } from "lucide-react";
import { Logo } from "../../shared/ui/logo";

// The parts of the search bar that need no script: the map draws them
// (`map-search.tsx`), and the build writes them into the map's HTML so the
// bar is on screen before the script has loaded (`map-shell.tsx`).

/** What the bar's entry says while nothing is searched for. */
export const SEARCH_ENTRY_LABEL = "自治体・施設・番号で検索";

export function BarLogo() {
  return (
    <a className="logo-link" href="/about" aria-label="このサイトについて">
      <Logo size={24} />
    </a>
  );
}

export function EntryContent({ text }: { text: string }) {
  return (
    <>
      <Search size={20} aria-hidden="true" />
      <span>{text}</span>
    </>
  );
}

/**
 * The map screen as the HTML shows it until the script takes over: the bar,
 * which nothing answers yet (`inert`), over the paper the map is drawn on.
 * The stylesheet puts the menu where the screen's width has it.
 */
export function MapShell() {
  return (
    <main className="explorer">
      <header className="map-search-bar" inert>
        <BarLogo />
        <button className="map-search-entry" type="button">
          <EntryContent text={SEARCH_ENTRY_LABEL} />
        </button>
        <nav className="site-menu">
          <button className="site-menu-button" type="button">
            <Menu aria-hidden="true" size={24} />
          </button>
        </nav>
      </header>
      <div className="map-stage" />
    </main>
  );
}
