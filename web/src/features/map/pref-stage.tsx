import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Pin, Status } from "../../domain/types";
import type { PlacesFile } from "../../domain/public-views";
import type { Prefecture } from "../../prefectures";
import { StatusChip } from "../../shared/ui/status-chip";
import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { painted } from "../../shared/browser/painted";
import { mapFrame, selectionPadding, type MapSurround } from "./map-layout";
import { focusCamera } from "./map-levels";
import { NATIONAL_OUTLINE, OUTLINE_ORIGIN } from "./national-outline";
import {
  fitView,
  viewCamera,
  closerView,
  movedView,
  type StageView,
} from "./stage-camera";
import {
  CLOSER,
  FINGER_REACH,
  POINTER_REACH,
  STAGE_MAX_ZOOM,
  pressAt,
} from "./stage-press";
import { showStageDiagnostics } from "./stage-diagnostics";
import {
  useStageGestures,
  useStagePress,
  type StageMove,
} from "./stage-gestures";
import { StageCredit } from "./stage-credit";

/** A facility's square, as the map draws it (`map-resources.ts`). */
function PinMark({ status }: { status: Status }) {
  const hollow = status === "ended" || status === "unknown";
  return (
    <>
      <rect className="pin-rim" x={-10} y={-10} width={20} height={20} />
      <rect x={-8} y={-8} width={16} height={16} />
      {hollow && (
        <rect className="pin-rim" x={-6} y={-6} width={12} height={12} />
      )}
      {status === "suspended" && (
        <rect className="pin-rim" x={0} y={-6} width={6} height={12} />
      )}
    </>
  );
}

type Ledger = { kind: "press"; ids: string[] } | { kind: "all" };

