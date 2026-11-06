# mapcn によるカード探索 UI

## 決定と対象

Vite + React + mapcn / MapLibre を標準画面にする。目的は、地図を動かしてカードを探し、詳細から Google マップへ渡すまでの操作を滑らかにすること。自前のカードデータ生成は維持し、背景地図の自作を必須条件から外す。認証・バックエンド・外部公開はこの変更に含まない。

全画面の地図サイズを保ち、検索と詳細を重ねる。

## 採用理由

- **MapLibre** はベクトル地図とカードのレイヤー描画を担当する。表示する範囲に応じて背景タイルを取得し、各ピンに HTML 要素を作らない。移動中の座標を毎フレーム React state に流さず、カメラ操作は MapLibre に任せる。
- **mapcn** は React の地図コンポーネントと操作 UI を提供する。公式 CLI が生成したソースをリポジトリに保存し、必要なら MapLibre の API を直接使える。単独で通信量や FPS を改善する技術とは扱わない。
- **React** は検索、選択、カード詳細の状態を管理する。今回、mapcn を具体的に利用するため採用する。Next.js のサーバー機能は不要なので Vite を継続する。
- **Tailwind / shadcn 設定** は mapcn の前提として導入する。完成済みページのブロックを丸ごと入れず、地図コンポーネントと必要な UI だけを使う。
- **APM** は公式スキルの版と内容をそろえる開発用の依存管理。Bun の実行時依存とは別で、ブラウザーには配信しない。[導入・更新方法](development-agents.md)を参照。

Effect、認証、バックエンド、公開基盤の候補は引き続き保留する。Bun / mise / Vitest / Oxlint / Oxfmt / lefthook と Go のデータ処理は継続する。

## データと操作

既存の `Data` / `Pin` / カード・施設の関連を使い、座標は GeoJSON の `[経度, 緯度]` に変換する。蓋と配布場所、配布状態、参考位置の区別を保持する。カード数とピン数は同じではなく、クラスタの数値はピン数を示す。

カードの通常ピン・クラスタ・選択状態は MapLibre の source/layer で描く。mapcn の標準クラスタ API だけでは同一座標に複数カードがある場合の全件選択を扱いきれないため、`useMap()` を介してクラスタ API を使う。拡大可能ならクラスタを拡大し、上限では葉を分割取得してカード ID を重複排除し、全件の一覧を開く。施設・蓋をまたぐ同一カードの重複は一覧に出さない。

検索・一覧は地図の初期化より先に使える。地図モジュール・背景・WebGL が失敗してもカードの詳細とリンクは使用できる。地図準備前の選択は地図が使える時点で反映する。位置未確定の施設を確定座標として経路案内に渡さず、名称・住所の検索を使う。前回の範囲は localStorage に保存し、不正な値・保存不可は許容する。動きを減らす設定ではカメラアニメーションを省く。

## 配信と外部依存

通常画面は mapcn の明るい CARTO 背景を利用し、`VITE_MAP_STYLE_URL` で互換スタイルへ交換できる。出典は MapLibre の attribution を表示する。mapcn の「API キー不要」という説明は、すべての公開用途が無条件に利用可能という意味ではない。CARTO の現行案内にはキー・用途別上限があるため、公開前に利用条件と配信先を確定する。今回の承認範囲はローカル検証と CI 成果物保存まで。

公式コンポーネント既定の unpkg Worker URL は、公式ドキュメントに従って自前配信へ変更する。インストールした MapLibre と同じ版の Worker / shared モジュールを build と dev の両方で配信する。mapcn ソースの変更はこの設定と整形に限定する。公式由来の冗長なオブジェクト展開に対する Oxlint の一規則だけ、生成ファイルに限定して無効化する。他のコードには適用しない。

Service Worker はアプリ・カードデータ・Worker を保存する。背景、タイル、背景用フォントはオフライン保証に含めない。初回利用が通信なしの場合は利用できず、保存完了後の一覧・詳細が保証対象。旧比較ページへの新しいナビゲーションは現行画面へ移す。更新前から開いているタブには旧世代の資産を維持する。

CI の fixture は架空カードとネットワーク不要の地図スタイルを使用する。実地図の速度をこの背景で評価しない。実データがない通常ビルドは失敗し、fixture に自動で置き換えない。

## 検証と採用判断

TDD は座標・属性の維持、クラスタ全件取得、検索・選択・保存範囲の検証、Worker と fixture の配備を対象にする。ブラウザー統合検査では実際の地図クリック、共有カードの選択、リンク、キーボード、地図サイズ維持、位置情報、読み込み前選択、失敗時・オフライン閲覧を確認する。

初回表示、カード詳細の応答、移動中のフレーム間隔は別々に評価する。過去の自己配信 PMTiles 版 B の結果だけで MapLibre 全般の性能を判断しない。fixture の合格やソフトウェア描画の PC 測定でスマホ実機の滑らかさを保証しない。検証結果と未実施の項目はPR・CIへ記録する。

## 参照

- [mapcn の設計](https://www.mapcn.dev/docs)
- [mapcn 導入と Worker の自前配信](https://www.mapcn.dev/docs/installation)
- [公式スキル](https://www.mapcn.dev/docs/skill)
- [MapLibre クラスタ API](https://maplibre.org/maplibre-gl-js/docs/API/classes/GeoJSONSource/)
- [CARTO Basemaps](https://carto.com/basemaps/)
- [参考とした Osampo](https://osampo.vercel.app/)

## UIの責務分離

Learning Patternsの[Module](https://www.patterns.dev/vanilla/module-pattern/)、[Hooks](https://www.patterns.dev/react/hooks-pattern/)、[Container/Presentational](https://www.patterns.dev/react/presentational-container-pattern/)を採用する。`card-data.ts` はfull/split取得と世代照合を持ち、`useCardData`・`useOfflineState`・`useMapController` は非同期取得、購読解除、地図adapterと保存範囲の寿命をそれぞれ管理する。`App` は選択と受取先／蓋への移動を調整し、`SearchPanel` と `CardDetail` はpropsから表示する。`MapStage` は地図コードの遅延読込とエラー境界を担当する。地図失敗を一覧の取得・表示へ伝播させず、詳細の描画検査をブラウザーのグローバル状態から独立させるための分割である。深いpropの受け渡しはないためProviderは追加しない。
