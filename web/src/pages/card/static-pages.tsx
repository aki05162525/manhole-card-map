import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { Card, Data } from "../../domain/types";
import {
  prefecturePages,
  otherPrefecturePage,
} from "../../domain/prefecture-pages";
import { catalogPrefCode } from "../../domain/catalog-summary";
import { municipalityName } from "../../domain/card-presentation";
import { lidMapLink, safeHttpUrl } from "../../domain/map-links";
import { accountHref } from "../../session/account-url";
import {
  cardPageUrl,
  catalogUrl,
  mapCardUrl,
} from "../../shared/url/catalog-url";
import { labels } from "../../shared/ui/labels";
import { StatusChip } from "../../shared/ui/status-chip";
import "./generated-pages.css";
import { SiteHeader, SkipLink } from "../../shared/ui/site-header";
import { UpcomingChanges } from "../../shared/ui/upcoming-changes";

const origin = "https://manhole-techo.com";
const cardPath = (card: Card) => cardPageUrl(card.id);
/**
 * The prefecture once, then the municipality. Some source names already lead
 * with it ("東京都 千代田区", "岩手県 （流域下水道）").
 */
function prefecturedName(card: Card) {
  const city = municipalityName(card.city);
  return (
    card.pref +
    (card.pref && city.startsWith(card.pref)
      ? city.slice(card.pref.length).trimStart()
      : city)
  );
}

/** The site a source is on, as a reader would say it. */
const siteName = (url: string) => new URL(url).hostname.replace(/^www\./, "");

