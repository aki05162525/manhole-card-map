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

export function CardDetail({
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
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
  );
  const lidLink = lidMapLink(card.lid);
  return (
    <>
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
              <ExternalLink map link={facilityMapLink(place, relation)} />
            </div>
            {relation.status && (
              <span className={`status-badge ${relation.status}`}>
                {labels[relation.status]}
              </span>
            )}
            {relation.review === "needs-review" && (
              <p className="subtle">
                配布情報は再確認待ちです。出典をご確認ください。
              </p>
            )}
            <p>
              {place.address}
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
            <p className="subtle">
              {place.locationReview?.status === "withdrawn"
                ? "施設位置は取り下げ済み"
                : place.locationReview?.status === "needs-review" ||
                    place.locationReview?.addressStatus === "needs-review"
                  ? "施設位置は再確認待ち"
                  : place.coordinate.status === "candidate"
                    ? "参考位置（未確定）"
                    : place.coordinate.status === "confirmed"
                      ? "位置確定"
                      : "地図の位置は未確定"}
            </p>
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
                <p className="subtle">
                  情報確認日：{relation.evidence.checkedAt}
                </p>
              </>
            )}
          </section>
        );
      })}
      {!relations.length && <p>配布施設の登録なし。</p>}
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
    </>
  );
}
