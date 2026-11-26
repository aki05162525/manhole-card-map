import type { ReactNode } from "react";
import { SiteHeader, SkipLink } from "../../shared/ui/site-header";
import { SourceNotes } from "../../shared/ui/source-notes";
import "./cards.css";

/** A fixture build's cards are made up: every page that lists them says so. */
export function FixtureNotice() {
  return (
    <p className="catalog-notice" role="status">
      検証用の架空データです。実際の訪問先として使わないでください。
    </p>
  );
}

/**
 * What stands around the list whatever it shows: the header, the main
 * landmark and the notes below. The build draws the same frame around the
 * HTML it writes for a reader without the script (`static-catalog.tsx`).
 */
export function CatalogFrame({ children }: { children: ReactNode }) {
  return (
    <div className="cards-page">
      <SkipLink targetId="catalog-main" />
      <SiteHeader current="cards" />
      <main id="catalog-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="catalog-footer">
        <SourceNotes showLegend={false} variant="catalog" />
        <a href="/about#credits">出典・このサイトについて</a>
      </footer>
    </div>
  );
}
