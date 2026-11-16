import { RecordAction, RecordEditor } from "../records/records-entry";
import { useCallback, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { DestinationSymbol } from "./destination-symbol";
import { appliesLabel } from "../../domain/applies";
import { municipalityName } from "../../domain/card-presentation";
import { type CardCatalog, pinReasonLabels } from "../../domain/card-catalog";
import {
  facilityMapLink,
  lidMapLink,
  safeHttpUrl,
  type MapLink,
} from "../../domain/map-links";
import { shownFacilityId as selectShownFacilityId } from "../../domain/card-selection";
import { StatusChip } from "../../shared/ui/status-chip";
import { type Card, type Data } from "../../domain/types";

function ExternalLink({
  link,
  map = false,
  text,
  primary = false,
  lid,
}: {
  link: MapLink | null;
  map?: boolean;
  text?: string;
  primary?: boolean;
  lid?: boolean;
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
      {lid !== undefined && <DestinationSymbol lid={lid} />}
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
  selectedPinId?: string | undefined;
  showPrelude?: boolean;
  /** Supply page links or other controls in place of the internal map controls. */
  actions?: ReactNode;
  onExpand?: ((section?: "hours" | "places" | "record") => void) | undefined;
  summaryMode?: boolean;
  actionContainer?: HTMLElement | null | undefined;
  summaryReason?: string | undefined;
};

export function CardDetail(props: CardDetailProps) {
  return <CardDetailPage key={props.card.id} {...props} />;
}

function CardDetailPage({
  card,
  data,
  catalog,
  onShowLid,
  onShowPlaces,
  mapReady = false,
  showingLid = false,
  variant = "map",
  selectedPinId,
  actions,
  onExpand,
  actionContainer,
  summaryReason,
}: CardDetailProps) {
  const [recordOpen, setRecordOpen] = useState<string | null>(null);
  const [recordFocusRequest, setRecordFocusRequest] = useState(0);
  const closeRecord = useCallback(() => setRecordOpen(null), []);
  const isCatalog = variant === "catalog";
  // Reset selections with the card or tapped pin, without effect-driven state.
  const [selectedCounter, setSelectedCounter] = useState<number | null>(null);
  const [step, setStep] = useState<boolean | null>(null);
  const [shownFacilityId] = useState(() =>
    selectShownFacilityId(data, card.id, selectedPinId),
  );
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
  const destinationRelation = relations[selectedCounter ?? 0];
  const destination = data.places.find(
    (place) => place.id === destinationRelation?.placeId,
  );
  const destinationPaused =
    isPaused(card.status) || isPaused(destinationRelation?.status);
  const destinationLink = facilityMapLink(
    destination,
    destinationRelation,
    destinationPaused,
  );
  const lidMode =
    Boolean(lidLink) && (step ?? (showingLid || card.status === "ended"));
  const primaryLid = lidMode;
  const primaryLink = primaryLid ? lidLink : destinationLink;
  const primaryText = primaryLid
    ? "蓋へ行く"
    : destinationPaused
      ? "場所を見る"
      : destinationLink?.label.includes("位置未確定")
        ? "住所で検索"
        : "配布場所へ行く";
  const source = safeHttpUrl(
    destinationRelation?.evidence?.sourceUrl ||
      card.links?.find((link) => safeHttpUrl(link)) ||
      "",
  );
  const recordJump = import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
    <RecordAction
      key={card.id}
      ids={[card.id]}
      onExpand={() => {
        flushSync(() => {
          setRecordOpen(card.id);
          setRecordFocusRequest((request) => request + 1);
        });
        onExpand?.("record");
      }}
    />
  );
  const selectStep = (lid: boolean) => {
    setStep(lid);
    if (mapReady) {
      if (lid) onShowLid?.();
      else onShowPlaces?.();
    }
  };
  const summaryActions = (
    <div
      className={actionContainer ? "summary-actions" : "detail-destinations"}
    >
      <ExternalLink
        map
        primary
        lid={primaryLid}
        link={primaryLink}
        text={primaryText}
      />
    </div>
  );
  return (
    <div className="card-detail-content">
      {actionContainer ? createPortal(summaryActions, actionContainer) : null}
      <div className="sheet-summary">
        <div className="detail-stamp-heading">
          <div>
            <h3 className="facility-title" tabIndex={-1}>
              {municipalityName(card.city)}
            </h3>
            <p className="detail-prelude">
              {card.pref} · {card.series} ·{" "}
              <span className="card-stamp">{card.id}</span>
            </p>
          </div>
          {recordJump}
        </div>
        {summaryReason && <p className="summary-pin-reason">{summaryReason}</p>}
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari needs list semantics restored when list-style is none. */}
        <ol className="detail-route" role="list">
          <li>
            <h4>
              <button
                type="button"
                className="route-step"
                aria-pressed={!lidMode}
                onClick={() => selectStep(false)}
              >
                <DestinationSymbol />① 受け取る
              </button>
            </h4>
            {!hasFacilities && (
              <>
                <StatusChip status={card.status} />
                {isPaused(card.status) && (
                  <p className={`detail-status-band ${card.status}`}>
                    {pauseMessage(card.status, Boolean(lidLink), true)}
                  </p>
                )}
                <p>配布場所の登録なし。</p>
                {source && (
                  <ExternalLink
                    link={{ href: source, label: "配布情報の出典" }}
                  />
                )}
              </>
            )}
            {relations.map((relation, index) => {
              const place = data.places.find(
                (item) => item.id === relation.placeId,
              );
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
                  className="facility"
                  key={`${relation.placeId}-${index}`}
                >
                  {relations.length > 1 ? (
                    <button
                      type="button"
                      className="counter-choice"
                      aria-pressed={index === (selectedCounter ?? 0)}
                      onClick={() => {
                        setSelectedCounter(index);
                        selectStep(false);
                      }}
                    >
                      {relation.applies
                        ? `${appliesLabel(relation.applies, (id) => data.places.find((p) => p.id === id)?.name ?? id)} · `
                        : ""}
                      {place.name}
                    </button>
                  ) : (
                    <h3>{place.name}</h3>
                  )}
                  {index === (selectedCounter ?? 0) && (
                    <div className="counter-content">
                      <div className="detail-status">
                        <StatusChip status={status} />
                      </div>
                      {isPaused(status) && (
                        <p className={`detail-status-band ${status}`}>
                          {pauseMessage(status, Boolean(lidLink), true)}
                        </p>
                      )}
                      {hours?.length ? (
                        <p className="distribution-hours">{hours.join("\n")}</p>
                      ) : (
                        <p className="subtle">
                          この配布場所の配布時間は未確認です。配布情報の出典をご確認ください。
                        </p>
                      )}
                      {relation.review === "needs-review" && (
                        <p className="subtle">
                          配布情報は未確認です。出典をご確認ください。
                        </p>
                      )}
                      {(isCatalog ||
                        place.coordinate.status !== "confirmed" ||
                        place.locationReview?.status === "withdrawn") && (
                        <p>
                          {place.address || (isCatalog ? "住所の記載なし" : "")}
                        </p>
                      )}
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
                        place.locationReview?.status === "withdrawn") && (
                        <p className="subtle">
                          {place.locationReview?.status === "withdrawn"
                            ? "配布場所の位置は取り下げ済み"
                            : place.coordinate.status === "candidate"
                              ? "参考位置（未確定）"
                              : "地図の位置は未確定"}
                        </p>
                      )}
                      {place.locationReview?.status === "withdrawn" && (
                        <p className="subtle">{place.locationReview.reason}</p>
                      )}
                      {!isCatalog && !relation.evidence && source && (
                        <ExternalLink
                          link={{ href: source, label: "配布情報の出典" }}
                        />
                      )}
                      {relation.evidence && (
                        <>
                          <ExternalLink
                            link={
                              safeHttpUrl(relation.evidence.sourceUrl)
                                ? {
                                    href: safeHttpUrl(
                                      relation.evidence.sourceUrl,
                                    )!,
                                    label: "この配布情報の出典",
                                  }
                                : null
                            }
                          />
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </li>
          {lidLink && (
            <li>
              <h4>
                <button
                  type="button"
                  className="route-step"
                  aria-pressed={lidMode}
                  onClick={() => selectStep(true)}
                >
                  <DestinationSymbol lid />② 蓋を訪ねる
                </button>
              </h4>
              <p className="lid-note">
                カード記載の座標です。現地で確かめてください
              </p>
            </li>
          )}
        </ol>
      </div>
      <div className="sheet-extra">
        {isCatalog && (
          <>
            <p className="card-meta">発行日：{card.issued || "記載なし"}</p>
            {entry?.pinReasons.map((reason) => (
              <p className="subtle" key={reason}>
                {pinReasonLabels[reason]}
              </p>
            ))}
            {!hasFacilities && card.placeText?.length ? (
              <section className="original-place-text">
                <h3>原文の配布場所（配布場所の補足）</h3>
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
                            label: `カードの原文リンク（${new URL(link).hostname}${card.links!.filter((item) => safeHttpUrl(item) && new URL(item).hostname === new URL(link).hostname).length > 1 ? new URL(link).pathname + new URL(link).search : ""}）`,
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
        {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
          <RecordEditor
            cardId={card.id}
            collapsed={recordOpen !== card.id}
            focusRequest={recordFocusRequest}
            onUnreceived={closeRecord}
          />
        )}
        {actions}
        <p className="detail-source-note">
          訪問前に配布情報の出典をご確認ください。
        </p>
      </div>
      {!actionContainer && summaryActions}
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
