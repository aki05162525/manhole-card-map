import { SourceNotes } from "./source-notes";
import type { OfflineState } from "./offline-update";
import { labels, type Card } from "./types";

type Props = {
  loaded: boolean;
  fixture: boolean;
  query: string;
  filtered: Card[];
  showLids: boolean;
  revealedLid?: string;
  placeCount: number;
  notice: string;
  dataError: boolean;
  offline: OfflineState;
  onQuery(value: string): void;
  onSelect(id: string): void;
  onShowLids(value: boolean): void;
};
export function SearchPanel({
  loaded,
  fixture,
  query,
  filtered,
  showLids,
  revealedLid,
  placeCount,
  notice,
  dataError,
  offline,
  onQuery,
  onSelect,
  onShowLids,
}: Props) {
  return (
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
  );
}
