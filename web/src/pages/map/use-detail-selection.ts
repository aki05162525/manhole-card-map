import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  cardsForIds,
  detailCard,
  selectionPins,
  visiblePins,
} from "../../domain/card-selection";
import { createCardCatalog } from "../../domain/card-catalog";
import { opensAtLid } from "../../domain/card-counters";
import { lidMapLink } from "../../domain/map-links";
import type { MapPins } from "../../domain/public-views";
import type { Pin } from "../../domain/types";
import { useDetailData } from "../../features/card-data/use-card-data";
import type { Adapter } from "../../features/map/types";
import { readMapCardUrl } from "../../shared/url/catalog-url";
import { useMapUrlState } from "./use-map-url-state";
import { mapSearchScreen } from "./map-search-state";
/**
 * The same array while its pins are the same, so the map does not draw
 * them again when the details arrive behind the pins.
 */
export function useKeptPins(pins: Pin[]) {
  const [kept, setKept] = useState(pins);
  if (
    pins === kept ||
    (pins.length === kept.length &&
      pins.every((pin, index) => pin === kept[index]))
  )
    return kept;
  setKept(pins);
  return pins;
}
const NO_IDS: string[] = [];
/**
 * The map has its pins alone: a pin can be chosen and a card URL shows its
 * places at once. The cards follow as `data`, which holds the details of
 * the chosen cards' prefectures and nothing of the others.
 */
