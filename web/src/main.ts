import "./style.css";
import { type Adapter, type Data, type View, labels, painted } from "./types";
const params = new URLSearchParams(location.search),
  engine = params.get("engine") === "b" ? "b" : "a";
const notice = document.querySelector<HTMLElement>("#notice")!,
  detail = document.querySelector<HTMLElement>("#detail")!,
  select = document.querySelector<HTMLSelectElement>("#cards")!;
let adapter: Adapter, data: Data;
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
async function show(ids: string[]) {
  const start = inputEvent?.eventPhase
    ? inputEvent.timeStamp
    : performance.now();
  inputEvent = null;
  performance.mark("pin-tap", { startTime: start });
  detail.replaceChildren();
  detail.hidden = false;
  const close = text("button", "閉じる");
  close.onclick = () => {
    detail.hidden = true;
    adapter.select([]);
  };
  detail.append(close);
  for (const id of ids) {
    const c = data.cards.find((c) => c.id === id);
    if (!c) continue;
    detail.append(
      text("h2", c.city),
      text("p", `${c.id} / ${c.series} / ${c.issued}`),
      text("p", `${labels[c.status]}。在庫は未確認。`),
    );
    const relations = data.relations.filter((r) => r.cardId === id);
    for (const r of relations) {
      const p = data.places.find((p) => p.id === r.placeId)!;
      detail.append(
        text(
          "p",
          `${p.name}\n${p.address} ${p.phone}\n${r.condition}\n${p.coordinate.status === "candidate" ? "試作の参考位置（未確定）" : p.coordinate.status === "confirmed" ? "位置確定" : "地図の位置は未確定"}`,
        ),
      );
    }
    detail.append(
      text("p", c.placeText.join("\n")),
      text("p", (c.hours || []).join("\n")),
      text("p", `情報取得日：${c.acquired}`),
    );
    if (c.lid.status !== "confirmed")
      detail.append(text("p", `蓋の位置は未確定：${c.lid.reason}`));
    if (c.override)
      detail.append(
        text(
          "p",
          `確認日：${c.override.checkedAt} / 確認者：${c.override.reviewer}\n${c.override.evidence}`,
        ),
      );
    for (const href of c.links || []) {
      if (!/^https?:\/\//.test(href)) continue;
      const a = text("a", "公式の確認先") as HTMLAnchorElement;
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      detail.append(a, text("span", "　"));
    }
  }
  adapter.select(
    data.pins.filter((p) => p.cardIds.some((id) => ids.includes(id))),
  );
  await painted();
  const end = performance.now();
  metrics.taps.push(end - start);
  performance.mark("detail-painted");
  performance.measure("pin-to-detail", "pin-tap", "detail-painted");
}
function list(query = "") {
  const options = data.cards
    .filter((c) => `${c.city} ${c.id}`.includes(query))
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
  };
  const modulePromise = adapters[engine]();
  if (metrics.mode === "full") data = await json("/data/full.json");
  else {
    const [pins, details] = await Promise.all([
      json("/data/pins.json"),
      json("/data/details.json"),
    ]);
    if (pins.updated !== details.updated) throw Error("データの版が一致しない");
    data = { ...details, pins: pins.pins };
  }
  const module = await modulePromise;
  adapter = module.create(
    data.pins,
    (ids) => void show(ids),
    params.has("benchmark") ? null : stored(),
  );
  list();
  select.onchange = () => {
    if (select.value) void show([select.value]);
  };
  document.querySelector<HTMLInputElement>("#search")!.oninput = (e) =>
    list((e.target as HTMLInputElement).value);
  document.querySelector<HTMLButtonElement>("#japan")!.onclick = () =>
    adapter.japan();
  document.querySelector<HTMLButtonElement>("#locate")!.onclick = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => adapter.locate(p.coords.latitude, p.coords.longitude),
      () => {
        notice.textContent =
          "現在地を取得できなかったため、表示中の範囲を使う。";
      },
      { timeout: 8000 },
    );
  };
  adapter.onMove(() => {
    try {
      localStorage.setItem("map-view", JSON.stringify(adapter.view()));
    } catch {
      /* 保存できなくても地図は使える。 */
    }
  });
  await adapter.ready;
  await painted();
  metrics.ready = performance.now();
  performance.mark("map-ready");
  performance.measure("startup", { start: 0, end: "map-ready" });
  notice.textContent = `${engine.toUpperCase()} / ${data.cards.length}枚 / ${data.pins.length}ピン。${data.pins.some((p) => p.kind === "place") ? "配布場所は試作の参考位置。" : "配布場所は位置未確定のため文字情報のみ。"}`;
  void offline();
}
start().catch((e) => {
  metrics.errors.push(String(e));
  notice.textContent = `起動未完了：${e}`;
  void offline();
});
