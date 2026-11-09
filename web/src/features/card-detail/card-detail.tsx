import { ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { SummaryHours } from "./summary-hours";
import { municipalityName } from "../../domain/card-presentation";
import { type CardCatalog, pinReasonLabels } from "../../domain/card-catalog";
import {
  facilityMapLink,
  lidMapLink,
  safeHttpUrl,
  type MapLink,
} from "../../domain/map-links";
import { selectionPins, visiblePins } from "../../domain/card-selection";
import { StatusChip } from "../../shared/ui/status-chip";
import { type Card, type Data } from "../../domain/types";

function ExternalLink({
  link,
  map = false,
  text,
  primary = false,
}: {
  link: MapLink | null;
  map?: boolean;
  text?: string;
  primary?: boolean;
}) {
  return link ? (
    <a
      className={
        map ? `map-link${primary ? " primary-destination" : ""}` : "source-link"
      }
      href={link.href}
      title={link.label}
      target="_blank"
      rel="noopener noreferrer"
    >
      {text ??
        (map
          ? link.label === "蓋のGoogleマップへ"
            ? link.label
            : "Googleマップへ"
          : link.label)}
      <span aria-hidden="true"> ↗</span>
    </a>
  ) : null;
}

export type CardDetailProps = {
  card: Card;
  data: Data;
  catalog: CardCatalog | null;
  onShowLid?(): void;
  onShowPlaces?(): void;
  mapReady?: boolean;
  showingLid?: boolean;
  /** Additional information for the standalone catalog; shared facility content follows the same design. */
  variant?: "map" | "catalog";
  selectedPinId?: string;
  showPrelude?: boolean;
  /** Supply page links or other controls in place of the internal map controls. */
  actions?: ReactNode;
  onExpand?(section?: "hours" | "places"): void;
  summaryMode?: boolean;
  actionContainer?: HTMLElement | null;
};

export function CardDetail({
  card,
  data,
  catalog,
  onShowLid,
  onShowPlaces,
  mapReady = false,
  showingLid = false,
  variant = "map",
  selectedPinId,
  showPrelude = true,
  actions,
  onExpand,
  summaryMode = false,
  actionContainer,
}: CardDetailProps) {
  const isCatalog = variant === "catalog";
  const shownFacilityId =
    selectedPinId ??
    selectionPins(visiblePins(data, false), [card.id]).find(
      (pin) => pin.kind === "place",
    )?.id;
  const relations = data.relations
    .filter((relation) => relation.cardId === card.id)
    .sort(
      (a, b) =>
        Number(b.placeId === shownFacilityId) -
        Number(a.placeId === shownFacilityId),
    );
  const lidLink = lidMapLink(card.lid);
  const entry = isCatalog ? catalog?.entriesById.get(card.id) : undefined;
  const hasFacilities = relations.some((relation) =>
    data.places.some((place) => place.id === relation.placeId),
  );
  const facilityCount = new Set(relations.map((relation) => relation.placeId))
    .size;
  // Repeat the card-wide original only where it adds information to the counters.
  const cardHours = card.hours?.join("\n") ?? "";
  const showCardHours =
    Boolean(cardHours) &&
    (facilityCount === 0 ||
      (facilityCount > 1 &&
        relations.some(
          (relation) =>
            !relation.hours?.length || relation.hours.join("\n") !== cardHours,
        )));
  const destinationRelation = relations[0];
  const destination = data.places.find(
    (place) => place.id === destinationRelation?.placeId,
  );
  const destinationLink = facilityMapLink(destination, destinationRelation);
  const destinationPaused =
    isPaused(card.status) || isPaused(destinationRelation?.status);
  const route =
    destinationLink && !destinationPaused
      ? {
          ...destinationLink,
          href: destinationLink.href
            .replace("/maps/search/?", "/maps/dir/?")
            .replace("query=", "destination="),
        }
      : destinationLink;
  const primaryStatus = isPaused(card.status)
    ? card.status
    : destinationRelation?.status || card.status;
  const source = safeHttpUrl(
    destinationRelation?.evidence?.sourceUrl ||
      card.links?.find((link) => safeHttpUrl(link)) ||
      "",
  );
  const summaryCounters = onExpand ? (
    <>
      {facilityCount > 1 && (
        <button
          type="button"
          className="summary-counters"
          onClick={() => onExpand("places")}
        >
          この地点・ほか{facilityCount - 1}か所 ›
        </button>
      )}
    </>
  ) : null;
  const summaryActions = onExpand ? (
    <div className="summary-actions">
      <ExternalLink
        map
        primary
        link={primaryStatus === "ended" ? lidLink : route}
        text={
          primaryStatus === "ended"
            ? "蓋の場所"
            : destinationLink?.label.includes("位置未確定")
              ? "Googleマップで住所を検索"
              : destinationPaused
                ? "Googleマップで場所を見る"
                : "Googleマップで経路"
        }
      />
      <button
        type="button"
        className="sheet-more"
        hidden={!summaryMode && Boolean(actionContainer)}
        aria-expanded={!summaryMode}
        onClick={() => onExpand()}
      >
        詳しく <ChevronUp size={16} aria-hidden="true" />
      </button>
      {actionContainer &&
        !summaryMode &&
        primaryStatus !== "ended" &&
        onShowLid &&
        onShowPlaces && (
          <CardMapActions
            card={card}
            data={data}
            onShowLid={onShowLid}
            onShowPlaces={onShowPlaces}
            mapReady={mapReady}
            showingLid={showingLid}
          />
        )}
    </div>
  ) : null;
  const facilityIntroduction = (
    <div className="sheet-extra">
      {facilityCount > 1 && (
        <h3 className="facility-title">
          {facilityCount}
          か所で受け取れます
        </h3>
      )}
      {relations.length > 1 && (
        <p>配布施設は曜日・条件を確認して選んでください。</p>
      )}
    </div>
  );
  return (
    <div className="card-detail-content">
      {actionContainer && summaryActions
        ? createPortal(summaryActions, actionContainer)
        : null}
      {showPrelude && (
        <p className="detail-prelude">
          <span className="card-stamp">{card.id}</span> ·{" "}
          {!isCatalog && (
            <>
              {card.pref} {municipalityName(card.city)} ·{" "}
            </>
          )}
          {card.series}
        </p>
      )}
      {!onExpand && facilityIntroduction}
      {!hasFacilities && (
        <div className="sheet-summary">
          <h3 className="facility-title">{municipalityName(card.city)}</h3>
          <div className="detail-status">
            <StatusChip status={card.status} />
            <span>在庫は保証されません</span>
            <span>基準日：{data.evaluatedAt || "記載なし"}</span>
          </div>
          {isPaused(card.status) ? (
            <p className={`detail-status-band ${card.status}`}>
              {pauseMessage(card.status, Boolean(lidLink), Boolean(onExpand))}
            </p>
          ) : onExpand ? (
            card.hours?.length ? (
              <SummaryHours
                hours={card.hours}
                summaryMode={true}
                onExpand={() => onExpand("hours")}
              />
            ) : (
              <p>
                配布時間の記載なし
                {source && (
                  <ExternalLink
                    link={{ href: source, label: "配布情報の出典" }}
                  />
                )}
              </p>
            )
          ) : null}
          {summaryCounters}
          {!actionContainer && summaryActions}
        </div>
      )}
      {relations.map((relation, index) => {
        const place = data.places.find((item) => item.id === relation.placeId);
        if (!place) return null;
        const status = isPaused(card.status)
          ? card.status
          : relation.status || card.status;
        const hours = relation.hours?.length
          ? relation.hours
          : facilityCount === 1
            ? card.hours
            : null;
        return (
          <section
            className={`facility${index > 0 ? " sheet-extra" : ""}`}
            key={`${relation.placeId}-${index}`}
          >
            <div className={index === 0 ? "sheet-summary" : undefined}>
              <div className="facility-heading">
                <h3>{place.name}</h3>
                {facilityCount > 1 && place.id === shownFacilityId && (
                  <span className="this-place">この地点</span>
                )}
              </div>
              <div className="detail-status">
                <StatusChip status={status} />
                <span>在庫は保証されません</span>
                <span>基準日：{data.evaluatedAt || "記載なし"}</span>
              </div>
              {isPaused(status) && (
                <p className={`detail-status-band ${status}`}>
                  {pauseMessage(
                    status,
                    Boolean(lidLink),
                    Boolean(onExpand) && index === 0,
                  )}
                </p>
              )}
              {onExpand && index === 0 && !isPaused(status) ? (
                hours?.length ? (
                  <SummaryHours
                    hours={hours}
                    summaryMode={true}
                    onExpand={() => onExpand("hours")}
                  />
                ) : (
                  <p className="summary-missing-hours">
                    配布時間の記載なし
                    {source && (
                      <ExternalLink
                        link={{ href: source, label: "配布情報の出典" }}
                      />
                    )}
                  </p>
                )
              ) : null}
              {index === 0 && summaryCounters}
              {index === 0 && !actionContainer && summaryActions}
            </div>
            <div className="sheet-extra">
              {onExpand && index === 0 && facilityIntroduction}
              <div>
                {hours?.length ? (
                  <p className="distribution-hours detail-full-hours">
                    {hours.join("\n")}
                  </p>
                ) : (
                  <p className="subtle">
                    この窓口の配布時間は未整理です。配布情報の出典をご確認ください。
                  </p>
                )}
              </div>

              {isCatalog && (
                <p>
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
                {place.address || (isCatalog ? "住所の記載なし" : "")}
                {place.phone && (
                  <>
                    <br />
                    <a href={`tel:${place.phone.replace(/[^+0-9-]/g, "")}`}>
                      {place.phone}
                    </a>
                  </>
                )}
              </p>
              <p>
                {[
                  relation.condition,
                  relation.periodRaw,
                  relation.alternativeRaw,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </p>
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
              {relations.length > 1 &&
                relation.placeId !== destinationRelation?.placeId && (
                  <ExternalLink
                    map
                    link={facilityMapLink(place, relation)}
                    text={`${place.name}をGoogleマップで場所を見る`}
                  />
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
            </div>
          </section>
        );
      })}
      <div className="sheet-extra">
        {!(isCatalog ? hasFacilities : relations.length) && (
          <p>配布施設の登録なし。</p>
        )}
        {isCatalog && (
          <>
            <p className="card-meta">発行日：{card.issued || "記載なし"}</p>
            <p>{entry?.hasPin ? "配布施設ピンあり" : "配布施設ピンなし"}</p>
            {entry?.pinReasons.map((reason) => (
              <p className="subtle" key={reason}>
                {pinReasonLabels[reason]}
              </p>
            ))}
            {!hasFacilities && card.placeText?.length ? (
              <section className="original-place-text">
                <h3>原文の配布場所（構造化した施設情報の補足）</h3>
                <p>
                  {card.placeText?.length
                    ? card.placeText.join("\n")
                    : "配布場所の原文の記載なし"}
                </p>
              </section>
            ) : null}
            {card.links?.some((link) => safeHttpUrl(link))
              ? [...new Set(card.links)].map((link) => (
                  <ExternalLink
                    key={link}
                    link={
                      safeHttpUrl(link)
                        ? {
                            href: safeHttpUrl(link)!,
                            label: "カードの原文リンク",
                          }
                        : null
                    }
                  />
                ))
              : null}
          </>
        )}
        {showCardHours ? (
          <section className="card-original-hours detail-full-hours">
            {facilityCount > 1 && <h3>カード全体の配布時間（原文）</h3>}
            <p
              className={
                facilityCount > 1
                  ? "card-original-hours-text"
                  : "distribution-hours"
              }
            >
              {cardHours}
            </p>
          </section>
        ) : null}
        <MissingFields
          card={card}
          hasHours={relations.some((relation) =>
            Boolean(relation.hours?.length),
          )}
        />
        {actionContainer && showingLid && <ExternalLink map link={lidLink} />}
        {actions}
        <p className="detail-source-note">
          非公式の案内です。訪問前に配布情報の出典をご確認ください。
        </p>
      </div>
      {!actionContainer && (
        <div className="detail-destinations sheet-extra">
          <ExternalLink
            map
            primary
            link={route}
            text={
              destinationPaused
                ? "Googleマップで場所を見る"
                : "Googleマップで経路"
            }
          />
          {!isCatalog && onShowLid && onShowPlaces ? (
            <CardMapActions
              card={card}
              data={data}
              onShowLid={onShowLid}
              onShowPlaces={onShowPlaces}
              mapReady={mapReady}
              showingLid={showingLid}
            />
          ) : null}
          {isCatalog && <ExternalLink map link={lidLink} text="蓋の場所" />}
        </div>
      )}
    </div>
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
          蓋の場所
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

function MissingFields({ card, hasHours }: { card: Card; hasHours: boolean }) {
  const missing = [
    !hasHours && !card.hours?.length && "配布時間の記載なし",
    !card.links?.some((link) => safeHttpUrl(link)) && "原文リンクの記載なし",
    !card.placeText?.length && "配布場所の原文の記載なし",
  ].filter(Boolean);
  return missing.length ? (
    <p className="missing-fields">
      {missing.map((field, index) => (
        <span key={index}>{field}</span>
      ))}
    </p>
  ) : null;
}

function isPaused(status: Card["status"] | undefined) {
  return status === "ended" || status === "suspended";
}

function pauseMessage(
  status: Card["status"],
  hasLid: boolean,
  summary = false,
) {
  if (summary)
    return status === "suspended"
      ? "配布は一時中止中です"
      : "配布は終了しています";
  return status === "suspended"
    ? "配布は一時中止中です。再開は公式情報で確認してください。"
    : hasLid
      ? "配布は終了しています。蓋は訪ねられます。"
      : "配布は終了しています。最新情報は出典で確認してください。";
}
