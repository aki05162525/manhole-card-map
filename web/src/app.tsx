import { startOfflineUpdates, type OfflineState } from "./offline-update";
import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  cardsForIds,
  detailCard,
  facilityMapLink,
  lidMapLink,
  safeHttpUrl,
  type MapLink,
} from "./ui";
import {
  matchingCards,
  parseStoredView,
  selectionPins,
  visiblePins,
} from "./explorer-state";
import { labels, painted, type Adapter, type Card, type Data } from "./types";

// Start fetching the map code alongside card data. The immediate rejection
// handler keeps a failed chunk from becoming an unhandled promise rejection.
const mapModule = import("./card-map").then(
  (module) => ({ module }),
  (error: unknown) => ({ error }),
);
const CardMap = lazy(async () => {
  const result = await mapModule;
  if ("error" in result) throw result.error;
  return result.module;
});
const params = new URLSearchParams(location.search);
const metrics = {
  engine: "mapcn",
  mode: params.get("data") === "split" ? "split" : "full",
  ready: 0,
  taps: [] as number[],
  errors: [] as string[],
};
let activeAdapter: Adapter | undefined;
Object.assign(window, {
  prototype: {
    metrics,
    painted,
    get adapter() {
      return activeAdapter;
    },
  },
});

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}
async function loadData(): Promise<Data> {
  performance.mark("data-requested");
  if (metrics.mode === "full") return json("/data/full.json");
  const [pins, details] = await Promise.all([
    json("/data/pins.json"),
    json("/data/details.json"),
  ]);
  if (pins.updated !== details.updated)
    throw new Error("データの版が一致しない");
  return { ...details, pins: pins.pins };
}

class MapBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(String(error));
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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

