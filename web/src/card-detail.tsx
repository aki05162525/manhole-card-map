import type { ReactNode } from "react";
import { createCardCatalog, pinReasonLabels } from "./card-catalog";
import { facilityMapLink, lidMapLink, safeHttpUrl, type MapLink } from "./ui";
import { selectionPins, visiblePins } from "./explorer-state";
import { labels, type Card, type Data } from "./types";

function ExternalLink({
  link,
  map = false,
}: {
  link: MapLink | null;
  map?: boolean;
}) {
  return link ? (
    <a
      className={map ? "map-link" : "source-link"}
      href={link.href}
      title={link.label}
      target="_blank"
      rel="noopener noreferrer"
    >
      {map
        ? link.label === "蓋のGoogleマップへ"
          ? link.label
          : "Googleマップへ"
        : link.label}
      <span aria-hidden="true"> ↗</span>
    </a>
  ) : null;
}

export type CardDetailProps = {
  card: Card;
  data: Data;
  onShowLid?(): void;
  onShowPlaces?(): void;
  mapReady?: boolean;
  showingLid?: boolean;
  /** Additional information for the standalone catalog; the map keeps its existing markup. */
  variant?: "map" | "catalog";
  /** Supply page links or other controls in place of the internal map controls. */
  actions?: ReactNode;
};

