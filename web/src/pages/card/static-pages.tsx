import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { Card, Data } from "../../domain/types";
import {
  prefecturePages,
  prefecturePage,
  otherPrefecturePage,
} from "../../domain/prefecture-pages";
import { municipalityName } from "../../domain/card-presentation";
import { lidMapLink, safeHttpUrl } from "../../domain/map-links";
import { accountHref } from "../../session/account-url";
import { cardPageUrl, mapCardUrl } from "../../shared/url/catalog-url";
import { labels } from "../../shared/ui/labels";
import "./generated-pages.css";
import { SiteHeader } from "../../shared/ui/site-header";
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
const prefPath = (slug: string) => `/pref/${slug}/`;
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
/** The card's earlier numbers, under which a record may have been saved. */
function earlierNumbers(data: Data, card: Card) {
  const earlier = Object.entries(data.cardAliases ?? {}).filter(
    ([, current]) => current === card.id,
  );
  return earlier.length
    ? JSON.stringify(Object.fromEntries(earlier))
    : undefined;
}
function cardLinks(cards: Card[]) {
  return (
    <ul className="static-card-list">
      {cards.map((card) => (
        <li key={card.id}>
          <a href={cardPath(card)}>
            {municipalityName(card.city)} {card.id}
          </a>
          <span>
            {card.series} · {labels[card.status]}
          </span>
        </li>
      ))}
    </ul>
  );
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
  const prefs = [...prefecturePages];
  if (data.cards.some((card) => prefecturePage(card.pref).code === "other"))
    prefs.push(otherPrefecturePage);
  const home = { name: "ホーム", path: "/" };
  for (const pref of prefs) {
    const cards = data.cards.filter(
      (card) => prefecturePage(card.pref).code === pref.code,
    );
    const path = prefPath(pref.slug);
    const crumb = { name: pref.name, path };
    const cities = [
      ...new Set(cards.map((card) => municipalityName(card.city))),
    ];
    pages.set(
      path.slice(1) + "index.html",
      document(
        `${pref.name}のマンホールカード配布場所一覧（${cards.length}枚）| マンホール手帳`,
        `${pref.name}のマンホールカード${cards.length}枚の配布場所・配布時間を自治体別に一覧。配布状態を確認し、地図で場所を確認できます。`,
        [home, crumb],
        <>
          <h1>{pref.name}のマンホールカード配布場所</h1>
          <p>{cards.length}枚のカードを収録しています。</p>
          <nav className="static-actions" aria-label="表示を切り替える">
            <a href={cards[0] ? mapCardUrl(cards[0].id) : "/"}>地図で見る</a>
            <a href="/cards">一覧で探す</a>
          </nav>
          {cities.length > 0 && (
            <nav aria-label="自治体から探す">
              <ul className="static-city-index">
                {cities.map((city, index) => (
                  <li key={city}>
                    <a href={`#city-${index + 1}`}>{city}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {cities.map((city, index) => (
            <section key={city}>
              <h2 id={`city-${index + 1}`}>{city}</h2>
              <ul className="static-card-list">
                {cards
                  .filter((card) => municipalityName(card.city) === city)
                  .map((card) => (
                    <li key={card.id}>
                      <a href={cardPath(card)}>{card.id}</a>
                      <span>
                        {card.series} · {labels[card.status]}
                      </span>
                      <p>
                        {data.relations
                          .filter((r) => r.cardId === card.id)
                          .map(
                            (r) =>
                              data.places.find((p) => p.id === r.placeId)?.name,
                          )
                          .filter(Boolean)
                          .join("・") ||
                          card.placeText?.join("\n") ||
                          "配布場所の登録なし"}
                      </p>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </>,
        stylesheets,
      ),
    );
    for (const card of cards) {
      const name = `${prefecturedName(card)}のマンホールカード`;
      const relations = data.relations.filter((r) => r.cardId === card.id);
      const lid = lidMapLink(card.lid);
      const sameCityCards = cards.filter(
        (other) =>
          other.id !== card.id &&
          municipalityName(other.city) === municipalityName(card.city),
      );
      pages.set(
        cardPath(card).slice(1) + "index.html",
        document(
          `${name}（${card.series}・${card.id}）配布場所と配布時間 | マンホール手帳`,
          `${name}（${card.id}・${card.series}）の配布場所・配布時間・配布条件と出典を確認できます。配布状態：${labels[card.status]}。`,
          [home, crumb, { name: card.id, path: cardPath(card) }],
          <article className="card-page">
            <h1>
              {prefecturedName(card)}
              <span>のマンホールカード</span>
            </h1>
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
                <dd className="card-status" data-status={card.status}>
                  {labels[card.status]}
                </dd>
                <dt>カード番号</dt>
                <dd>{card.id}</dd>
                <dt>弾</dt>
                <dd>{card.series}</dd>
                <dt>発行日</dt>
                <dd>{card.issued || "記載なし"}</dd>
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
            <section className="card-places">
              <h2>配布場所</h2>
              {relations.map((relation, i) => {
                const place = data.places.find(
                  (p) => p.id === relation.placeId,
                );
                const hours = relation.hours?.length
                  ? relation.hours
                  : card.hours;
                const source =
                  relation.evidence && safeHttpUrl(relation.evidence.sourceUrl);
                return (
                  <section key={`${relation.placeId}-${i}`}>
                    <h3>{place?.name || "配布場所の名称未確認"}</h3>
                    <p className="card-place-status">
                      {labels[relation.status ?? card.status]}
                      {relation.review === "needs-review"
                        ? "（配布情報は未確認）"
                        : ""}
                    </p>
                    <dl>
                      <dt>配布時間</dt>
                      <dd className="static-lines">
                        {hours?.join("\n") || "配布時間は未確認です。"}
                      </dd>
                      {relation.condition && (
                        <>
                          <dt>配布条件</dt>
                          <dd className="static-lines">{relation.condition}</dd>
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
                    {source && (
                      <p>
                        <a href={source}>この配布情報の出典</a>
                      </p>
                    )}
                  </section>
                );
              })}
              {!relations.length && (
                <>
                  <p className="static-lines">
                    {card.placeText?.join("\n") || "配布場所の登録なし"}
                  </p>
                  {Boolean(card.hours?.length) && (
                    <p className="static-lines">{card.hours!.join("\n")}</p>
                  )}
                </>
              )}
            </section>
            {Boolean(card.links?.length) && (
              <ul className="card-sources">
                {card
                  .links!.filter((link) => safeHttpUrl(link))
                  .map((link) => (
                    <li key={link}>
                      <a href={safeHttpUrl(link)!}>配布情報の出典</a>
                    </li>
                  ))}
              </ul>
            )}
            {lid && (
              <p>
                <a href={lid.href}>蓋の場所をGoogle Mapsで見る</a>
              </p>
            )}
            {sameCityCards.length > 0 && (
              <section>
                <h2>同じ自治体のカード</h2>
                {cardLinks(sameCityCards)}
              </section>
            )}
            <section>
              <h2>{pref.name}のほかのカード</h2>
              {cardLinks(cards.filter((c) => c.id !== card.id).slice(0, 5))}
              <p>
                <a href={path}>{pref.name}の配布場所一覧</a>
              </p>
            </section>
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
  // Both are data timestamps, never the build clock. Prefer the latest valid date.
  const dates = [data.updated, data.evaluatedAt]
    .filter((date): date is string =>
      Boolean(date && /^\d{4}-\d{2}-\d{2}/.test(date)),
    )
    .map((date) => date.slice(0, 10))
    .sort();
  const lastmod = dates.at(-1);
  pages.set(
    "sitemap.xml",
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls
        .map(
          (path) =>
            `<url><loc>${origin}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
        )
        .join("") +
      "</urlset>\n",
  );
  pages.set(
    "robots.txt",
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
  return pages;
}
