import { facilityMapLink, lidMapLink, safeHttpUrl, type MapLink } from "./ui";
import { selectionPins, visiblePins } from "./explorer-state";
import { labels, type Card, type Data } from "./types";

function ExternalLink({ link }: { link: MapLink | null }) {
  return link ? (
    <a
      className="destination-link"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {link.label}
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
}: {
  card: Card;
  data: Data;
  onShowLid(): void;
  onShowPlaces(): void;
  mapReady: boolean;
}) {
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
  );
  const lidLink = lidMapLink(card.lid);
  return (
    <>
      <p className="eyebrow">{card.pref}</p>
      <h2 tabIndex={-1}>{card.city}</h2>
      <p className="card-meta">
        {card.id} / {card.series} / {card.issued}
      </p>
      <p>
        <span className={`status-badge ${card.status}`}>
          {labels[card.status]}
        </span>{" "}
        <span className="subtle">在庫は未確認です</span>
      </p>
      <h3 className="journey-heading">1. カードをもらう</h3>
      <button
        type="button"
        onClick={onShowPlaces}
        disabled={
          !mapReady ||
          !selectionPins(visiblePins(data, false), [card.id]).length
        }
      >
        配布場所を見る
      </button>
      {relations.length > 1 && (
        <p>配布施設は曜日・条件を確認して選んでください。</p>
      )}
      {relations.map((relation, index) => {
        const place = data.places.find((item) => item.id === relation.placeId);
        if (!place) return null;
        return (
          <section className="facility" key={`${relation.placeId}-${index}`}>
            <h3>{place.name}</h3>
            {relation.status && (
              <span className={`status-badge ${relation.status}`}>
                {labels[relation.status]}
              </span>
            )}
            {relation.review === "needs-review" && (
              <p className="subtle">
                配布情報は再確認待ちです。原文と公式情報をご確認ください。
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
                この窓口の配布時間は未整理です。下記の原文・公式情報をご確認ください。
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
            <ExternalLink link={facilityMapLink(place, relation)} />
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
      {!relations.length && (
        <p>配布施設の登録なし。下記の文字情報・公式情報を確認してください。</p>
      )}
      <details className="source-notes">
        <summary>取得した配布情報の原文</summary>
        <p>{(card.placeText || []).join("\n")}</p>
        <p>{(card.hours || []).join("\n")}</p>
      </details>
      <h3 className="journey-heading">2. 蓋を見に行く・撮影する</h3>
      {lidLink && (
        <button
          className="primary-button"
          type="button"
          onClick={onShowLid}
          disabled={!mapReady}
        >
          このカードの蓋を見る
        </button>
      )}
      <ExternalLink link={lidLink} />
      {lidLink && (
        <p className="subtle">
          蓋の位置はカード印刷座標の読み取りを採用しています。現地位置の確認済みを意味しません。
        </p>
      )}
      {!lidLink && (
        <p className="subtle">
          蓋の位置は未確定または有効な座標なし：{card.lid.reason || ""}
        </p>
      )}
      {card.override && (
        <p>
          確認日：{card.override.checkedAt} / 確認者：{card.override.reviewer}
          {"\n"}
          {card.override.evidence}
        </p>
      )}
      {(card.links || []).map((value, index) => (
        <ExternalLink
          key={index}
          link={
            safeHttpUrl(value)
              ? { href: safeHttpUrl(value)!, label: "公式の確認先" }
              : null
          }
        />
      ))}
      <p className="subtle">
        一覧取得日：{card.acquired}。
        {data.evaluatedAt && `配布期間の判定日：${data.evaluatedAt}。`}
        訪問前に公式情報をご確認ください。
      </p>
    </>
  );
}
