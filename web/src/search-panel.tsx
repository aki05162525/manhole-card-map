import { areas } from "./prefectures";
import { countPins, focusForPrefTap, type MapFocus } from "./map-levels";
import { prefectureCards, visiblePins } from "./explorer-state";
import type { Data } from "./types";
import { SourceNotes } from "./source-notes";
import { labels, type Card } from "./types";

type Props = {
  data: Data | null;
  focus: MapFocus;
  onFocus(focus: MapFocus): void;
  loaded: boolean;
  fixture: boolean;
  query: string;
  filtered: Card[];
  showLids: boolean;
  revealedLid?: string;
  placeCount: number;
  notice: string;
  alert: string;
  open: boolean;
  canClose: boolean;
  onToggle(): void;
  onPickPrefecture(): void;
  dataError: boolean;
  onQuery(value: string): void;
  onSelect(id: string): void;
  onShowLids(value: boolean): void;
};
export function SearchPanel({
  data,
  focus,
  onFocus,
  loaded,
  fixture,
  query,
  filtered,
  showLids,
  revealedLid,
  placeCount,
  notice,
  alert,
  open,
  canClose,
  onToggle,
  onPickPrefecture,
  dataError,
  onQuery,
  onSelect,
  onShowLids,
}: Props) {
  const counts = countPins(visiblePins(data, false));
  const panel = prefectureCards(data, focus.pref ?? "");
  return (
    <section
      className={`search-panel ${open ? "" : "is-closed"}`}
      aria-label="カードを探す"
    >
      <header className="app-heading">
        <span className="brand-mark" aria-hidden="true">
          ◎
        </span>
        <div>
          <h1>マンホール手帳</h1>
          <p>配布場所で受け取って、蓋に会いに行こう</p>
        </div>
        <span className="preview-label">試作版</span>
        {canClose && (
          <button
            type="button"
            className="panel-toggle"
            aria-expanded={open}
            aria-controls="panel-body"
            aria-label={open ? "一覧を隠す" : "一覧を開く"}
            onClick={onToggle}
          >
            <span aria-hidden="true">{open ? "✕ 隠す" : "☰ 一覧"}</span>
          </button>
        )}
      </header>
      {fixture && (
        <p id="fixture-warning">
          合成テストデータです。実在のカード・配布施設ではありません。
        </p>
      )}
      <div id="panel-body" hidden={!open}>
        <label className="search-label" htmlFor="search">
          一覧から探す
        </label>
        <input
          id="search"
          type="search"
          placeholder="自治体・配布施設・カード番号"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          disabled={!loaded}
          autoComplete="off"
        />
        <select
          id="cards"
          aria-label="カード一覧"
          value=""
          disabled={!loaded}
          onChange={(event) => {
            if (event.target.value) onSelect(event.target.value);
          }}
        >
          <option value="">
            {!loaded
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
        {focus.pref && (
          <section className="pref-panel" aria-label="県のカード">
            <h2>{focus.pref}</h2>
            <p>
              収録{panel.total}枚・地図に出せる{panel.visible}枚・位置未確定
              {panel.unknown}枚（{data?.evaluatedAt ?? data?.updated}時点）
            </p>
            {panel.cards.map((card) => (
              <button
                type="button"
                key={card.id}
                onClick={() => onSelect(card.id)}
              >
                {card.city} {card.id}
              </button>
            ))}
          </section>
        )}
        <details className="pref-picker">
          <summary>都道府県から探す</summary>
          {areas.map((area) => (
            <details key={area.id}>
              <summary>{area.name}</summary>
              {area.prefs.map((pref) => (
                <button
                  type="button"
                  key={pref}
                  onClick={() => {
                    onFocus(focusForPrefTap(pref));
                    onPickPrefecture();
                  }}
                >
                  {pref}（{counts.prefs[pref]}か所）
                </button>
              ))}
            </details>
          ))}
        </details>
        <label className="layer-toggle" htmlFor="show-lids">
          <input
            id="show-lids"
            type="checkbox"
            checked={showLids}
            onChange={(event) => {
              onShowLids(event.target.checked);
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
        {loaded && (
          <p id="coverage-note">
            {placeCount
              ? `位置を確認した配布場所 ${placeCount.toLocaleString("ja-JP")}か所を表示。未確認の配布場所も一覧から探せます。`
              : "配布場所の位置を確認中です。カード一覧から施設名・住所を確認できます。"}
          </p>
        )}
        <details className="about-panel">
          <summary>この地図について</summary>
          <p>
            <a href="/about.html">マンホール手帳について・クレジット</a>
          </p>
          <SourceNotes />
        </details>
      </div>
      <p id="notice" role="status">
        {open ? notice : alert}
      </p>
      {dataError && (
        <button type="button" onClick={() => location.reload()}>
          再読み込み
        </button>
      )}
    </section>
  );
}
