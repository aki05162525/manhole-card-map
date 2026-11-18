# カード探索UIの判断基準

Vite + React + mapcn / MapLibreで、配布施設を探し、受取後に蓋へ向かう。起動・ビルド・検証は [web/README](../web/README.md)、公開と外部地図の設定は [配信手順](deployment.md) を参照。

## 地図と検索

- 主なピンは配布施設。蓋は別の目的地として詳細から選ぶ。通常ピンと地域の件数はMapLibreのsource/layerで描き、距離によるクラスタは使わない。
- 全国→地方→県→施設へ進む。件数は位置確定済みの施設に載るカードIDの重複を除いて数える。配布状態・在庫の保証ではなく、蓋は数えない。施設の県と一覧のカードの県が異なることがある。
- カメラの固定範囲は本土側を対象とし、離島のピンは消さない。[生成方法](../tools/map/README.md)を参照。
- 地図の初期化・背景取得に失敗しても検索・一覧・詳細を使えるようにする。位置未確定の施設を確定座標として経路案内へ渡さない。
- 地図検索は全国を対象とし、地図のピンを絞らない。位置のないカードも探せる。独立した一覧 `/cards` は地図コードなしで起動できる。

階層・件数・カメラの範囲は `web/src/features/map/map-levels.ts`、パネルを避ける余白は `map-layout.ts`、全国の表示配置は `area-layout.ts`、地図と選択の接続は `web/src/pages/map/` を参照。閾値・寸法・色はコードを正本とする。

## 詳細の道順と窓口

- 「① 受け取る」「② 蓋を訪ねる」を分け、選択した窓口・段と地図の強調・Google Mapsの行き先を一致させる。複数窓口と位置未確定の窓口も残す。
- スマホの要約では今の行き先ともう一方への操作を届く位置に残す。終了・一時中止の注意を縮約で消さない。全体表示と一覧では窓口の情報をすべて確認できるようにする。
- 住所は位置未確定・取り下げ済み施設の検索先を確認するために表示する。電話番号は詳細・カードページへ表示しない。
- 許諾画像はクレジットと一緒に出し、切り抜き・角丸・重ね表示・加工をしない。読込失敗時は画像と枠を消す。許諾・追加は [データ保守](data-maintenance.md#カード画像の追加) に従う。

窓口の整理と初期選択は `web/src/domain/card-counters.ts`、描画は `web/src/features/card-detail/`、段・窓口の選択は `web/src/pages/map/use-detail-selection.ts`、シートは同ディレクトリの `use-detail-sheet.ts`・`use-explorer-layout.ts`・`style.css` を参照。

## 描画と寿命

地図は文書に最大1個とし、画面を隠している間はカメラとデータ反映を止める。私的データと遅延応答の扱いは [ハーネス](harness.md#同じ文書で切り替える画面) に従う。

配色はOS設定へ追従し、文字・操作・ピンのコントラストと常時見える出典を保つ。CSSは `web/src/shared/ui/tokens.css`、地図描画は `web/src/features/map/map-theme.ts` と `basemap-style.ts`、検査は `tools/design/theme-contrast.mjs` を参照。

背景はCARTOのスタイルを使い、`VITE_MAP_STYLE_URL` で交換する。APIキー不要という説明だけで公開用途の許諾を判断しない。MapLibre Workerは導入版と同じものを自前配信する。mapcn由来の変更範囲・ライセンスは [MAPCN_PROVENANCE](../web/MAPCN_PROVENANCE.md)、地図出典は [THIRD_PARTY_DATA](../web/THIRD_PARTY_DATA.md) に残す。
