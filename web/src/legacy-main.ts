import "./legacy-style.css";
import {
  cardsForIds,
  detailCard,
  facilityMapLink,
  lidMapLink,
  safeHttpUrl,
  type MapLink,
} from "./ui";
import {
  type Adapter,
  type Card,
  type Data,
  type Pin,
  type View,
  labels,
  painted,
} from "./types";
const params = new URLSearchParams(location.search),
  requestedEngine = params.get("engine"),
  engine =
    requestedEngine === "a" ||
    requestedEngine === "b" ||
    requestedEngine === "d"
      ? requestedEngine
      : "c";
if (engine === "c") {
  const background = document.createElement("link");
  background.rel = "preload";
  background.as = "fetch";
  background.href = "/background/japan.geojson";
  background.crossOrigin = "anonymous";
  document.head.append(background);
}
const notice = document.querySelector<HTMLElement>("#notice")!,
  detail = document.querySelector<HTMLElement>("#detail")!,
  select = document.querySelector<HTMLSelectElement>("#cards")!;
let adapter: Adapter | undefined, data: Data;
let selectedPins: Pin[] | undefined;
let cards = new Map<string, Card>();
let returnFocus: HTMLElement | null = null;
let inputEvent: Event | null = null;
document.querySelector("#map")!.addEventListener(
  "click",
  (event) => {
    inputEvent = event;
  },
  { capture: true },
);
const metrics = {
  engine,
  mode: params.get("data") === "split" ? "split" : "full",
  ready: 0,
  taps: [] as number[],
  errors: [] as string[],
};
Object.assign(window, {
  prototype: {
    metrics,
    get adapter() {
      return adapter;
    },
    painted,
  },
});
function stored(): View | null {
  try {
    const v = JSON.parse(localStorage.getItem("map-view") || "null");
    return v &&
      [v.lat, v.lng, v.zoom].every(Number.isFinite) &&
      Math.abs(v.lat) <= 85 &&
      Math.abs(v.lng) <= 180 &&
      v.zoom >= 0 &&
      v.zoom <= 18
      ? v
      : null;
  } catch {
    return null;
  }
}
async function json(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}
function text(tag: string, value: string) {
  const e = document.createElement(tag);
  e.textContent = value;
  return e;
}
function appendLink(link: MapLink | null) {
  if (!link) return;
  const a = text("a", link.label) as HTMLAnchorElement;
  a.href = link.href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  detail.append(a);
}
function renderCard(c: Card) {
  detail.append(
    text("h2", `${c.pref} ${c.city}`),
    text("p", `${c.id} / ${c.series} / ${c.issued}`),
    text("p", `${labels[c.status]}。在庫は未確認。`),
  );
  const relations = data.relations.filter((r) => r.cardId === c.id);
  if (relations.length > 1)
    detail.append(text("p", "配布施設は曜日・条件を確認して選んでください。"));
  for (const r of relations) {
    const p = data.places.find((p) => p.id === r.placeId);
    if (!p) continue;
    detail.append(
      text("h3", p.name),
      text(
        "p",
        `${p.address} ${p.phone}\n${r.condition}\n${r.periodRaw || ""}\n${r.alternativeRaw || ""}\n${p.coordinate.status === "candidate" ? "参考位置（未確定）" : p.coordinate.status === "confirmed" ? "位置確定" : "地図の位置は未確定"}`,
      ),
    );
    appendLink(facilityMapLink(p, r));
  }
  if (!relations.length)
    detail.append(
      text(
        "p",
        "配布施設の登録なし。下記の文字情報・公式情報を確認してください。",
      ),
    );
  detail.append(
    text("p", c.placeText.join("\n")),
    text("p", (c.hours || []).join("\n")),
    text("p", `情報取得日：${c.acquired}`),
  );
  const lidLink = lidMapLink(c.lid);
  if (lidLink) appendLink(lidLink);
  else
    detail.append(
      text("p", `蓋の位置は未確定または有効な座標なし：${c.lid.reason || ""}`),
    );
  if (c.override)
    detail.append(
      text(
        "p",
        `確認日：${c.override.checkedAt} / 確認者：${c.override.reviewer}\n${c.override.evidence}`,
      ),
    );
  for (const value of c.links || []) {
    const href = safeHttpUrl(value);
    if (href) appendLink({ href, label: "公式の確認先" });
  }
}
function closeDetail() {
  detail.hidden = true;
  selectedPins = [];
  adapter?.select([]);
  returnFocus?.focus();
}
detail.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetail();
});
async function show(ids: string[], selectedId?: string) {
  const start = inputEvent?.eventPhase
    ? inputEvent.timeStamp
    : performance.now();
  inputEvent = null;
  performance.mark("pin-tap", { startTime: start });
  if (detail.hidden && document.activeElement instanceof HTMLElement)
    returnFocus = document.activeElement;
  const group = cardsForIds(cards, ids);
  detail.replaceChildren();
  detail.hidden = false;
  const actions = text("div", "");
  actions.className = "detail-actions";
  const close = text("button", "閉じる");
  close.onclick = closeDetail;
  actions.append(close);
  detail.append(actions);
  const selected = detailCard(group, selectedId);
  if (selected) {
    if (group.length > 1) {
      const back = text("button", `一覧に戻る（${group.length}枚）`);
      back.onclick = () => void show(ids);
      actions.append(back);
    }
    renderCard(selected);
  } else if (group.length) {
    detail.append(
      text("h2", `この位置・範囲のカード ${group.length}枚`),
      text("p", "カードを選んで詳細を開く。矢印キーで選択できます。"),
    );
    const choices = document.createElement("select");
    choices.size = 8;
    choices.setAttribute("aria-label", "この位置・範囲のカード一覧");
    choices.append(
      ...group.map(
        (c) =>
          new Option(
            `${c.pref} ${c.city} ${c.id}（${labels[c.status]}）`,
            c.id,
          ),
      ),
    );
    choices.value = group[0]!.id;
    const open = text("button", "選んだカードの詳細を開く");
    open.onclick = () => void show(ids, choices.value);
    choices.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void show(ids, choices.value);
      }
    };
    detail.append(choices, open);
  } else detail.append(text("p", "該当するカードはありません。"));
  selectedPins = data.pins.filter((p) =>
    p.cardIds.some((id) => (selected ? id === selected.id : ids.includes(id))),
  );
  adapter?.select(selectedPins);
  const heading = detail.querySelector("h2");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
  await painted();
  metrics.taps.push(performance.now() - start);
  performance.mark("detail-painted");
  performance.measure("pin-to-detail", "pin-tap", "detail-painted");
}
function list(query = "") {
  const options = data.cards
    .filter((c) => `${c.pref} ${c.city} ${c.id}`.includes(query.trim()))
    .map((c) => new Option(`${c.city} ${c.id}（${labels[c.status]}）`, c.id));
  select.replaceChildren(
    new Option("カードを選ぶ（位置未確定も含む）", ""),
    ...options,
  );
}
async function offline() {
  const el = document.querySelector("#offline")!;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) throw Error("Service Worker が有効でない");
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => {
      el.textContent = e.data.ready
        ? `オフライン準備完了 / 保存データ：${data?.updated ?? "不明"}`
        : "オフラインの準備は未完了";
    };
    worker.postMessage({ type: "status" }, [channel.port2]);
  } catch {
    el.textContent = "オフライン保存に失敗。通信が必要";
  }
}
async function start() {
  const adapters = {
    a: () => import("./leaflet"),
    b: () => import("./maplibre"),
    c: () => import("./simplified"),
    d: () => import("./blank"),
  };
  // Fetch code alongside data, while handling a failed import immediately.
  // Lists remain usable even when the map module or its background fails.
  const modulePromise = adapters[engine]().then(
    (module) => ({ module }),
    (error: unknown) => ({ error }),
  );
  performance.mark("data-requested");
  if (metrics.mode === "full") data = await json("/data/full.json");
  else {
    const [pins, details] = await Promise.all([
      json("/data/pins.json"),
      json("/data/details.json"),
    ]);
    if (pins.updated !== details.updated) throw Error("データの版が一致しない");
    data = { ...details, pins: pins.pins };
  }
  performance.mark("data-ready");
  performance.measure("data-load", "data-requested", "data-ready");
  if ("fixture" in data && data.fixture) {
    const warning = document.createElement("p");
    warning.id = "fixture-warning";
    warning.textContent =
      "合成テストデータです。実在のカード・配布施設ではありません。";
    document.querySelector("header")!.after(warning);
  }
  cards = new Map(data.cards.map((c) => [c.id, c]));
  list();
  select.onchange = () => {
    if (select.value) void show([select.value]);
  };
  document.querySelector<HTMLInputElement>("#search")!.oninput = (e) =>
    list((e.target as HTMLInputElement).value);
  document.querySelector<HTMLButtonElement>("#japan")!.onclick = () =>
    adapter?.japan();
  document.querySelector<HTMLButtonElement>("#locate")!.onclick = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => adapter?.locate(p.coords.latitude, p.coords.longitude),
      () => {
        notice.textContent =
          "現在地を取得できなかったため、表示中の範囲を使う。";
      },
      { timeout: 8000 },
    );
  };
  const description = `${engine.toUpperCase()} / ${data.cards.length}枚 / ${data.pins.length}ピン。${engine === "c" ? "簡略図（道路なし）。" : engine === "d" ? "診断用：背景なし。" : ""}${data.pins.some((p) => p.kind === "place" && p.reference) ? "未確定の配布場所ピンは参考位置。" : ""}`;
  notice.textContent = description;
  try {
    const loaded = await modulePromise;
    if ("error" in loaded) throw loaded.error;
    performance.mark("map-create");
    const activeAdapter: Adapter = loaded.module.create(
      data.pins,
      (ids: string[]) => void show(ids),
      params.has("benchmark") ? null : stored(),
    );
    adapter = activeAdapter;
    activeAdapter.onMove(() => {
      try {
        localStorage.setItem("map-view", JSON.stringify(activeAdapter.view()));
      } catch {
        /* 保存できなくても地図は使える。 */
      }
    });
    await activeAdapter.ready;
    document.querySelector<HTMLButtonElement>("#locate")!.disabled = false;
    if (selectedPins !== undefined) activeAdapter.select(selectedPins);
    await painted();
    metrics.ready = performance.now();
    performance.mark("map-ready");
    performance.measure("map-render", "map-create", "map-ready");
    performance.measure("startup", { start: 0, end: "map-ready" });
    notice.textContent = description;
  } catch (e) {
    metrics.errors.push(String(e));
    notice.textContent = `${description} 地図を読み込めませんでした。一覧・検索からカードを閲覧できます。`;
  } finally {
    // Keep SW downloads out of startup measurements; save lists on map failure too.
    void offline();
  }
}
start().catch((e) => {
  metrics.errors.push(String(e));
  notice.textContent = `起動未完了：${e}`;
  void offline();
});
