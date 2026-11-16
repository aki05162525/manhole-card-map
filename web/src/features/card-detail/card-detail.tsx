import { RecordAction, RecordEditor } from "../records/records-entry";
import { useCallback, useId, useState, type ReactNode, type Ref } from "react";
import { createPortal, flushSync } from "react-dom";
import { DestinationSymbol } from "./destination-symbol";
import {
  cardCounters,
  isPaused,
  opensAtLid,
  type Counter,
} from "../../domain/card-counters";
import { municipalityName } from "../../domain/card-presentation";
import { type CardCatalog, pinReasonLabels } from "../../domain/card-catalog";
import { lidMapLink, safeHttpUrl, type MapLink } from "../../domain/map-links";
import { shownFacilityId } from "../../domain/card-selection";
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
      {text ?? link.label}
      <span aria-hidden="true"> ↗</span>
    </a>
  ) : null;
}

export type CardDetailProps = {
  card: Card;
  data: Data;
  catalog: CardCatalog | null;
  /** Additional information for the standalone catalog; shared facility content follows the same design. */
  variant?: "map" | "catalog";
  /** The pin the detail opened from: its counter comes first and is chosen. */
  selectedPinId?: string | undefined;
  /**
   * With `onShowLid` the step is the page's, so the map and the detail show
   * the same destination. Without it the detail keeps the step itself.
   */
  showingLid?: boolean;
  onShowLid?(): void;
  onShowPlaces?(): void;
  /** A counter was chosen as the place to receive the card. */
  onChoosePlace?(placeId: string): void;
  /** Supply page links or other controls in place of the internal map controls. */
  actions?: ReactNode;
  /** The summary sheet: widen it, to the counters or the record. */
  onExpand?: ((section?: "places" | "record") => void) | undefined;
  actionContainer?: HTMLElement | null | undefined;
  summaryReason?: string | undefined;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
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
  onChoosePlace,
  showingLid = false,
  variant = "map",
  selectedPinId,
  actions,
  onExpand,
  actionContainer,
  summaryReason,
  headingId,
  headingRef,
}: CardDetailProps) {
  const [recordOpen, setRecordOpen] = useState<string | null>(null);
  const [recordFocusRequest, setRecordFocusRequest] = useState(0);
  const closeRecord = useCallback(() => setRecordOpen(null), []);
  const group = useId();
  const isCatalog = variant === "catalog";
  const counters = cardCounters(
    data,
    card,
    shownFacilityId(data, card.id, selectedPinId),
  );
  const [chosenIndex, setChosenIndex] = useState(0);
  const chosen = counters[chosenIndex] ?? counters[0];
  const lidLink = lidMapLink(card.lid);
  const [ownLid, setOwnLid] = useState(() =>
    opensAtLid(data, card, selectedPinId),
  );
  const lidMode = lidLink !== null && (onShowLid ? showingLid : ownLid);
  const entry = isCatalog ? catalog?.entriesById.get(card.id) : undefined;
  const relations = data.relations.filter(
    (relation) => relation.cardId === card.id,
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
    // The current stop is the heading of what the summary shows of it.
    if (lid === lidMode) return onExpand?.();
    if (!onShowLid) setOwnLid(lid);
    else if (lid) onShowLid();
    else onShowPlaces?.();
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
  const counterList = counters.map((counter, index) => (
    <CounterItem
      key={index}
      counter={counter}
      chosen={counter === chosen}
      group={counters.length > 1 ? group : undefined}
      onChoose={() => {
        setChosenIndex(index);
        setOwnLid(false);
        onChoosePlace?.(counter.place.id);
      }}
      isCatalog={isCatalog}
      cardSource={isCatalog ? null : cardSource}
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
        <div className="detail-stamp-heading">
          <div>
            <h2
              className="detail-title"
              id={headingId}
              ref={headingRef}
              tabIndex={-1}
            >
              {municipalityName(card.city)}
            </h2>
            <p className="detail-prelude">
              {[card.pref, card.series].filter(Boolean).join(" · ")} ·{" "}
              <span className="card-stamp">{card.id}</span>
            </p>
          </div>
          {recordJump}
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
              <div className="route-body">
                <p className="lid-note">
                  カード記載の座標です。現地で確かめてください
                </p>
              </div>
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
            {!counters.length && card.placeText?.length ? (
              <section className="original-place-text">
                <h3>原文の配布場所（配布場所の補足）</h3>
                <p>{card.placeText.join("\n")}</p>
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
          <section className="card-original-hours">
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
  chosen,
  group,
  onChoose,
  isCatalog,
  cardSource,
}: {
  counter: Counter;
  chosen: boolean;
  /** The radio group's name; absent for a card's only counter. */
  group: string | undefined;
  onChoose(): void;
  isCatalog: boolean;
  /** The card's source, for a counter that has none of its own. */
  cardSource: string | null;
}) {
  const { relation, place } = counter;
  const withdrawn = place.locationReview?.status === "withdrawn";
  const unlocated = withdrawn || place.coordinate.status !== "confirmed";
  const address =
    isCatalog || unlocated
      ? place.address || (isCatalog ? "住所の記載なし" : "")
      : "";
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