export function useDetailSelection(
  source: MapPins | null,
  adapterRef: RefObject<Adapter | undefined>,
) {
  const [selection, setSelection] = useState<{
    ids: string[];
    selectedId?: string | undefined;
    /** The place pin tapped on the map; it stays through the detail. */
    pinId?: string | undefined;
    /** The counter chosen in the detail, in place of the tapped pin. */
    placeId?: string | undefined;
    /** The stop chosen in the detail; until then `opensAtLid` decides. */
    step?: "receive" | "lid" | undefined;
    started: number;
  } | null>(null);
  const [choice, setChoice] = useState("");
  // The card the URL names is asked for before it is known to exist: the
  // URL's own state below needs the answer to say whether it does.
  const [requested, setRequested] = useState(
    () => readMapCardUrl(location.href).card,
  );
  const {
    data,
    error: detailError,
    action: retryDetailLabel,
    retry: retryDetail,
  } = useDetailData(
    source,
    useMemo(
      () =>
        requested && !selection?.ids.includes(requested)
          ? [...(selection?.ids ?? NO_IDS), requested]
          : (selection?.ids ?? NO_IDS),
      [selection, requested],
    ),
  );
  const cards = useMemo(
    () => new Map(data?.cards.map((card) => [card.id, card]) || []),
    [data],
  );
  // Which cards have a pin is known with every pin; without them (not read
  // yet, or they could not be read) nothing is said of it.
  const catalog = useMemo(
    () => (data && source && !source.partial ? createCardCatalog(data) : null),
    [data, source],
  );
  const cardIds = useMemo(
    () => (data ? new Set(cards.keys()) : undefined),
    [data, cards],
  );
  const {
    cardId,
    requestedCard,
    urlStep,
    issues,
    selectCard,
    closeCard,
    search,
    updateSearch,
    openSearch,
    closeSearch,
    dismissCard,
  } = useMapUrlState(cardIds);
  if (requestedCard !== requested) setRequested(requestedCard);
  const searching = mapSearchScreen(search, cardId) === "S";
  const searchDetail = search.phase === "detail";
  const group = useMemo(
    () => cardsForIds(cards, selection?.ids || []),
    [cards, selection],
  );
  const selected = detailCard(group, selection?.selectedId);
  // The card whose lid is the destination: "② 蓋を訪ねる" in its detail.
  // Derived, so the map and the detail cannot show different stops, and a
  // stop chosen before the map is ready reaches it with the selection.
  const revealedLid =
    data &&
    selected &&
    lidMapLink(selected.lid) &&
    (selection?.step
      ? selection.step === "lid"
      : opensAtLid(data, selected, selection?.pinId))
      ? selected.id
      : undefined;
  const pins = useKeptPins(
    useMemo(
      () => visiblePins(source, false, revealedLid),
      [source, revealedLid],
    ),
  );
  // One pin when a pin was tapped or a counter chosen; a counter without a
  // pin emphasises nothing rather than another place.
  const placePins = useMemo(() => {
    const places = pins.filter((pin) => pin.kind === "place");
    const one = selection?.placeId ?? selection?.pinId;
    return one
      ? places.filter((pin) => pin.id === one)
      : selectionPins(places, selected ? [selected.id] : selection?.ids || []);
  }, [pins, selected, selection]);
  const selectedPins = useMemo(
    () =>
      revealedLid
        ? pins.filter(
            (pin) => pin.kind === "lid" && pin.cardIds.includes(revealedLid),
          )
        : !data && selection?.step === "lid"
          ? []
          : placePins,
    [pins, placePins, revealedLid, data, selection?.step],
  );
  const show = useCallback(
    (
      ids: string[],
      selectedId?: string,
      started = performance.now(),
      pinId?: string,
    ) => {
      const pin = pinId
        ? source?.pins.find((pin) => pin.id === pinId)
        : undefined;
      setSelection({
        ids,
        selectedId: selectedId ?? (ids.length === 1 ? ids[0] : undefined),
        started,
        ...(pin?.kind === "lid" ? { step: "lid" } : { pinId }),
      });
      setChoice(ids[0] || "");
    },
    [source],
  );
  // The lid's pin leaves the map with the detail: bring the camera back to
  // where the card is received before the selection goes.
  function restorePlaces() {
    if (revealedLid) adapterRef.current?.select(placePins);
  }
  const restorePlacesOnClose = useEffectEvent(restorePlaces);
  function clearSelection() {
    restorePlaces();
    setSelection(null);
  }
  // Apply a URL destination once, preserving choices made as data arrives.
  const applied = useRef<{ cardId: string | null; step?: "lid" | undefined }>({
    cardId: null,
  });
  useEffect(() => {
    const stepChanged = applied.current.step !== urlStep;
    const sameCard = applied.current.cardId === cardId;
    const changed = !sameCard || stepChanged;
    applied.current = { cardId, step: urlStep };
    if (!changed && !data) return;
    if (cardId && (!data || cards.has(cardId))) {
      setSelection((current) =>
        (current?.selectedId === cardId &&
          !(stepChanged && (sameCard || urlStep))) ||
        (current && !changed)
          ? current
          : {
              ...(current?.ids.includes(cardId) ? current : { ids: [cardId] }),
              selectedId: cardId,
              placeId: undefined,
              step: urlStep,
              started: performance.now(),
            },
      );
      setChoice(cardId);
    } else if (changed || cardId) {
      restorePlacesOnClose();
      setSelection(null);
    }
  }, [cardId, cards, data, urlStep]);
  /**
   * The selection is no one card's (a pin several cards share): the URL
   * stops naming the card chosen before, so that card's details are not
   * waited for and a reload does not open it. The selection being made
   * stays; it is not the URL's to clear.
   */
  const releaseCard = useCallback(() => {
    if (!readMapCardUrl(location.href).card) return;
    applied.current = { cardId: null };
    dismissCard();
  }, [dismissCard]);
  const chooseStep = useCallback(
    (step: "receive" | "lid") =>
      setSelection((current) =>
        current && current.step !== step ? { ...current, step } : current,
      ),
    [],
  );
  const showLid = useCallback(() => chooseStep("lid"), [chooseStep]);
  const showPlaces = useCallback(() => chooseStep("receive"), [chooseStep]);
  /** Choosing where to receive the card is also choosing to receive it. */
  const choosePlace = useCallback(
    (placeId: string) =>
      setSelection((current) =>
        current && (current.placeId !== placeId || current.step === "lid")
          ? { ...current, placeId, step: "receive" }
          : current,
      ),
    [],
  );
  return {
    revealedLid,
    selection,
    clearSelection,
    choice,
    setChoice,
    data,
    detailError,
    retryDetailLabel,
    retryDetail,
    cards,
    catalog,
    cardId,
    issues,
    selectCard,
    releaseCard,
    closeCard,
    search,
    updateSearch,
    openSearch,
    closeSearch,
    dismissCard,
    searching,
    searchDetail,
    group,
    selected,
    pins,
    selectedPins,
    show,
    showLid,
    showPlaces,
    choosePlace,
  };
}