/** Facilities by name, in ruled rows: those under a press, or them all. */
function StageLedger({
  label,
  pins,
  names,
  onChoose,
  onClose,
}: {
  label: string;
  pins: Pin[];
  names: ReadonlyMap<string, string>;
  onChoose(pin: Pin): void;
  onClose(): void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 一覧の中の Escape をこの section で受け、一覧を閉じる。
    <section
      className="stage-ledger"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="stage-ledger-head">
        <p>{label}</p>
        <button type="button" onClick={onClose}>
          閉じる
        </button>
      </div>
      <ul>
        {pins.map((pin, index) => (
          <li key={pin.id}>
            <button
              ref={index === 0 ? first : undefined}
              type="button"
              onClick={() => onChoose(pin)}
            >
              <span className="stage-ledger-name">{names.get(pin.id)}</span>
              <StatusChip status={pin.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const collator = new Intl.Collator("ja");
/** As far out as a drag or a pinch takes the drawing: Japan on a phone. */
const STAGE_MIN_ZOOM = 4;
/** The pixels of wheel turn that draw the view twice as close. */
const WHEEL_DOUBLE = 300;

/**
 * A prefecture drawn without the map engine: its outline and its facilities
 * where they stand, each pin in its state's colour, the map's own squares.
 * A press opens the facility under it. Where several are under it, the
 * drawing comes closer around the press; those no drawing tells apart are
 * listed by name. Every facility is also in a list, the keyboard's way in,
 * an island beyond the drawing included. A drag, a pinch or a wheel moves
 * the drawing and asks for the map that moves (`onWantMap`), which opens at
 * the `view` it left. While a list is open or a finger is down, the drawing
 * is in use (`onHold`): the map, ready or not, does not replace it.
 */
export function PrefStage({
  pref,
  file,
  pins,
  cameraPins,
  selected,
  view,
  onView,
  onChoose,
  onDismiss,
  onWantMap,
  onHold,
  surround,
}: {
  pref: Prefecture;
  file: PlacesFile;
  /** The facilities to draw: the prefecture's, as the records filter them. */
  pins: Pin[];
  /** The pins the map's camera fits a prefecture to (`focusCamera`). */
  cameraPins: Pin[];
  selected: Pin[];
  /** The view drawn, or null for the whole prefecture. */
  view: StageView | null;
  onView(view: StageView, closer: boolean): void;
  onChoose(pin: Pin): void;
  onDismiss(): void;
  onWantMap(): void;
  onHold(held: boolean): void;
  surround: MapSurround;
}) {
  const root = useRef<HTMLDivElement>(null);
  const land = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const listButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const watching = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      setSize((size) =>
        size?.width === width && size.height === height
          ? size
          : { width, height },
      );
    });
    watching.observe(element);
    return () => watching.disconnect();
  }, []);
  // As the map does: the prefecture is fitted clear of the panels as they
  // are when it opens, and stays where it is when a sheet comes over it.
  useLayoutEffect(() => {
    const element = root.current;
    if (view || !size?.width || !size.height || !element) return;
    onView(
      fitView(size.width, size.height, {
        ...focusCamera({ area: pref.area, pref: pref.name }, cameraPins),
        padding: selectionPadding(mapFrame(element, surround)),
      }),
      false,
    );
  }, [view, size, surround, onView, cameraPins, pref]);

  const camera =
    size && view ? viewCamera(size.width, size.height, view) : null;
  const spots = camera
    ? pins.map((pin) => ({ pin, x: camera.x(pin.lng), y: camera.y(pin.lat) }))
    : [];
  const names = new Map(file.pins.map((pin) => [pin.id, pin.name]));
  const offscreen =
    size &&
    spots.filter(
      ({ x, y }) => x < 0 || y < 0 || x > size.width || y > size.height,
    ).length;
  const chosen = new Set(selected.map((pin) => pin.id));

  // A drag or a pinch moves the drawing as it goes, and its view when the
  // fingers lift; a wheel draws it closer or further around the pointer.
  const place = (move: StageMove) => {
    const rect = land.current?.getBoundingClientRect();
    if (!rect) return move;
    return {
      ...move,
      x: move.x + (move.scale - 1) * rect.left,
      y: move.y + (move.scale - 1) * rect.top,
    };
  };
  const settle = (move: StageMove) => {
    if (!size || !view) {
      land.current?.style.removeProperty("transform");
      return;
    }
    const moved = movedView(size.width, size.height, view, move);
    const zoom = Math.min(STAGE_MAX_ZOOM, Math.max(STAGE_MIN_ZOOM, moved.zoom));
    // Past the limits, the centre stays where the fingers left it.
    onView({ ...moved, zoom }, true);
  };
  const dragged = useStageGestures(land, {
    onWant: onWantMap,
    onMove: (move) => {
      const { scale, x, y } = place(move);
      land.current?.style.setProperty(
        "transform",
        `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`,
      );
    },
    onMoved: (move) => settle(place(move)),
    onWheel: (event) => {
      const rect = land.current?.getBoundingClientRect();
      const turn =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1);
      if (!rect || !turn) return;
      const scale = 2 ** (-turn / WHEEL_DOUBLE);
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      settle({ scale, x: x - scale * x, y: y - scale * y });
    },
  });
  // The move is drawn at the view it left, in the same frame.
  useLayoutEffect(() => {
    land.current?.style.removeProperty("transform");
  }, [view]);
  const pressing = useStagePress(root);
  const held = pressing || ledger !== null;
  useEffect(() => {
    onHold(held);
  }, [held, onHold]);
  useEffect(() => () => onHold(false), [onHold]);
  // The latest of what a press reads.
  const pressed = useRef({
    spots,
    size,
    view,
    ledger,
    onChoose,
    onDismiss,
    onView,
  });
  useLayoutEffect(() => {
    pressed.current = {
      spots,
      size,
      view,
      ledger,
      onChoose,
      onDismiss,
      onView,
    };
  });
  useEffect(() => {
    const element = land.current;
    if (!element) return;
    const click = (event: MouseEvent) => {
      if (dragged.current) return;
      const { spots, size, view, ledger, onChoose, onDismiss, onView } =
        pressed.current;
      if (!size || !view) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left,
        y = event.clientY - rect.top;
      const reach =
        "pointerType" in event && event.pointerType === "mouse"
          ? POINTER_REACH
          : FINGER_REACH;
      const press = pressAt(
        spots.map(({ pin, x, y }) => ({ id: pin.id, x, y })),
        x,
        y,
        reach,
        view.zoom,
      );
      const pinOf = (id: string) => spots.find(({ pin }) => pin.id === id)!.pin;
      if (press.kind === "none") {
        if (ledger) setLedger(null);
        else onDismiss();
      } else if (press.kind === "one") {
        setLedger(null);
        onChoose(pinOf(press.id));
      } else if (press.kind === "closer") {
        setLedger(null);
        onView(
          closerView(
            size.width,
            size.height,
            view,
            { x, y },
            CLOSER,
            STAGE_MAX_ZOOM,
          ),
          true,
        );
      } else setLedger({ kind: "press", ids: press.ids });
    };
    element.addEventListener("click", click);
    return () => element.removeEventListener("click", click);
  }, [dragged]);

  // What a measurement presses, and when the pins can first be pressed.
  const drawnPins = spots.length > 0;
  useEffect(() => {
    if (!diagnosticsEnabled() || !drawnPins) return;
    let cancelled = false;
    void painted().then(() => {
      if (cancelled) return;
      performance.mark("stage-pins-ready");
      performance.measure("stage-pins", { start: 0, end: "stage-pins-ready" });
    });
    return () => {
      cancelled = true;
    };
  }, [drawnPins, pref.name]);
  useEffect(() => {
    if (!diagnosticsEnabled()) return;
    return showStageDiagnostics({
      view: () => {
        const { view } = pressed.current;
        return view
          ? { lng: view.center[0], lat: view.center[1], zoom: view.zoom }
          : { lng: 0, lat: 0, zoom: 0 };
      },
      tapPoint: () => {
        const { spots, size, view } = pressed.current;
        const element = land.current;
        if (!size || !view || !element) return null;
        const rect = element.getBoundingClientRect();
        const all = spots.map(({ pin, x, y }) => ({ id: pin.id, x, y }));
        for (const spot of all) {
          if (
            pressAt(all, spot.x, spot.y, POINTER_REACH, view.zoom).kind !==
            "one"
          )
            continue;
          // Not under a panel laid over the drawing.
          const hit = document.elementFromPoint(
            spot.x + rect.left,
            spot.y + rect.top,
          );
          if (hit && element.contains(hit)) return { x: spot.x, y: spot.y };
        }
        return null;
      },
    });
  }, []);

  const pinGroup = (pin: Pin, x: number, y: number) => (
    <g
      key={pin.id}
      data-pin={pin.id}
      data-status={pin.status}
      className="pref-stage-pin"
      transform={`translate(${x} ${y})`}
    >
      <PinMark status={pin.status} />
    </g>
  );
  const ledgerPins =
    ledger?.kind === "press"
      ? ledger.ids.flatMap((id) => pins.filter((pin) => pin.id === id))
      : ledger
        ? [...pins].sort((a, b) =>
            collator.compare(names.get(a.id) ?? "", names.get(b.id) ?? ""),
          )
        : [];
  const closeLedger = () => {
    const all = ledger?.kind === "all";
    setLedger(null);
    if (all) listButton.current?.focus({ preventScroll: true });
  };
  return (
    <div
      ref={root}
      className="level-stage pref-stage"
      data-measured={camera ? "" : undefined}
    >
      <svg
        ref={land}
        className="level-stage-land pref-stage-land"
        aria-hidden="true"
      >
        {camera && (
          <>
            <path
              d={NATIONAL_OUTLINE}
              transform={`translate(${camera.x(OUTLINE_ORIGIN.west)} ${camera.y(OUTLINE_ORIGIN.north)}) scale(${camera.scale * OUTLINE_ORIGIN.unit})`}
            />
            <g className="pref-stage-borders">
              {file.borders.map((line, index) => (
                <polyline
                  // The lines have no id; the file's order is fixed.
                  key={index}
                  points={line
                    .map(([lng, lat]) => `${camera.x(lng)},${camera.y(lat)}`)
                    .join(" ")}
                />
              ))}
            </g>
            <g className="pref-stage-pins">
              {spots.map(({ pin, x, y }) => pinGroup(pin, x, y))}
            </g>
            <g className="pref-stage-selection">
              {spots
                .filter(({ pin }) => chosen.has(pin.id))
                .map(({ pin, x, y }) => (
                  <g key={pin.id} transform={`translate(${x} ${y})`}>
                    <circle className="selection-outer" r={21} />
                    <circle className="selection-ring" r={18} />
                  </g>
                ))}
            </g>
          </>
        )}
      </svg>
      {camera && (
        <button
          ref={listButton}
          type="button"
          className="pref-stage-list"
          aria-expanded={ledger?.kind === "all"}
          onClick={() =>
            setLedger((open) => (open?.kind === "all" ? null : { kind: "all" }))
          }
        >
          施設の一覧 {pins.length}
          {offscreen ? (
            <span className="pref-stage-offscreen">図の外 {offscreen}</span>
          ) : null}
        </button>
      )}
      {ledger && (
        <StageLedger
          key={ledger.kind === "all" ? "all" : ledger.ids.join()}
          label={
            ledger.kind === "all" ? `${pref.name}の施設` : "押した所の施設"
          }
          pins={ledgerPins}
          names={names}
          onChoose={(pin) => {
            setLedger(null);
            onChoose(pin);
          }}
          onClose={closeLedger}
        />
      )}
      <StageCredit />
    </div>
  );
}
