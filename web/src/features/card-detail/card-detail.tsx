import { RecordAction, RecordEditor } from "../records/records-entry";
import { useCallback, useId, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { CardImage } from "./card-image";
import { DestinationSymbol } from "./destination-symbol";
import {
  cardCounters,
  isPaused,
  type Counter,
} from "../../domain/card-counters";
import { municipalityName } from "../../domain/card-presentation";
import { lidMapLink, safeHttpUrl, type MapLink } from "../../domain/map-links";
import { shownFacilityId } from "../../domain/card-selection";
import { StatusChip } from "../../shared/ui/status-chip";
import { UpcomingChanges } from "../../shared/ui/upcoming-changes";
import type { Card, Data } from "../../domain/types";

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
      {text ?? link.label}
      <span aria-hidden="true"> ↗</span>
    </a>
  ) : null;
}

export type CardDetailProps = {
  card: Card;
  data: Data;
  /** The pin the detail opened from: its counter comes first and is chosen. */
  selectedPinId?: string | undefined;
  /**
   * The stop is the page's, so the map and the detail show the same
   * destination: the lid only for a card whose lid can be visited.
   */
  showingLid: boolean;
  onShowLid(): void;
  onShowPlaces(): void;
  /** A counter was chosen as the place to receive the card. */
  onChoosePlace(placeId: string): void;
  /** The summary sheet: widen it, to the counters or the record. */
  onExpand?: ((section?: "places" | "record") => void) | undefined;
  actionContainer?: HTMLElement | null | undefined;
  summaryReason?: string | undefined;
};

export function CardDetail(props: CardDetailProps) {
  return <CardDetailPage key={props.card.id} {...props} />;
}

