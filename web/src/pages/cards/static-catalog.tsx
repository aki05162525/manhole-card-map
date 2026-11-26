import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import {
  catalogCards,
  createCardCatalog,
  type CardCatalog,
} from "../../domain/card-catalog";
import { municipalityName } from "../../domain/card-presentation";
import {
  CATALOG_HEAD,
  otherPrefecturePage,
  PREFECTURE_HEADING_REST,
  prefectureListHead,
  prefecturePages,
} from "../../domain/prefecture-pages";
import type { Data } from "../../domain/types";
import { StatusChip } from "../../shared/ui/status-chip";
import { cardPageUrl, catalogUrl } from "../../shared/url/catalog-url";
import { CatalogFrame, FixtureNotice } from "./catalog-frame";
import { CatalogRegions } from "./catalog-regions";

// Loaded by the build only (`scripts/build/generate-static-pages.mjs`): the
// page's script never imports the server renderer.
//
// The list is drawn by its script, which leaves a reader without one, and a
// search engine before it renders, an empty page. The build writes what the
// script would show into the root it renders into: the prefectures with
// their counts for the whole list, and for each prefecture its cards, at a
// path of its own (`/pref/<slug>/`, where the prefecture pages were before
// #466). The script replaces the root's content with the same screen.

const origin = "https://manhole-techo.com";
const pathOf = (pref: string | null) =>
  catalogUrl({ pref, q: "", page: 1, card: null });
type Shown = { code: string; name: string; total: number };

function Sheet({
  pref,
  heading,
  total,
  evaluatedAt,
  fixture,
  children,
}: {
  pref?: { code: string };
  heading: ReactNode;
  total: number;
  evaluatedAt: string;
  fixture: boolean;
  children: ReactNode;
}) {
  return (
    <CatalogFrame>
      {fixture && <FixtureNotice />}
      <div className="techo">
        <div className="techo-page">
          <div className={`catalog-intro${pref ? " catalog-intro-pref" : ""}`}>
            {pref && (
              <p className="techo-folio" aria-hidden="true">
                {/^\d+$/.test(pref.code) ? `No. ${pref.code}` : "No. —"}
              </p>
            )}
            <h1>{heading}</h1>
            {total > 0 && (
              <>
                <p className="techo-count">
                  <b>{total.toLocaleString("ja-JP")}</b>
                  <small className="catalog-unit">枚</small>
                </p>
                {evaluatedAt && (
                  <p className="catalog-date">{evaluatedAt} 現在</p>
                )}
              </>
            )}
          </div>
          {children}
        </div>
      </div>
    </CatalogFrame>
  );
}

/** A prefecture's cards, each a line of the ledger as the script rules it. */
function PrefectureList({
  catalog,
  pref,
  fixture,
}: {
  catalog: CardCatalog;
  pref: Shown;
  fixture: boolean;
}) {
  const cards = catalogCards(catalog, { pref: pref.code });
  return (
    <Sheet
      pref={pref}
      heading={
        <>
          {pref.name}
          <span className="catalog-sr-only">{PREFECTURE_HEADING_REST}</span>
        </>
      }
      total={cards.length}
      evaluatedAt={catalog.data.evaluatedAt ?? ""}
      fixture={fixture}
    >
      {cards.length ? (
        <section
          className="catalog-results"
          aria-labelledby="catalog-results-title"
        >
          <h2 id="catalog-results-title" className="catalog-sr-only">
            {pref.name} · {pref.total}枚
          </h2>
          <div className="catalog-rows">
            {cards.map((card) => {
              const { places, facilityCount } = catalog.entriesById.get(
                card.id,
              )!;
              return (
                <article className="catalog-row" key={card.id}>
                  <p className="catalog-id">{card.id}</p>
                  {/* The script's row is one link over the whole line; here
                      the name is the link, so that it has words. */}
                  <h3 className="catalog-city">
                    <a href={cardPageUrl(card.id)}>
                      {municipalityName(card.city)}
                    </a>
                  </h3>
                  <p className="catalog-facility">
                    {places[0]?.name ?? "配布場所の登録なし"}
                    {facilityCount > 1 && (
                      <>
                        {" "}
                        <span className="catalog-facility-more">
                          ほか{facilityCount - 1}施設
                        </span>
                      </>
                    )}
                  </p>
                  <p className="catalog-series">
                    {card.series || "弾の記載なし"}
                  </p>
                  <StatusChip status={card.status} />
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <p>登録されているカードはありません。</p>
      )}
      <p>
        <a href={pathOf(null)}>ほかの都道府県の一覧</a>
      </p>
    </Sheet>
  );
}

/** The contents: each prefecture's page, with the count it lists. */
function Contents({
  catalog,
  fixture,
}: {
  catalog: CardCatalog;
  fixture: boolean;
}) {
  return (
    <Sheet
      heading="マンホールカード一覧"
      total={catalog.total}
      evaluatedAt={catalog.data.evaluatedAt ?? ""}
      fixture={fixture}
    >
      <p className="techo-lead">
        都道府県・自治体ごとにマンホールカードの配布場所を一覧で確認できます。
      </p>
      <CatalogRegions overview={catalog} />
    </Sheet>
  );
}

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const root = /(<div id="root"[^>]*>)<\/div>/;
// `catalog-unscripted`: shown only where no script will draw the screen
// (`cards.css`).
const filled = (html: string, content: ReactNode) =>
  html.replace(
    root,
    (_, open: string) =>
      `${open}${renderToStaticMarkup(
        <div className="catalog-unscripted">{content}</div>,
      )}</div>`,
  );
/**
 * The list's HTML renamed for one prefecture: the title, the description and
 * the URL, each in the tag search engines read and the one shared links read.
 */
function renamed(html: string, name: string, path: string, total: number) {
  const head = prefectureListHead(name, total);
  let page = html;
  for (const [from, to] of [
    [CATALOG_HEAD.title, escape(head.title)],
    [CATALOG_HEAD.description, escape(head.description)],
    [`"${origin}${pathOf(null)}"`, `"${origin}${path}"`],
  ]) {
    if (page.split(from).length !== 3)
      throw new Error(`cards.html: expected ${from} in two tags of its head`);
    page = page.replaceAll(from, to);
  }
  return page;
}

/**
 * `cards.html` as the build wrote it, with the prefectures in its root, and
 * one copy of it for each prefecture and for the others, by path. A
 * `fixture` build's pages warn that their cards are made up, as the list
 * the script draws does.
 */
export function renderCatalogPages(
  data: Data,
  template: string,
  { fixture = false }: { fixture?: boolean } = {},
) {
  if (!root.test(template))
    throw new Error("cards.html: no empty #root to fill");
  const catalog = createCardCatalog(data);
  const shown = [
    ...catalog.areas.flatMap((area) => area.prefectures),
    catalog.other,
  ];
  const pages = new Map([
    [
      "cards.html",
      filled(template, <Contents catalog={catalog} fixture={fixture} />),
    ],
  ]);
  for (const page of [...prefecturePages, otherPrefecturePage]) {
    // The heading names the prefecture as the script's does.
    const pref = shown.find((pref) => pref.code === page.code)!;
    const path = pathOf(page.code);
    pages.set(
      `${path.slice(1)}index.html`,
      filled(
        renamed(template, page.name, path, pref.total),
        <PrefectureList catalog={catalog} pref={pref} fixture={fixture} />,
      ),
    );
  }
  return pages;
}
