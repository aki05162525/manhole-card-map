import type { MouseEvent, RefObject } from "react";
import type { CatalogOverview } from "../../domain/card-catalog";
import { catalogUrl } from "../../shared/url/catalog-url";

type Shown = CatalogOverview["other"];

/**
 * The contents: each region a block, each prefecture a link to its list
 * (`/pref/<slug>/`) led by dots to its count. The build writes the same into
 * `cards.html` for a reader without the script (`static-catalog.tsx`), and a
 * search engine finds the lists from the page as drawn. `onOpen` opens a
 * prefecture in place on a plain click; with a modifier, as for another tab,
 * the link is the browser's.
 */
export function CatalogRegions({
  overview,
  headingRef,
  onOpen,
}: {
  overview: CatalogOverview;
  headingRef?: RefObject<HTMLHeadingElement | null> | undefined;
  onOpen?: ((pref: string) => void) | undefined;
}) {
  const link = (pref: Shown) => (
    <a
      key={pref.code}
      className={pref === overview.other ? "catalog-other" : undefined}
      data-pref={pref.code}
      href={catalogUrl({ pref: pref.code, q: "", page: 1, card: null })}
      onClick={
        onOpen &&
        ((event: MouseEvent) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onOpen(pref.code);
        })
      }
    >
      {pref.name}
      <i aria-hidden="true" />
      <span>
        {pref.total}
        <small>枚</small>
      </span>
    </a>
  );
  return (
    <section
      className="catalog-regions"
      aria-labelledby="catalog-regions-title"
    >
      <h2
        id="catalog-regions-title"
        className="catalog-sr-only"
        ref={headingRef}
        tabIndex={-1}
      >
        地域から選ぶ
      </h2>
      {overview.areas.map((area) => (
        <div className="catalog-region" key={area.id}>
          <h3>{area.name}</h3>
          <div>{area.prefectures.map(link)}</div>
        </div>
      ))}
      {link(overview.other)}
    </section>
  );
}