export function CardDetail({
  card,
  data,
  onShowLid,
  onShowPlaces,
  mapReady = false,
  showingLid = false,
  variant = "map",
  actions,
}: CardDetailProps) {
  const catalog = variant === "catalog";
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
  );
  const lidLink = lidMapLink(card.lid);
  const entry = catalog
    ? createCardCatalog(data).entriesById.get(card.id)
    : undefined;
  const hasFacilities = relations.some((relation) =>
    data.places.some((place) => place.id === relation.placeId),
  );
  return (
    <>
      {catalog && (
        <>
          <p className="card-meta">
            {card.pref || "その他（県の登録なし）"} ·{" "}
            {card.series || "シリーズの記載なし"}
          </p>
          <p className="card-meta">
            カードID：{card.id}
            <br />
            発行日：{card.issued || "記載なし"}
          </p>
          <p>カードの状態：{labels[card.status]}</p>
          <p>{entry?.hasPin ? "配布施設ピンあり" : "配布施設ピンなし"}</p>
          {entry?.pinReasons.map((reason) => (
            <p className="subtle" key={reason}>
              {pinReasonLabels[reason]}
            </p>
          ))}
          {!hasFacilities && (
            <section className="original-place-text">
              <h3>原文の配布場所（構造化した施設情報の補足）</h3>
              <p>
                {card.placeText?.length
                  ? card.placeText.join("\n")
                  : "配布場所の原文の記載なし"}
              </p>
            </section>
          )}
          <p>
            原文の配布時間：
            {card.hours?.length ? card.hours.join("\n") : "配布時間の記載なし"}
          </p>
          {card.links?.some((link) => safeHttpUrl(link)) ? (
            [...new Set(card.links)].map((link) => (
              <ExternalLink
                key={link}
                link={
                  safeHttpUrl(link)
                    ? { href: safeHttpUrl(link)!, label: "カードの原文リンク" }
                    : null
                }
              />
            ))
          ) : (
            <p className="subtle">原文リンクの記載なし</p>
          )}
        </>
      )}
      {relations.length > 1 && (
        <p>配布施設は曜日・条件を確認して選んでください。</p>
      )}
      {relations.map((relation, index) => {
        const place = data.places.find((item) => item.id === relation.placeId);
        if (!place) return null;
        return (
          <section className="facility" key={`${relation.placeId}-${index}`}>
            <div className="facility-heading">
              <h3>{place.name}</h3>
              <ExternalLink
                map={!catalog}
                link={facilityMapLink(place, relation)}
              />
            </div>
            {catalog && (
              <p>
                この施設の配布状態：
                {relation.status
                  ? labels[relation.status]
                  : "配布状態の記載なし"}
                <br />
                配布関係：
                {relation.review === "needs-review"
                  ? "再確認待ち"
                  : relation.review === "verified"
                    ? "確認済み"
                    : "確認状態の記載なし"}
              </p>
            )}
            {relation.review === "needs-review" && (
              <p className="subtle">
                配布情報は再確認待ちです。出典をご確認ください。
              </p>
            )}
            <p>
              {place.address || (catalog ? "住所の記載なし" : "")}
              {place.phone && `\n${place.phone}`}
            </p>
            <p>
              {[relation.condition, relation.periodRaw, relation.alternativeRaw]
                .filter(Boolean)
                .join("\n")}
            </p>
            {relation.hours?.length ? (
              <p>カード配布時間：{relation.hours.join("\n")}</p>
            ) : (
              <p className="subtle">
                この窓口の配布時間は未整理です。配布情報の出典をご確認ください。
              </p>
            )}
            {(relation.validFrom || relation.validTo) && (
              <p>
                適用期間：{relation.validFrom || "開始日未確認"} ～{" "}
                {relation.validTo || "終了日未指定"}
              </p>
            )}
            {(place.coordinate.status !== "confirmed" ||
              place.locationReview?.status === "withdrawn" ||
              place.locationReview?.status === "needs-review" ||
              place.locationReview?.addressStatus === "needs-review") && (
              <p className="subtle">
                {place.locationReview?.status === "withdrawn"
                  ? "施設位置は取り下げ済み"
                  : place.locationReview?.status === "needs-review" ||
                      place.locationReview?.addressStatus === "needs-review"
                    ? "施設位置は再確認待ち"
                    : place.coordinate.status === "candidate"
                      ? "参考位置（未確定）"
                      : "地図の位置は未確定"}
              </p>
            )}
            {place.locationReview &&
              (place.locationReview.status !== "confirmed" ||
                place.locationReview.addressStatus === "needs-review") && (
                <p className="subtle">
                  {place.locationReview.reason}
                  {place.locationReview.addressStatus === "needs-review" &&
                    "（住所も再確認待ちです）"}
                </p>
              )}
            {relation.evidence && (
              <>
                <ExternalLink
                  link={
                    safeHttpUrl(relation.evidence.sourceUrl)
                      ? {
                          href: safeHttpUrl(relation.evidence.sourceUrl)!,
                          label: "この配布情報の出典",
                        }
                      : null
                  }
                />
              </>
            )}
          </section>
        );
      })}
      {!(catalog ? hasFacilities : relations.length) && (
        <p>配布施設の登録なし。</p>
      )}
      {actions !== undefined ? (
        actions
      ) : !catalog && onShowLid && onShowPlaces ? (
        <CardMapActions
          card={card}
          data={data}
          onShowLid={onShowLid}
          onShowPlaces={onShowPlaces}
          mapReady={mapReady}
          showingLid={showingLid}
        />
      ) : null}
      {catalog && (
        <ExternalLink
          map
          link={lidLink ? { ...lidLink, label: "蓋のGoogleマップへ" } : null}
        />
      )}
    </>
  );
}

/** Optional map controls, also used by the original map API. */
function CardMapActions({
  card,
  data,
  onShowLid,
  onShowPlaces,
  mapReady,
  showingLid = false,
}: {
  card: Card;
  data: Data;
  onShowLid(): void;
  onShowPlaces(): void;
  mapReady: boolean;
  showingLid?: boolean;
}) {
  const lidLink = lidMapLink(card.lid);
  return (
    <div className="destination-actions">
      {showingLid ? (
        <button
          type="button"
          onClick={onShowPlaces}
          disabled={
            !mapReady ||
            !selectionPins(visiblePins(data, false), [card.id]).length
          }
        >
          配布場所に戻る
        </button>
      ) : lidLink ? (
        <button type="button" onClick={onShowLid} disabled={!mapReady}>
          蓋の位置へ
        </button>
      ) : null}
      {showingLid && (
        <ExternalLink
          map
          link={lidLink ? { ...lidLink, label: "蓋のGoogleマップへ" } : null}
        />
      )}
    </div>
  );
}