function SourceNotes() {
  return (
    <details className="source-notes">
      <summary>データの出典と注意</summary>
      <div className="source-content">
        <p>
          非公式の検証用アプリです。在庫は未確認。訪問前に公式情報を確認してください。
        </p>
        <p>
          カード情報：保存済みの GKP
          一覧（画像は使用しない）。配布場所の確定状態は詳細に表示。参考位置は訪問先の確定座標ではありません。
        </p>
        <p>
          座標候補：
          <a href="https://www.digital.go.jp/policies/base_registry_address">
            デジタル庁 ABR
          </a>
          （PDL1.0）、
          <a href="https://www.geospatial.jp/ckan/dataset/houmusyouchizu-riyoukiyaku">
            法務省 登記所備付地図データ
          </a>
          。本リポジトリで abr-geocoder により加工。
        </p>
        <p>
          自治体照合：
          <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">
            国土交通省 N03 2026年版
          </a>
          （CC BY 4.0）を本リポジトリで加工。位置の正しさを保証しません。
        </p>
        <p>
          背景地図は通信が必要です。オフライン保存の対象はカードの一覧・詳細です。
        </p>
        <p className="legend">
          <span>● 蓋</span>
          <span>■ 配布場所</span>
          <span className="active">● 配布中</span>
          <span className="upcoming">● 開始前</span>
          <span className="suspended">● 一時中止</span>
          <span className="ended">● 終了</span>
          <span className="unknown">● 要確認</span>
        </p>
      </div>
    </details>
  );
}

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [query, setQuery] = useState("");
  const [showLids, setShowLids] = useState(false);
  const [revealedLid, setRevealedLid] = useState<string>();
  const [selection, setSelection] = useState<{
    ids: string[];
    selectedId?: string;
    started: number;
  } | null>(null);
  const [choice, setChoice] = useState("");
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [offline, setOffline] = useState<OfflineState>({
    text: "オフラインの準備は未完了",
  });
  const [dataError, setDataError] = useState(false);
  const detailRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const mapClickStart = useRef<number | null>(null);
  const initialView = useMemo(() => {
    if (params.has("benchmark")) return null;
    try {
      return parseStoredView(localStorage.getItem("map-view"));
    } catch {
      return null;
    }
  }, []);
  const cards = useMemo(
    () => new Map(data?.cards.map((card) => [card.id, card]) || []),
    [data],
  );
  const group = useMemo(
    () => cardsForIds(cards, selection?.ids || []),
    [cards, selection],
  );
  const selected = detailCard(group, selection?.selectedId);
  const pins = useMemo(
    () => visiblePins(data, showLids, revealedLid),
    [data, showLids, revealedLid],
  );
  const placeCount = useMemo(() => visiblePins(data, false).length, [data]);
  const selectedPins = useMemo(
    () =>
      selectionPins(
        pins.filter((pin) =>
          revealedLid ? pin.kind === "lid" : pin.kind === "place",
        ),
        selected ? [selected.id] : selection?.ids || [],
      ),
    [pins, selected, selection, revealedLid],
  );
  const filtered = useMemo(
    () => matchingCards(data?.cards || [], query, data || undefined),
    [data, query],
  );

  useEffect(() => {
    let cancelled = false;
    loadData()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        performance.mark("data-ready");
        performance.measure("data-load", "data-requested", "data-ready");
        performance.mark("map-create");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        metrics.errors.push(String(error));
        setDataError(true);
        setMessage(
          "カード情報を読み込めませんでした。通信を確認して再読み込みしてください。",
        );
      });
    return () => {
      cancelled = true;
      activeAdapter = undefined;
    };
  }, []);

  const mapError = useCallback((error: string) => {
    metrics.errors.push(error);
    setMapState("failed");
  }, []);
  const mapWarning = useCallback(() => {
    setMessage(
      "背景の一部を読み込めませんでした。地図の移動とカードの選択は引き続き使えます。",
    );
  }, []);
  const mapReady = useCallback((adapter: Adapter) => {
    activeAdapter = adapter;
    adapter.onMove(() => {
      try {
        localStorage.setItem("map-view", JSON.stringify(adapter.view()));
      } catch {
        /* Lists and map remain usable without storage. */
      }
    });
    setMapState("ready");
    void painted().then(() => {
      metrics.ready = performance.now();
      performance.mark("map-ready");
      performance.measure("map-render", "map-create", "map-ready");
      performance.measure("startup", { start: 0, end: "map-ready" });
    });
  }, []);

  useEffect(() => startOfflineUpdates(setOffline), []);

  const show = useCallback(
    (ids: string[], selectedId?: string, started = performance.now()) => {
      if (!detailRef.current && document.activeElement instanceof HTMLElement)
        returnFocus.current = document.activeElement;
      setRevealedLid(undefined);
      setSelection({ ids, selectedId, started });
      setChoice(ids[0] || "");
    },
    [],
  );
  const selectFromMap = useCallback(
    (ids: string[]) => {
      const started = mapClickStart.current ?? performance.now();
      mapClickStart.current = null;
      show(ids, undefined, started);
    },
    [show],
  );
  const close = useCallback(() => {
    setRevealedLid(undefined);
    setSelection(null);
    returnFocus.current?.focus();
  }, []);
  useEffect(() => {
    if (!selection) return;
    detailRef.current?.querySelector<HTMLElement>("h2")?.focus();
    let cancelled = false;
    void painted().then(() => {
      if (cancelled) return;
      metrics.taps.push(performance.now() - selection.started);
      performance.mark("pin-tap", { startTime: selection.started });
      performance.mark("detail-painted");
      performance.measure("pin-to-detail", "pin-tap", "detail-painted");
    });
    return () => {
      cancelled = true;
    };
  }, [selection]);

  function showLid() {
    if (!selected) return;
    setRevealedLid(selected.id);
    activeAdapter?.select(
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
      activeAdapter?.select(
        selectionPins(visiblePins(data, false), [selected.id]),
      );
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setMessage(
        "この端末では現在地を取得できません。一覧から探してください。",
      );
      return;
    }
    setMessage("現在地を確認しています…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        activeAdapter?.locate(
          position.coords.latitude,
          position.coords.longitude,
        );
        setMessage("");
      },
      () =>
        setMessage("現在地を取得できなかったため、表示中の範囲を使います。"),
      { timeout: 8000 },
    );
  }
  const notice =
    message ||
    (mapState === "failed"
      ? "背景地図を読み込めませんでした。一覧・検索からカードを閲覧できます。"
      : !data
        ? "カード情報を読み込み中…"
        : mapState === "loading"
          ? "地図を準備しています。一覧からカードを探せます。"
          : `${data.cards.length.toLocaleString("ja-JP")}枚のカード。訪問前に配布状況をご確認ください。`);
  const fixture = data && "fixture" in data && Boolean(data.fixture);
  return (
    <main className={`explorer ${selection ? "has-detail" : ""}`}>
      <div
        id="map"
        className="map-stage"
        aria-label="カードの地図"
        onClickCapture={(event) => {
          mapClickStart.current = event.timeStamp;
        }}
      >
        {data && (
          <MapBoundary onError={mapError}>
            <Suspense
              fallback={
                <div className="map-loading" aria-hidden="true">
                  地図を準備しています
                </div>
              }
            >
              <CardMap
                pins={pins}
                selectedPins={selectedPins}
                onSelect={selectFromMap}
                onReady={mapReady}
                onError={mapError}
                onWarning={mapWarning}
                initialView={initialView}
              />
            </Suspense>
          </MapBoundary>
        )}
      </div>
      <section className="search-panel" aria-label="カードを探す">
        <header className="app-heading">
          <span className="brand-mark" aria-hidden="true">
            ◎
          </span>
          <div>
            <h1>マンホールカード</h1>
            <p>配布場所で受け取って、蓋に会いに行こう</p>
          </div>
          <span className="preview-label">試作版</span>
        </header>
        {fixture && (
          <p id="fixture-warning">
            合成テストデータです。実在のカード・配布施設ではありません。
          </p>
        )}
        <label className="search-label" htmlFor="search">
          一覧から探す
        </label>
        <input
          id="search"
          type="search"
          placeholder="自治体・配布施設・カード番号"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={!data}
          autoComplete="off"
        />
        <select
          id="cards"
          aria-label="カード一覧"
          value=""
          disabled={!data}
          onChange={(event) => {
            if (event.target.value) show([event.target.value]);
          }}
        >
          <option value="">
            {!data
              ? "カード情報を準備中"
              : query && !filtered.length
                ? "該当するカードはありません"
                : `カードを選ぶ（${filtered.length.toLocaleString("ja-JP")}枚・位置未確定も含む）`}
          </option>
          {filtered.map((card) => (
            <option key={card.id} value={card.id}>
              {card.pref} {card.city} {card.id}（{labels[card.status]}）
            </option>
          ))}
        </select>
        <label className="layer-toggle" htmlFor="show-lids">
          <input
            id="show-lids"
            type="checkbox"
            checked={showLids}
            onChange={(event) => {
              setShowLids(event.target.checked);
              setRevealedLid(undefined);
            }}
          />
          蓋の位置も表示
        </label>
        <p className="map-legend">
          ■ 配布場所　
          {showLids || revealedLid
            ? "● 蓋の位置"
            : "蓋はカード詳細から表示できます"}
        </p>
        {data && (
          <p id="coverage-note">
            {placeCount
              ? `位置を確認した配布場所 ${placeCount.toLocaleString("ja-JP")}か所を表示。未確認の配布場所も一覧から探せます。`
              : "配布場所の位置を確認中です。カード一覧から施設名・住所を確認できます。"}
          </p>
        )}
        <p id="notice" role="status">
          {notice}
        </p>
        {dataError && (
          <button type="button" onClick={() => location.reload()}>
            再読み込み
          </button>
        )}
        <div id="offline" role="status" aria-live="polite">
          {offline.text}
          {offline.action && (
            <button type="button" onClick={offline.action}>
              {offline.actionLabel}
            </button>
          )}
        </div>
        <details className="about-panel">
          <summary>この地図について</summary>
          <SourceNotes />
        </details>
      </section>
      <nav className="map-actions" aria-label="地図の移動">
        <button
          id="locate"
          type="button"
          disabled={mapState !== "ready"}
          onClick={locate}
        >
          <span aria-hidden="true">⌖</span> 現在地
        </button>
        <button
          id="japan"
          type="button"
          disabled={mapState !== "ready"}
          onClick={() => {
            activeAdapter?.japan();
            setMessage("");
          }}
        >
          日本全体
        </button>
      </nav>
      {selection && (
        <section
          id="detail"
          className="detail-panel"
          aria-label="カードの詳細"
          ref={detailRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="sheet-handle" aria-hidden="true" />
          <div className="detail-actions">
            <button type="button" onClick={close}>
              閉じる
            </button>
            {selected && group.length > 1 && (
              <button type="button" onClick={() => show(selection.ids)}>
                一覧に戻る（{group.length}枚）
              </button>
            )}
          </div>
          {selected && data ? (
            <CardDetail
              card={selected}
              data={data}
              onShowLid={showLid}
              onShowPlaces={showPlaces}
              mapReady={mapState === "ready"}
            />
          ) : group.length ? (
            <>
              <p className="eyebrow">この場所で探すカード</p>
              <h2 tabIndex={-1}>この位置・範囲のカード {group.length}枚</h2>
              <p>カードを選んで詳細を開く。矢印キーで選択できます。</p>
              <select
                size={Math.min(6, Math.max(2, group.length))}
                aria-label="この位置・範囲のカード一覧"
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    show(selection.ids, choice);
                  }
                }}
              >
                {group.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.pref} {card.city} {card.id}（{labels[card.status]}）
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                type="button"
                onClick={() => show(selection.ids, choice)}
              >
                選んだカードの詳細を開く
              </button>
            </>
          ) : (
            <h2 tabIndex={-1}>該当するカードはありません</h2>
          )}
        </section>
      )}
    </main>
  );
}
