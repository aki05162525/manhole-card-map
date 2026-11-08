import {
  useCallback,
  useEffect,
  useMemo,
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
import type { Data } from "../../domain/types";
import type { Adapter } from "../../features/map/types";
import { useMapUrlState } from "./use-map-url-state";
import { mapSearchScreen } from "./map-search-state";
export function useDetailSelection(
  data: Data | null,
  adapterRef: RefObject<Adapter | undefined>,
) {
  const [selection, setSelection] = useState<{
    ids: string[];
    selectedId?: string;
    pinId?: string;
    revealedLid?: string;
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
  const pins = useMemo(
    () => visiblePins(data, false, revealedLid),
    [data, revealedLid],
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
        ? data?.pins.find((pin) => pin.id === pinId)
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
    [data],
  );
  useEffect(() => {
    if (cardId && cards.has(cardId)) {
      setSelection((current) =>
        current?.selectedId === cardId
          ? current
          : {
              ...(current?.ids.includes(cardId) ? current : { ids: [cardId] }),
              selectedId: cardId,
              started: performance.now(),
            },
      );
      setChoice(cardId);
    } else {
      setSelection(null);
    }
  }, [cardId, cards]);
  function showLid() {
    if (!selected) return;
    setRevealedLid(selected.id);
    adapterRef.current?.select(
      (data?.pins || []).filter(
        (pin) =>
          pin.kind === "lid" &&
          !pin.reference &&
          pin.cardIds.includes(selected.id),
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
