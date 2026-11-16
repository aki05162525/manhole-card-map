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
import type { Data, Pin } from "../../domain/types";
import type { Adapter } from "../../features/map/types";
import { useMapUrlState } from "./use-map-url-state";
import { mapSearchScreen } from "./map-search-state";
/**
 * The same array while its pins are the same, so the map does not draw
 * them again when the details arrive behind the pins.
 */
export function useKeptPins(pins: Pin[]) {
  const kept = useRef(pins);
  const previous = kept.current;
  if (
    pins !== previous &&
    (pins.length !== previous.length ||
      pins.some((pin, index) => pin !== previous[index]))
  )
    kept.current = pins;
  return kept.current;
}
/**
 * `source` is the data, or before the details arrive, the pins alone: a
 * pin can be chosen and a card URL shows its places, and the cards follow.
 */
export function useDetailSelection(
  data: Data | null,
  source: Parameters<typeof visiblePins>[0],
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
  const cards = useMemo(
    () => new Map(data?.cards.map((card) => [card.id, card]) || []),
    [data],
  );
  const catalog = useMemo(
    () => (data ? createCardCatalog(data) : null),
    [data],
  );
  const cardIds = useMemo(
    () => (data ? new Set(cards.keys()) : undefined),
    [data, cards],
  );
  const {
    cardId,
    issues,
    selectCard,
    closeCard,
    search,
    updateSearch,
    openSearch,
    closeSearch,
    dismissCard,
  } = useMapUrlState(cardIds);
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
        : placePins,
    [pins, placePins, revealedLid],
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
  // Before the details, a card URL is taken as it is and shows the card's
  // places; on their arrival it is checked, and what was chosen meanwhile
  // stays.
  const appliedCardId = useRef<string | null>(null);
  useEffect(() => {
    const changed = appliedCardId.current !== cardId;
    appliedCardId.current = cardId;
    if (!changed && !data) return;
    if (cardId && (!data || cards.has(cardId))) {
      setSelection((current) =>
        current?.selectedId === cardId || (current && !changed)
          ? current
          : {
              ...(current?.ids.includes(cardId) ? current : { ids: [cardId] }),
              selectedId: cardId,
              placeId: undefined,
              step: undefined,
              started: performance.now(),
            },
      );
      setChoice(cardId);
    } else if (changed || cardId) {
      restorePlacesOnClose();
      setSelection(null);
    }
  }, [cardId, cards, data]);
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
    cards,
    catalog,
    cardId,
    issues,
    selectCard,
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
