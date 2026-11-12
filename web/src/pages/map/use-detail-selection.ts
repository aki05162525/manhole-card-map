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
    pinId?: string | undefined;
    revealedLid?: string | undefined;
    started: number;
  } | null>(null);
  const revealedLid = selection?.revealedLid;
  const setRevealedLid = useCallback((id?: string) => {
    setSelection((current) =>
      current ? { ...current, revealedLid: id, pinId: undefined } : current,
    );
  }, []);
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
  const pins = useKeptPins(
    useMemo(
      () => visiblePins(source, false, revealedLid),
      [source, revealedLid],
    ),
  );
  const selectedPins = useMemo(
    () =>
      selection?.pinId
        ? pins.filter((pin) => pin.id === selection.pinId)
        : selectionPins(
            pins.filter((pin) =>
              revealedLid ? pin.kind === "lid" : pin.kind === "place",
            ),
            selected ? [selected.id] : selection?.ids || [],
          ),
    [pins, selected, selection, revealedLid],
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
        pinId,
        revealedLid: pin?.kind === "lid" ? ids[0] : undefined,
      });
      setChoice(ids[0] || "");
    },
    [source],
  );
  const restorePlacesOnClose = useEffectEvent(() => {
    if (revealedLid && selected) {
      adapterRef.current?.select(
        selectionPins(visiblePins(data, false), [selected.id]),
      );
    }
  });
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
              revealedLid: undefined,
              started: performance.now(),
            },
      );
      setChoice(cardId);
    } else if (changed || cardId) {
      restorePlacesOnClose();
      setSelection(null);
    }
  }, [cardId, cards, data]);
  function showLid() {
    if (!selected || !lidMapLink(selected.lid)) return;
    setRevealedLid(selected.id);
    adapterRef.current?.select(
      (data?.pins || []).filter(
        (pin) => pin.kind === "lid" && pin.cardIds.includes(selected.id),
      ),
    );
  }
  function showPlaces() {
    setRevealedLid(undefined);
    if (selected)
      adapterRef.current?.select(
        selectionPins(visiblePins(data, false), [selected.id]),
      );
  }
  return {
    revealedLid,
    setRevealedLid,
    selection,
    setSelection,
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
  };
}