function CardDetailPage({
  card,
  data,
  onShowLid,
  onShowPlaces,
  onChoosePlace,
  showingLid: lidMode,
  selectedPinId,
  onExpand,
  actionContainer,
  summaryReason,
}: CardDetailProps) {
  const [recordOpen, setRecordOpen] = useState<string | null>(null);
  const [recordFocusRequest, setRecordFocusRequest] = useState(0);
  const closeRecord = useCallback(() => setRecordOpen(null), []);
  const group = useId();
  const counters = cardCounters(
    data,
    card,
    shownFacilityId(data, card.id, selectedPinId),
  );
  const [chosenIndex, setChosenIndex] = useState(0);
  const chosen = counters[chosenIndex] ?? counters[0];
  const lidLink = lidMapLink(card.lid);
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
  );
  const facilityCount = new Set(relations.map((relation) => relation.placeId))
    .size;
  // The card-wide original stands in for counters only when there are none.
  const cardHours = card.hours?.join("\n") ?? "";
  const showCardHours = Boolean(cardHours) && facilityCount === 0;
  const cardSource = safeHttpUrl(
    card.links?.find((link) => safeHttpUrl(link)) || "",
  );
  const source =
    safeHttpUrl(chosen?.relation.evidence?.sourceUrl || "") ?? cardSource;
  const goLink = lidMode ? lidLink : (chosen?.link ?? null);
  // One destination at a time. A counter that cannot be handed to Google
  // Maps leaves its source to check, and nothing rather than an empty bar.
  const destination = goLink ? (
    <ExternalLink
      map
      primary
      lid={lidMode}
      link={goLink}
      text={
        lidMode
          ? "蓋へ行く"
          : chosen?.paused
            ? "場所を見る"
            : goLink.label.includes("位置未確定")
              ? "住所で検索"
              : "配布場所へ行く"
      }
    />
  ) : source ? (
    <ExternalLink
      map
      link={{ href: source, label: "配布情報の出典" }}
      text="出典で確認する"
    />
  ) : null;
  const destinationBar = destination && (
    <div
      className={actionContainer ? "summary-actions" : "detail-destinations"}
    >
      {destination}
    </div>
  );
  const recordJump = import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
    <RecordAction
      key={card.id}
      id={card.id}
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
    // The current stop is the heading of what the summary shows of it.
    if (lid === lidMode) return onExpand?.();
    if (lid) onShowLid();
    else onShowPlaces();
  };
  const step = (lid: boolean) => {
    const label = (
      <>
        <DestinationSymbol lid={lid} />
        {lid ? "② 蓋を訪ねる" : "① 受け取る"}
      </>
    );
    // Without a lid to visit there is one stop and nothing to switch.
    return (
      <h3>
        {lidLink ? (
          <button
            type="button"
            className="route-step"
            aria-current={lid === lidMode ? "step" : undefined}
            onClick={() => selectStep(lid)}
          >
            {label}
          </button>
        ) : (
          <span className="route-step">{label}</span>
        )}
      </h3>
    );
  };
  const placeName = (id: string) =>
    data.places.find((item) => item.id === id)?.name || id;
  const counterList = counters.map((counter, index) => (
    <CounterItem
      key={index}
      counter={counter}
      asOf={data.evaluatedAt}
      placeName={placeName}
      chosen={counter === chosen}
      group={counters.length > 1 ? group : undefined}
      onChoose={() => {
        setChosenIndex(index);
        onChoosePlace(counter.place.id);
      }}
      cardSource={cardSource}
    />
  ));
  // Rows of one place differ in period or hours; they are not another place to go.
  const otherPlaces =
    new Set(counters.map((counter) => counter.place.id)).size - 1;
  return (
    <div className="card-detail-content">
      {actionContainer && destinationBar
        ? createPortal(destinationBar, actionContainer)
        : null}
      <div className="sheet-summary">
        <div className="detail-head">
          <CardImage card={card} />
          <div className="detail-stamp-heading">
            <div>
              <h2 className="detail-title" tabIndex={-1}>
                {municipalityName(card.city)}
              </h2>
              <p className="detail-prelude">
                {[card.pref, card.series].filter(Boolean).join(" · ")} ·{" "}
                <span className="card-stamp">{card.id}</span>
              </p>
            </div>
            {recordJump}
          </div>
        </div>
        {summaryReason && <p className="summary-pin-reason">{summaryReason}</p>}
        {/* oxlint-disable-next-line jsx-a11y/no-redundant-roles -- Safari needs list semantics restored when list-style is none. */}
        <ol className="detail-route" role="list">
          <li className={`route-stop${lidMode ? "" : " is-current"}`}>
            <div className="route-head">
              {step(false)}
              {onExpand && counters.length > 1 && (
                <button
                  type="button"
                  className="route-more"
                  onClick={() => onExpand("places")}
                >
                  {otherPlaces
                    ? `ほか${otherPlaces}か所`
                    : `ほかの条件${counters.length - 1}件`}
                </button>
              )}
            </div>
            <div className="route-body">
              {counters.length > 1 ? (
                <fieldset className="counters">
                  <legend>窓口を選ぶ</legend>
                  {counterList}
                </fieldset>
              ) : counters.length ? (
                counterList
              ) : (
                <div className="counter is-chosen">
                  <p className="counter-choice">配布場所の登録なし</p>
                  <div className="counter-brief">
                    <StatusChip status={card.status} />
                    {isPaused(card.status) && (
                      <p className={`detail-status-band ${card.status}`}>
                        {pauseMessage(card.status)}
                      </p>
                    )}
                  </div>
                  {cardSource && (
                    <div className="counter-more">
                      <ExternalLink
                        link={{ href: cardSource, label: "配布情報の出典" }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
          {lidLink && (
            <li className={`route-stop${lidMode ? " is-current" : ""}`}>
              <div className="route-head">{step(true)}</div>
            </li>
          )}
        </ol>
      </div>
      <div className="sheet-extra">
        {showCardHours ? (
          <section className="card-original-hours">
            <p className="distribution-hours">{cardHours}</p>
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
      </div>
      {!actionContainer && destinationBar}
    </div>
  );
}

/**
 * A counter and, once chosen, what a visitor needs there. The summary sheet
 * shows the chosen one alone with its status and hours; the rest is CSS.
 */
function CounterItem({
  counter,
  asOf,
  placeName,
  chosen,
  group,
  onChoose,
  cardSource,
}: {
  counter: Counter;
  /** The data's evaluation date, which planned changes are as of. */
  asOf: string | undefined;
  placeName(id: string): string;
  chosen: boolean;
  /** The radio group's name; absent for a card's only counter. */
  group: string | undefined;
  onChoose(): void;
  /** The card's source, for a counter that has none of its own. */
  cardSource: string | null;
}) {
  const { relation, place } = counter;
  const withdrawn = place.locationReview?.status === "withdrawn";
  const unlocated = withdrawn || place.coordinate.status !== "confirmed";
  // Shown only to check where "住所で検索" leads.
  const address = unlocated ? place.address : "";
  const hours = counter.hours?.join("\n") ?? "";
  // The ledger often repeats the hours as the condition: say it once.
  const notes = [
    relation.condition,
    relation.periodRaw,
    relation.alternativeRaw,
  ]
    .filter((note) => note && note !== hours)
    .join("\n");
  const evidence = relation.evidence
    ? safeHttpUrl(relation.evidence.sourceUrl)
    : cardSource;
  const label = (
    <>
      {counter.when && <span className="counter-when">{counter.when}</span>}
      {counter.when && " "}
      <span className="counter-name">{counter.name}</span>
    </>
  );
  return (
    <div
      className={`counter${chosen ? " is-chosen" : ""}${counter.paused ? " is-paused" : ""}`}
    >
      {group ? (
        <label className="counter-choice">
          <input
            type="radio"
            name={group}
            checked={chosen}
            onChange={onChoose}
          />
          {label}
        </label>
      ) : (
        <p className="counter-choice">{label}</p>
      )}
      {chosen && (
        <div className="counter-detail">
          <div className="counter-brief">
            <StatusChip status={counter.status} />
            {counter.paused && (
              <p className={`detail-status-band ${counter.status}`}>
                {pauseMessage(counter.status)}
              </p>
            )}
            {hours ? (
              <p className="distribution-hours">{hours}</p>
            ) : (
              <p className="subtle counter-no-hours">
                配布時間は未確認です。出典をご確認ください。
              </p>
            )}
          </div>
          <div className="counter-more">
            {relation.review === "needs-review" && (
              <p className="subtle">
                配布情報は未確認です。出典をご確認ください。
              </p>
            )}
            {address && <p>{address}</p>}
            {notes && <p>{notes}</p>}
            {(relation.validFrom || relation.validTo) && (
              <p>
                適用期間：{relation.validFrom || "開始日未確認"} ～{" "}
                {relation.validTo || "終了日未指定"}
              </p>
            )}
            <UpcomingChanges
              relation={relation}
              asOf={asOf}
              placeName={placeName}
            />
            {unlocated && (
              <p className="subtle">
                {withdrawn
                  ? "配布場所の位置は取り下げ済み"
                  : place.coordinate.status === "candidate"
                    ? "参考位置（未確定）"
                    : "地図の位置は未確定"}
              </p>
            )}
            {withdrawn && place.locationReview?.reason && (
              <p className="subtle">{place.locationReview.reason}</p>
            )}
            {evidence && (
              <ExternalLink
                link={{
                  href: evidence,
                  label: relation.evidence
                    ? "この配布情報の出典"
                    : "配布情報の出典",
                }}
              />
            )}
          </div>
        </div>
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

function pauseMessage(status: Card["status"]) {
  return status === "suspended"
    ? "配布は一時中止中です"
    : "配布は終了しています";
}
