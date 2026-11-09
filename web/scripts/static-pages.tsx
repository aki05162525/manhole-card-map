import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { Card, Data } from "../src/domain/types";
import {
  prefecturePages,
  prefecturePage,
  otherPrefecturePage,
} from "../src/domain/prefecture-pages";
import { municipalityName } from "../src/domain/card-presentation";
import { lidMapLink, safeHttpUrl } from "../src/domain/map-links";
import { mapCardUrl } from "../src/shared/url/catalog-url";
import { labels } from "../src/shared/ui/labels";
import "../src/shared/ui/static-pages.css";
import { SiteHeader } from "../src/shared/ui/site-header";

const origin = "https://manhole-techo.com";
const cardPath = (card: Card) => `/card/${encodeURIComponent(card.id)}/`;
const prefPath = (slug: string) => `/pref/${slug}/`;
const note = "訪問前に配布情報の出典をご確認ください。";
type Crumb = { name: string; path: string };
function document(
  title: string,
  description: string,
  crumbs: Crumb[],
  content: ReactNode,
  stylesheet: string,
) {
  const url = origin + crumbs[crumbs.length - 1]!.path;
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
          <link rel="stylesheet" href={stylesheet} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: json }}
          />
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
            <footer>
              <p>{note}</p>
            </footer>
          </main>
        </body>
      </html>,
    )
  );
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
export function renderStaticPages(
  data: Data,
  stylesheet = "/assets/static-pages.css",
) {
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
          {cities.map((city) => (
            <section key={city}>
              <h2>{city}</h2>
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
        stylesheet,
      ),
    );
    for (const card of cards) {
      const name = `${card.pref}${municipalityName(card.city)}のマンホールカード`;
      const relations = data.relations.filter((r) => r.cardId === card.id);
      const lid = lidMapLink(card.lid);
      pages.set(
        cardPath(card).slice(1) + "index.html",
        document(
          `${name}（${card.series}・${card.id}）配布場所と配布時間 | マンホール手帳`,
          `${name}（${card.id}・${card.series}）の配布場所・住所・配布時間・配布条件と出典を確認できます。配布状態：${labels[card.status]}。`,
          [home, crumb, { name: card.id, path: cardPath(card) }],
          <>
            <h1>{name}</h1>
            <dl className="static-facts">
              <dt>カード番号</dt>
              <dd>{card.id}</dd>
              <dt>弾</dt>
              <dd>{card.series}</dd>
              <dt>発行日</dt>
              <dd>{card.issued || "記載なし"}</dd>
              <dt>配布状態</dt>
              <dd>{labels[card.status]}</dd>
            </dl>
            <p>
              <a className="static-map-link" href={mapCardUrl(card.id)}>
                地図で配布場所を見る
              </a>
            </p>
            {relations.map((relation, i) => {
              const place = data.places.find((p) => p.id === relation.placeId);
              const hours = relation.hours?.length
                ? relation.hours
                : card.hours;
              const source =
                relation.evidence && safeHttpUrl(relation.evidence.sourceUrl);
              return (
                <section key={`${relation.placeId}-${i}`}>
                  <h2>{place?.name || "配布場所の名称未確認"}</h2>
                  <p>
                    {labels[relation.status ?? card.status]}
                    {relation.review === "needs-review"
                      ? "（配布情報は未確認）"
                      : ""}
                  </p>
                  <p>{place?.address || "住所の記載なし"}</p>
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
                  {relation.alternativeRaw && <p>{relation.alternativeRaw}</p>}
                  {source && (
                    <p>
                      <a href={source}>この配布情報の出典</a>
                    </p>
                  )}
                </section>
              );
            })}
            {!relations.length && (
              <section>
                <h2>配布場所</h2>
                <p className="static-lines">
                  {card.placeText?.join("\n") || "配布場所の登録なし"}
                </p>
                {Boolean(card.hours?.length) && (
                  <p className="static-lines">{card.hours!.join("\n")}</p>
                )}
              </section>
            )}
            {Boolean(card.links?.length) && (
              <ul>
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
            <section>
              <h2>{pref.name}のほかのカード</h2>
              {cardLinks(cards.filter((c) => c.id !== card.id).slice(0, 5))}
              <p>
                <a href={path}>{pref.name}の配布場所一覧</a>
              </p>
            </section>
          </>,
          stylesheet,
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