type Crumb = { name: string; path: string };
function document(
  title: string,
  description: string,
  crumbs: Crumb[],
  content: ReactNode,
  stylesheets: string[],
  scripts: (string | undefined)[] = [],
) {
  const url = origin + crumbs[crumbs.length - 1].path;
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: origin + crumb.path,
    })),
  }).replace(/</g, "\\u003c");
  return (
    "<!DOCTYPE html>" +
    renderToStaticMarkup(
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <meta name="description" content={description} />
          <link rel="canonical" href={url} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={url} />
          <meta property="og:type" content="website" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          {stylesheets.map((href) => (
            <link key={href} rel="stylesheet" href={href} />
          ))}
          {scripts.map(
            (script) =>
              script && <script key={script} type="module" src={script} />,
          )}
          <script type="application/ld+json">{json}</script>
        </head>
        <body>
          <SkipLink targetId="card-title" />
          <SiteHeader />
          <main className="static-page">
            <nav aria-label="パンくず">
              <ol className="static-breadcrumbs">
                {crumbs.map((crumb, i) => (
                  <li key={crumb.path}>
                    {i === crumbs.length - 1 ? (
                      <span aria-current="page">{crumb.name}</span>
                    ) : (
                      <a href={crumb.path}>{crumb.name}</a>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            {content}
          </main>
        </body>
      </html>,
    )
  );
}
/**
 * A municipality's later cards carry their number in the name
 * ("池田市(B001)"), and towns of one name stand in different prefectures.
 */
const sameMunicipality = (a: Card, b: Card) =>
  a.pref === b.pref && municipalityName(a.city) === municipalityName(b.city);
/**
 * Other cards, a line each: its number, whose it is, its series and its
 * state. The whole line leads to that card's page.
 */
function RelatedCards({ title, cards }: { title: string; cards: Card[] }) {
  if (!cards.length) return null;
  return (
    <section className="card-related">
      <h2>{title}</h2>
      <ul>
        {cards.map((card) => (
          <li key={card.id}>
            <a href={cardPath(card)}>
              <span>{card.id}</span>
              <span className="card-related-name">
                {municipalityName(card.city)}
              </span>
              <span>{card.series}</span>
              <StatusChip status={card.status} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
/** The card's earlier numbers, under which a record may have been saved. */
function earlierNumbers(data: Data, card: Card) {
  const earlier = Object.entries(data.cardAliases ?? {}).filter(
    ([, current]) => current === card.id,
  );
  return earlier.length
    ? JSON.stringify(Object.fromEntries(earlier))
    : undefined;
}
/**
 * `scripts` are the built entries a card page may name. `record` is
 * `src/card-record-main.tsx`: with accounts, a card page carries it and the
 * place it fills: until then, and for a visitor who is not signed in, a link
 * to sign in and come back. Only the card's public numbers go into the page.
 * `image` is `src/card-image-main.ts`, on the pages that show a card's image.
 */
export function renderStaticPages(
  data: Data,
  stylesheets = ["/assets/static-pages.css"],
  scripts: { record?: string | undefined; image?: string | undefined } = {},
) {
  const record =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true"
      ? scripts.record
      : undefined;
  const pages = new Map<string, string>();
  const home = { name: "ホーム", path: "/" };
  const redirects: string[] = [];
  // A counter where a card's distribution has ended is no longer one of its
  // counters: it joins no card to another.
  const counters = new Map<string, string[]>();
  for (const relation of data.relations)
    if (relation.status !== "ended")
      counters.set(relation.placeId, [
        ...(counters.get(relation.placeId) ?? []),
        relation.cardId,
      ]);
  for (const pref of [...prefecturePages, otherPrefecturePage]) {
    const path = catalogUrl({ pref: pref.code, q: "", page: 1, card: null });
    const crumb = { name: pref.name, path };
    const legacy = `/pref/${pref.slug}`;
    for (const source of [legacy, `${legacy}/`, `${legacy}/index.html`])
      redirects.push(`${source} ${path} 301`);
    for (const card of data.cards.filter(
      (card) => catalogPrefCode(card) === pref.code,
    )) {
      const name = `${prefecturedName(card)}のマンホールカード`;
      const relations = data.relations.filter((r) => r.cardId === card.id);
      const source = [
        ...relations.map((relation) => relation.evidence?.sourceUrl),
        ...(card.links ?? []),
      ]
        .map((url) => url && safeHttpUrl(url))
        .find(Boolean);
      const lid = lidMapLink(card.lid);
      const atCounters = new Set(
        relations.flatMap((relation) =>
          relation.status === "ended" ? [] : counters.get(relation.placeId)!,
        ),
      );
      pages.set(
        cardPath(card).slice(1) + "index.html",
        document(
          `${name}（${card.series}・${card.id}）配布場所と配布時間 | マンホール手帳`,
          `${name}（${card.id}・${card.series}）の配布場所・配布時間・配布条件と出典を確認できます。配布状態：${labels[card.status]}。`,
          [
            home,
            crumb,
            { name: municipalityName(card.city), path: cardPath(card) },
          ],
          <article className="card-page">
            <h1 id="card-title" tabIndex={-1}>
              {prefecturedName(card)}
              <span>のマンホールカード</span>
            </h1>
            <div className="card-body">
              <div className="card-lead">
                {/* Only what the municipality permitted, whole and as it is,
                  with its credit; a card without one gets no frame. */}
                {card.image && (
                  <figure className="card-figure">
                    <img
                      src={card.image.path}
                      width={card.image.width}
                      height={card.image.height}
                      alt={`${municipalityName(card.city)}のマンホールカード（${card.id}）`}
                    />
                    <figcaption>画像：{card.image.credit}</figcaption>
                  </figure>
                )}
                <dl className="card-facts">
                  <dt>配布状態</dt>
                  <dd>
                    <StatusChip status={card.status} />
                  </dd>
                  <dt>カード番号</dt>
                  <dd>{card.id}</dd>
                  <dt>弾</dt>
                  <dd>{card.series}</dd>
                  <dt>発行日</dt>
                  <dd>{card.issued || "記載なし"}</dd>
                  <dt>配布場所</dt>
                  <dd className="card-places">
                    {relations.map((relation, i) => {
                      const place = data.places.find(
                        (p) => p.id === relation.placeId,
                      );
                      const hours = relation.hours?.length
                        ? relation.hours
                        : card.hours;
                      return (
                        <section key={`${relation.placeId}-${i}`}>
                          <h2>{place?.name || "配布場所の名称未確認"}</h2>
                          {relation.status &&
                            relation.status !== card.status && (
                              <p>この窓口は{labels[relation.status]}</p>
                            )}
                          {relation.review === "needs-review" && (
                            <p>配布情報は未確認です。</p>
                          )}
                          <dl className="card-place-details">
                            <dt>配布時間</dt>
                            <dd>
                              {hours?.join("\n") || "配布時間は未確認です。"}
                            </dd>
                            {relation.condition && (
                              <>
                                <dt>配布条件</dt>
                                <dd>{relation.condition}</dd>
                              </>
                            )}
                          </dl>
                          {relation.periodRaw && <p>{relation.periodRaw}</p>}
                          {relation.alternativeRaw && (
                            <p>{relation.alternativeRaw}</p>
                          )}
                          <UpcomingChanges
                            relation={relation}
                            asOf={data.evaluatedAt}
                            placeName={(id) =>
                              data.places.find((p) => p.id === id)?.name || id
                            }
                          />
                        </section>
                      );
                    })}
                    {!relations.length && (
                      <>
                        <p className="static-lines">
                          {card.placeText?.join("\n") || "配布場所の登録なし"}
                        </p>
                        {Boolean(card.hours?.length) && (
                          <p className="static-lines">
                            {card.hours!.join("\n")}
                          </p>
                        )}
                      </>
                    )}
                  </dd>
                  {/* Where the lines above come from: the last line of the
                    facts, named by the site it leads to. */}
                  {source && (
                    <>
                      <dt>出典</dt>
                      <dd className="card-source">
                        <a
                          href={source}
                          aria-label={`配布情報の出典 ${siteName(source)}`}
                        >
                          {siteName(source)}
                        </a>
                      </dd>
                    </>
                  )}
                </dl>
                <div className="card-actions">
                  <a className="card-map-link" href={mapCardUrl(card.id)}>
                    地図で配布場所を見る
                  </a>
                  {record && (
                    <div
                      id="card-record"
                      className="card-record"
                      data-card-id={card.id}
                      data-card-aliases={earlierNumbers(data, card)}
                    >
                      <a href={accountHref(cardPath(card))}>
                        ログインして入手を記録
                      </a>
                    </div>
                  )}
                </div>
              </div>
              {lid && (
                <p>
                  <a
                    className="card-lid-link"
                    href={mapCardUrl(card.id, "lid")}
                  >
                    地図で蓋の場所を見る
                  </a>
                </p>
              )}
              <RelatedCards
                title="同じ自治体のカード"
                cards={data.cards.filter(
                  (other) => sameMunicipality(other, card) && other !== card,
                )}
              />
              <RelatedCards
                title="同じ窓口で配布しているカード"
                cards={data.cards.filter(
                  (other) =>
                    atCounters.has(other.id) && !sameMunicipality(other, card),
                )}
              />
            </div>
          </article>,
          stylesheets,
          [card.image && scripts.image, record],
        ),
      );
    }
  }
  const urls = [
    "/",
    "/cards",
    "/about",
    ...[...pages.keys()].map((path) => "/" + path.replace(/index\.html$/, "")),
  ];
  pages.set(
    "sitemap.xml",
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("") +
      "</urlset>\n",
  );
  pages.set(
    "robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
  pages.set("_redirects", redirects.join("\n") + "\n");
  return pages;
}
