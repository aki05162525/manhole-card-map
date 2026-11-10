# マンホールカードの地図

標準画面は Vite + React + mapcn / MapLibre。配布場所を主に表示し、カードを受け取ってから対応する蓋へ向かう。詳細から Google マップへ渡す。静的配信は [デプロイ手順](../docs/deployment.md) に従う。

[配布場所の設計・整備手順](../docs/distribution-design.md)・[採用理由と設計](../docs/mapcn-design.md)・[APM と公式スキル](../docs/development-agents.md)を参照。

## 開発環境

```sh
mise trust
mise install
cd web
bun install --frozen-lockfile
bun run hooks:install
bun run lint
bun run lint:css
bun run knip
bun run format:check
bun run typecheck
bun run test
```

mise をシェルで有効化していない場合は `mise exec --` を付ける。Bun は依存管理とスクリプト起動、Node.js は Vite / Vitest / 検証スクリプトに使う。依存は `bun.lock`、ツールはルートの `mise.toml` に固定する。APM は別途 [開発スキルの手順](../docs/development-agents.md)で導入する。

コミット前の検査対象と部分ステージ時の扱いは [check_staged.py](../tools/dev/check_staged.py) を参照。部分ステージでも検査は作業ツリーに対して行う。整形は `bun run format`。`hooks:install` は共通hooksディレクトリのうち、設定にないLefthook生成フックだけを削除してインストールする。

## 静的検査の設定

Oxlint は既定の typescript・unicorn・oxc に react・jsx-a11y・import を加え、correctness と Hooks の規則、循環・重複 import を検査する。次の規則は意図的に無効にしている。

| 規則                          | 理由                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| react/react-in-jsx-scope      | react-jsx の自動ランタイムを使うため。                        |
| react/set-state-in-effect     | 既存の副作用と状態同期の再設計は今回の検査基盤の範囲外。      |
| react/immutability            | 既存の地図・DOM の可変参照の扱いを保ち、別途検討するため。    |
| react/refs                    | 既存の ref を介した地図・シート制御を保ち、別途検討するため。 |
| jsx-a11y/prefer-tag-over-role | 既存のカスタム UI の要素選択は今回変更しないため。            |
| import/no-unassigned-import   | CSS・フォントの副作用 import が必要なため。                   |

#136 PR4 のファイル単位の一時例外は撤去した。URL・検索操作は実際の React と jsdom で検査し、ドラッグの購読は安定した操作関数に依存する。詳細 section の Escape 委譲と本文タップによる全画面への補助操作は、DOM・ARIA・イベントの伝播と明示ボタンを保つため `map-detail-sheet.tsx` の該当行に理由付きの例外を置く。

生成ファイル src/components/ui/map.tsx の unicorn/no-useless-fallback-in-spread の既存例外も保持する。生成元の書き方を維持するため。

Stylelint（`bun run lint:css`）は src/**/*.css とルート HTML の style を検査する。正しさの規則だけを使い、整形は Oxfmt に任せる。Tailwind 固有の at-rule は現行 CSS にある theme・apply だけを許可する。コミットフックは変更された CSS・HTML を検査し、Stylelint 設定や依存の変更では全体を検査する。

Knip（`bun run knip`）は CI で全体を検査する。地図・一覧・about・404・アカウント・規約・フレンド・招待の HTML とそこから参照するエントリ、Vite/Vitest 設定（組み込みプラグインが検出）、scripts/*.mjs、テストを入口にする。生成 mapcn の src/components/ui/map.tsx と src/lib/utils.ts は未使用 export・型の検査から除外し、ファイルや依存の検査は残す。Worker（worker/）の入口は wrangler.jsonc の `main` から Knip の wrangler プラグインが見つける。lefthook はリポジトリ直下の lefthook.yml から `web/node_modules/.bin/lefthook` として呼ばれる。CI は lefthook.yml を取得しないため Knip から使い道が見えず、同様に除外する。

Worker のテスト（worker/*.test.ts）は wrangler の `createTestHarness` で workerd を起動し、空のローカル D1 に全マイグレーションを当ててから検査する。`@cloudflare/vitest-pool-workers` は Vitest 5 で起動できなかったので使わない。

Vitest は *.dom.test.tsx だけを jsdom プロジェクトで実行する。既存の *.test.ts は node のまま。React Testing Library の DOM テストは対象ファイルの隣に置く。

## 合成データで動かす

実データなしで再現できる。架空カード5枚と通信不要の検査用スタイルを生成する。

```sh
bun run build:fixture
SERVE_DIR=dist-fixture PORT=4179 bun run preview
```

`http://127.0.0.1:4179/` を開く。背景は検査用の無地で、実際の道路地図ではない。共有施設・複数配布先・位置未確定を含む。地図・一覧の両画面で `FIXTURE_ONLY.txt` に基づく警告を表示して識別し、実在する訪問先として使わない。

```sh
bunx --no-install playwright install chromium
# アカウント検査用。実データ生成後に実行する
VITE_ACCOUNTS_ENABLED=true bun run build
bun run test:browser
```

ブラウザー検査は独立したループバックサーバーを起動・終了する。一覧のnull・終了カードなどの描画検査には `public/data/full.json` を使うため、先に次節の実データ生成も行う。検査対象は `scripts/browser-check.mjs`・`scripts/cards-page.browser-check.mjs`・`scripts/account.browser-check.mjs` を参照。アカウント検査は `dist/assets` が必要で、アカウントを有効にしたビルドでのみ実行する。

## 実データで動かす

Git管理された保存入力だけから生成する。公開用4ファイルは `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。監査は内部 full.json を読む。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。スクリプトは配布情報の変更の失効判定に使う現一覧 `data/evidence/national/list-source/gkp-20261105.html` を `-review-list` で渡し、基準日を `2026-11-06` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイルをソースに、OS の配色設定に合わせてアプリが再配色する。地図ソースは切り替えず、OS 設定の変更時もカメラ・選択・読み込んだデータを保って paint とピン画像を更新する。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。背景地図の利用条件は公開前に確認する。

`go run ./cmd/builddata -reference-places` は参考位置を使う検証用で、公開用の確定状態に変換しない。採用範囲は [全国統合手順](../docs/national-assembly.md)を参照。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

実データの操作確認はローカルサーバー起動後に `node scripts/real-data-browser-check.mjs` で実行する。

`?data=split` はピンと詳細を分割取得するが、全詳細をメモリに保持する。地図の裸の `/` は全国表示で始まり、`?benchmark` に特別な範囲復元の挙動はない。`/?card=…` は詳細を復元し、配布施設ピンがあれば対象へ移動する。`/cards.html` は地図を読み込まない独立した一覧で、県・検索・ページ・詳細をQueryに保持する。県も検索語も回収状況の絞り込みも指定されていない全国表示は地域選択だけを表示し、県を選ぶか検索・絞り込みを使うとカード一覧を表示する。戻る・進む操作でもこの状態を復元する。

配布場所ピンは従来どおり状態の色で■を描き、参考位置は点線枠で表示する。色の凡例は地図に置かず、記号の説明はaboutに置く。OpenStreetMap contributors・CARTOへの出典は地図右下に枠なしの小さな1行（10px）で常時表示し、シート表示中は実測した要約の高さに従って移動する。

全国の9地方と県の件数は丸の中だけに表示し、横のラベルは地名だけにする。全国の表示位置・左右の向きは `features/map/area-layout.ts` で管理する。412×915・1440×900の投影テストで丸と地名の重なり・見切れを、県代表点の外接範囲（単独県は本土側範囲）のテストで位置の逸脱を検査する。後者は海岸線の厳密な判定ではないため、位置変更時は実背景の画像も確認する。

配布施設ピンのタップでは周囲±12pxのうち画面上で最も近い1か所だけを選ぶ。同距離なら描画順で上のピンを優先し、件数による拡大はしない。強調とカメラはその場所に限定する（単一ピンの配置はスマホ画面の上から25%、最大ズーム15）。カードが複数ある場所は「この場所のカード」一覧を開き、カード選択や一覧への復帰でも場所は維持する。表示中の蓋ピンも同じ動き。検索・一覧ページ・共有URL（`?card=…`）からの選択は、そのカードの全配布施設を強調して範囲に収める。

## API（Worker）をローカルで動かす

`/api/*` は web/worker/ の Worker が受ける。設計は [アカウント設計](../docs/account-design.md)、配信は [デプロイ手順](../docs/deployment.md#api-と-d1) を参照。ローカルの D1 と値は `wrangler.jsonc` の `env.dev` にあり、`wrangler dev` は既定で本番に触れない。web/ で次を実行する。

```sh
bun run build
bun run wrangler d1 migrations apply DB --local --env dev
bun run wrangler d1 migrations apply TOMBSTONES --local --env dev
bun run wrangler dev --env dev
```

`http://localhost:8787/` を開く。状態を変える要求は Origin が `http://localhost:8787` と完全に一致しないと 403 になるので、`127.0.0.1` ではなく `localhost` で開く。`/api/health` は D1 に `SELECT 1` を実行して `{"ok":true}` を返す。ローカルの D1 は Git 管理外の `web/.wrangler/` に残る。

- 本番と同じ D1 なしの状態は `bun run wrangler dev --env=""`。`/api/*` は JSON の 404 になる。
- 緊急停止の確認は `bun run wrangler dev --env dev --var API_DISABLED:1`。`/api/*` は 503 になる。

マイグレーションは `migrations/`（本体）と `migrations-tombstones/`（復元後に削除を再適用するための別 DB）に置く。足すときは追加だけの変更にする。

## CI と性能検証

CI の実行内容と差分判定は [.github/workflows/ci.yml](../.github/workflows/ci.yml) と [tools/ci/changes.py](../tools/ci/changes.py) を参照。ブラウザー検査はCIで実行しない。画面操作は人間が確認し、必要ならローカルで手動実行する。

地図の配色・レイアウトの回帰は、fixtureをビルドした後に `mise exec -- node scripts/map-design.browser-check.mjs` で手動検査できる。2026-11-06基準の地方件数を合成データに入れ、412×915/1440×900の9個の円と地名、壊れたstyleの即時エラー、長い詳細と出典の重なり、オフラインの日付を検査する。専用のループバックサーバー（既定4187、`MAP_DESIGN_PORT`で変更）を起動・終了する。CARTOのglyph取得が必要で、実地図や実機の性能を保証する検査ではない。

性能は起動・詳細応答・移動を分けて評価し、fixtureの無地背景やPCの模擬計測をスマホ性能の合格としない。測定結果はPR・CIへ記録する。

実地図の計測は `REAL_DATA_ORIGIN=http://127.0.0.1:4173 mise exec -- node scripts/map-performance.mjs <label>`、集計は `mise exec -- node scripts/summarize-map-performance.mjs <label>`（412×915・モバイル・CPU 4倍・下り1.6Mbps・遅延150ms、初回/キャッシュあり各5回、サーバーは起動しない）。ページとworkerのCDP通信を記録し、実行中は他のビルドやブラウザー試験を重ねない。TBTはFCPから既存のmap-readyまでの計測窓で、LighthouseのTTIによる値や実利用者のINPとは区別する。worker本体の転送量がCDPで欠ける場合は0バイトと解釈しない。

`bun run sizes --fixture --check` がCIで全ページJS合計・MapLibre・全CSS・workerのBrotli予算を検査する。共有・動的チャンクを含む全ページ合計を、初期JS/CSSの保守的な上限にする。実データを生成した本番ビルドでは `bun run sizes --check` でHTML・フォント・データも集計できる。全国データと外部タイルのサイズはfixtureのCI予算の対象に含めない。予算は `scripts/size-budgets.mjs` で管理し、Viteの500KB警告とは別に検査する。MapLibreのmodule workerは `?worker&url` で内容ハッシュ付きの配信資産にし、既存の `/assets/*` のimmutableキャッシュを使う。従来のroot worker URLは古い画面のために引き続き配置する。`mise exec -- node scripts/worker-cache.browser-check.mjs` は実データの `dist` を一時ポートで配信し、再読込時のworker再取得の有無と、オフライン中の検索・詳細を検査して終了する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

地図の検索バーから modal dialog の検索を開く（幅1001px以上では左上の420pxパネル、それ以外は全画面）。入力前は案内を表示し、全国の結果を50件ずつ追加できる。検索と詳細は排他で、語・表示件数・スクロール・選択行を履歴に保存する。結果の選択で `?card=…` の詳細を開き、バーまたはブラウザー戻るで結果へ戻る。検索由来の詳細を×などで閉じると、語を残して地図へ戻る。スマホの詳細は「要約・全画面・たたむ」の3状態で、ピン・検索から選ぶと要約を開く。要約は施設名、配布状態、配布時間、経路と「詳しく」をスクロールなしで表示し、上限は `min(56dvh, 440px)`。上スワイプ・つまみ・本文タップ・「詳しく」で全画面になり、下スワイプは全画面→要約→たたむ→閉じると1段ずつ戻る。全画面の下スワイプは本文の先頭だけで受け付け、つまみとブラウザー戻るも要約へ戻る。全画面だけ同じURLの履歴を1件追加し、背景をinertにする。地図のタップ・ズームでたたむのは要約だけで、横移動ではたたまない。文字拡大で高さ上限を超える場合は、前置き、施設名の2行目の順に詳細ブロックへ回し、配布時間の1行表示・「続きあり」と主ボタンを残す。スマホのボタン列は動くシートの外で画面下端に固定し、要約・全画面で位置を保ち、全画面では「詳しく」を表示しない。要約ブロックは全画面でも同じ配置・省略で先頭に置き、その下に常設した詳細ブロックで配布時間の全文を表示する。詳細のinertとフォーカスは動きの終了後に切り替える。PCは右、短い横画面は左の配置を保つ。シート表示中の現在地と出典表示、選択の余白は実測した要約の高さを使う。

全画面の「蓋の場所」「配布場所に戻る」は `history.back()` で全画面の履歴を消費し、要約への移動と再計測が終わってから既存の選択余白で地図を動かす。外部の Google マップへのリンクはそのまま開く。レイアウト用の `has-summary-layout` / `has-full-layout` はシート自身の transform の `transitionend` 後に切り替え、背景の inert とフォーカスもそのあとに更新する。ドラッグ中と切り替え中は要約の高さを書き換えない。ドラッグの残りの移動は方向にかかわらず280ms、`cubic-bezier(.2,.8,.2,1)`。reduced-motion では即時に完了する。

実データでの切り替え性能は、稼働中の本番ビルドに対し `REAL_DATA_ORIGIN=http://127.0.0.1:4188 mise exec -- node scripts/sheet-performance.mjs <label>` で記録できる。412×915、モバイル、CPU 4倍遅延の Chromium で、上スワイプと「詳しく」を各3回実行する。`results/sheet-smooth/<label>/` にトレースと集計を保存する。操作開始から transform 終了まで、transform の移動中、終了100ms後までの3区間で、50ms以上のタスク、Layout、UpdateLayoutTree、DroppedFrame を数える。サーバーは起動しない。計測値はPRへ記録し、iOS実機の性能とは区別する。

実データのシート配置を確認する読み取り専用の検査は `scripts/detail-sheet-geometry.mjs` に置く。開発サーバーを412×915・ライトで開き、フォントとアニメーションが落ち着いてからブラウザー内でモジュールをimportする。砂川市 `01-226-A001` の全画面先頭で `checkFullSheet()`、要約で `checkSummarySheet()`、ルートの文字サイズを200%（32px）にした要約で `checkSummarySheet({ scaled: true })` を実行できる。主ボタンの位置、全画面の見出しと取っ手の重なり、配布時間、検索バー、現在地と出典の重なりを検査する。サーバーやブラウザーは起動しない。

## ソースの配置

```text
worker/            /api/* の Worker（ルート、CSRF・本文上限・ヘッダー、セッション）
migrations/ migrations-tombstones/  D1 のマイグレーション
src/
  main.ts / cards-main.tsx / about-main.tsx / not-found-main.tsx
  pages/map/       map-page の組み立て、検索、URL状態、詳細選択、シート操作・計測、ページCSS
  pages/cards/     一覧ページ、履歴・フォーカス操作、結果描画、CSS
  pages/about/     aboutページ、クレジット、CSS
  pages/not-found/ 404ページ、CSS
  features/card-detail/  詳細UIとdetail-content.css
  features/card-data/    データ取得とフック
  features/map/         地図描画、Adapter、色、地図操作の純粋関数
  domain/          カード・データ型、カタログ、検索・ピン選択、施設リンク
  shared/browser/  paintedと計測補助
  shared/url/      URL生成・解析
  shared/ui/       出典UIと表示ラベル
  components/ui/map.tsx / lib/utils.ts / prefectures.ts / pref-borders.json
```

テストは対象ファイルの隣に置く。末尾の4ファイルは生成物として出力先を維持する。地図の動的importは `features/map/map-stage.tsx` に保持する。

一覧は `cards-page.tsx` が検索・県選択・詳細を組み立て、`use-catalog-navigation.ts` がURL・履歴・フォーカス、`catalog-results.tsx` が件数・50件ごとの結果描画を担当する。カタログ索引はデータ単位で親が保持し、詳細へ渡す。未送信の検索入力ではID集合・ピン件数の集計・結果描画をやり直さない。

fixtureビルド後も、配信前検査と同じ一覧・about・404の依存検査を実行する。

```sh
node --input-type=module -e 'import { checkCatalogDependencies } from "./scripts/check-deploy.mjs"; await checkCatalogDependencies("dist-fixture"); console.log("Catalog dependencies: OK");'
```

これはHTMLから共有・動的チャンクをたどり、一覧・about・404に地図コードが入っていないことを検査する。fixture全体は `checkDeploy` によって引き続き配信禁止になる。本番用の配信前検査は `node scripts/check-deploy.mjs`。

依存方向は `.oxlintrc.json` のディレクトリ別 overrides と `no-restricted-imports` の patterns で検査する。型だけのimportにも適用する。

- pages は features / domain / shared を使い、他のページをimportしない。
- features は domain / shared を使い、他の機能やページをimportしない。
- domain は React・MapLibre・上位層をimportしない。生成された都道府県マスターの参照は許可する。DOM・fetch・history などのブラウザーグローバルも `no-restricted-globals` で禁止する。
- shared は pages / features をimportしない。
- worker は src・React・MapLibre をimportせず、DOM・ストレージなどのブラウザーグローバルを使わない。Worker のコードとアカウントの SQL がブラウザー向けの配信資産に入っていないことは、配信前検査が確かめる。
- pages/cards・pages/about・features/card-detail・features/card-data は features/map・生成mapcn・MapLibreをimportしない。間接的な地図依存は前述の配信前検査で確認する。

カードの検索・ピン選択・複数カードの選択は `domain/card-selection.ts`、Google Maps へのリンクとURLの検査は `domain/map-links.ts`、地図だけが使う履歴の読み取り `focusFromHistory` は `features/map/map-history.ts` に置く。Adapterと色は `features/map/types.ts`、表示ラベルは `shared/ui/labels.ts`、描画待ちは `shared/browser/painted.ts` に置く。`import/no-cycle` と `import/no-duplicates` は移動後も継続する。

### 地図ページの分割

`main.ts` は `pages/map/map-page.tsx` を動的に読み込む。ページ内の責務は次のように分ける。地図描画は引き続き `features/map/map-stage.tsx` の動的 import 境界を使う。

| ファイル（pages/map/）   | 責務                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| map-page.tsx             | データ・地図・検索・詳細の組み立て、安定した検索中の空ピン配列         |
| use-map-navigation.ts    | 地図階層の変更と mapFocus の履歴復元                                   |
| use-detail-selection.ts  | 選択と URL の同期、施設・蓋の切り替え                                  |
| use-detail-sheet.ts      | 開閉・たたむ・選択時のリセット、フォーカスの復帰、ドラッグ操作との連携 |
| use-explorer-layout.ts   | ResizeObserver と CSS 変数。高さと safe-area を読んでから書き込む      |
| use-selection-metrics.ts | 見出しへのフォーカスと選択から描画までの計測                           |
| map-detail-sheet.tsx     | 詳細の JSX、Escape の委譲                                              |
| map-notices.tsx          | fixture・URL 指定・データ取得・地図の通知                              |

検索は `domain/card-selection.ts` の data 単位の索引を使う。施設の Map とカードの検索文字列を再利用し、AND 検索を保ち、自治体名の完全一致・前方一致・部分一致・その他の順に並べる。同じ段と空欄検索は入力順（カタログでは県コード・カード番号順）を保ち、一覧検索も同じ並びを使う。データは取得時に丸ごと置き換える前提で、古い data とカードは WeakMap のキーから回収できる。

## 検索用の静的ページ

`build` / `build:fixture` の prepare で `scripts/generate-static-pages.mjs` を呼び、出力先の `data/full.json` から県別 `/pref/{slug}/` とカード別 `/card/{id}/` を生成する。47都道府県は固定のローマ字slugを使い、県に属さないカードがある場合は `/pref/other/` も生成する。本文と共通 SiteHeader はビルド時の React 静的描画で、クライアントJSは不要。about末尾と一覧の県選択時の見出し付近から県ページへ移動できる。県ページは自治体見出しへの目次を持ち、カードページは同じ自治体のほかのカードへリンクする。地図の全画面・PC詳細と一覧詳細の出典付近からカードページへ移動できる（スマホ要約には表示しない）。地図は県指定クエリを読み取らないため、県ページの地図リンクは先頭カードの既存 `?card=` を使う（県指定 `?pref=` は一覧の機能）。

`sitemap.xml` は `/`・`/cards`・`/about` と生成ページを収録する。lastmod はデータの updated / evaluatedAt の新しい日付で、ビルド日には置き換えない。`robots.txt` はクロール許可とサイトマップのURLを出す。Cloudflare管理のrobots.txtとの合成結果はPRプレビューで確認する。存在しないカードのURLは既存の404配信に任せる。

ページ用CSSは既存トークン・ヘッダーCSSをまとめて内容ハッシュ付きで出力し、Viteの既存フォントCSSを参照する。`sizes --check` の既存予算は地図起動を保守的に制限するJS/CSS用であり、個別に取得される静的HTMLの合算は対象にしない。予算の除外・上限変更は行わず、追加CSSとaboutのリンク用JSも従来の予算内で検査する。生成HTML・サイトマップ・robots.txtはGitへ追加しない。

## 既存ページの検索・共有情報

4つのHTMLにtitle・description・canonical・OGPを置く。地図の枚数プレースホルダーはViteのabout-data-summaryで公開データの全カード数へ置換する（fixtureはfixtureData）。canonicalは本番の拡張子なしURLとし、既存の.htmlリンクは配信側のリダイレクトで引き続き使える。404はnoindex。WebSiteとWebApplicationのJSON-LDはindex.htmlに置く。

OG画像・apple-touch-icon・manifestはpublic/の管理対象で、Viteのseo-assetsが配信先に配置する。画像の再生成はweb/で次を実行する。既存ロゴのパスとローカルのNoto Sans JPを使い、本文への画像・フォント追加は行わない。

```sh
mise exec -- node scripts/generate-seo-images.mjs
```

一覧とaboutの本文は引き続きクライアント描画。事前描画を導入するときは、一覧のURL条件・非同期データと初期HTMLを一致させ、renderDocumentの同期描画に依存する画面遷移も確認する。

### 回収の記録

アカウント機能は `VITE_ACCOUNTS_ENABLED=true` でビルドした場合だけ表示する（既定は無効）。
`signed_in=1` の表示用 Cookie がある場合に、地図の初期描画後（地図が失敗した場合は失敗後）に記録を取得する。
一覧でも同じフラグと Cookie を使う。記録とメモはメモリだけで扱い、保存の失敗時には操作前の表示へ戻す。日付・メモの保存に失敗したときは、入力した内容を編集欄に残す。
「回収した」と「未回収に戻す」は押した時点で保存する。メモのある記録を未回収に戻すときだけ確認を挟む。
ログアウトで Cookie を消した場合は、フォーカス復帰・ページ再表示・表示状態の変更時に記録も消す。
本番は `wrangler.jsonc` で D1 を結び付け、配信のビルドでフラグを有効にしている（リポジトリ変数 `VITE_ACCOUNTS_ENABLED`）。プレビューには D1 を結び付けないので `/api/*` は404になる。記録を確かめるには API のある開発環境が必要。

### ログイン・アカウント

入口はヘッダーと地図の検索バーにあり、フラグが有効なときだけ表示する。`signed_in=1` の有無で「ログイン」と「アカウント」を切り替えるだけで、未ログインの画面からは API を呼ばない。
`/account.html` はログイン・新規登録・回復・設定を1ページで切り替え、パスキーのコードはこのページの束にだけ入る。`check-deploy.mjs` は地図・一覧・about・404・規約の各ページから静的 import だけを辿り、パスキーのコードが入っていないことを確かめる。フラグ無効のビルドでは、アカウントページは「まだ使えません」の表示だけになる。
回復コードで入った後は、新しいパスキーの登録だけを求める。再読み込みしても sessionStorage の印で同じ手順に戻る。削除・再発行・パスキー削除で API が 403 `reauth_required` を返したら、パスキーで再認証して操作をやり直す。
規約とプライバシーポリシーは `/terms.html`。アカウント・規約のページは noindex で、sitemap に入れない。

サイト全体の CSP は `deploy/_headers` で強制している。地図の通信先は CARTO の `basemaps.cartocdn.com`（スタイル）と `tiles.basemaps.cartocdn.com`（スプライト・フォント・タイル）で、MapLibre の worker のために `worker-src` と `img-src` に `blob:` を許可している。地図の背景を別の配信元へ替えるときは `connect-src` も直す。

パスキーの流れ（登録→ログアウト→ログイン→回復→パスキー削除→アカウント削除）と各ページの CSP は、`VITE_ACCOUNTS_ENABLED=true bun run build` の後に `node scripts/account.browser-check.mjs` で確かめる。8787番で `wrangler dev --env dev` を起動し、ローカル D1 にマイグレーションを当て、Chromium の仮想認証器を使う。`bun run test:browser` からも続けて実行し、フラグ無効の dist なら理由を出して飛ばす。実機のパスキーは人が確かめる。

## フレンド画面

`VITE_ACCOUNTS_ENABLED=true` でビルドすると、アカウント画面から `/friends` へ進める。招待リンクの発行・作り直し、受け取った申請の承認・削除、フレンドとブロックの一覧を扱う。作り直すと前の招待リンクは無効になる。リンクの平文は発行時だけ API が返すため、再表示はできない。送った申請の一覧や状態は表示しない。

`/friends/invite#t=…` は起動時にフラグメントを URL から消して照会する。ログイン・登録に進むときだけトークンを sessionStorage に置く。招待ページの起動時と、bfcache からの復帰を含む pageshow・フォーカス復帰・再表示時に保存値を読み出してすぐ消し、そのページのメモリだけに持つ。再ログインへ進むときだけ保存し直し、ログアウト時にも保存値を消す。復帰時に Cookie を読み直して別タブのログインを表示へ反映し、ログイン中から未ログインに変わっていたらメモリと保存値のトークンを捨てる。その場合は招待リンクをもう一度開くように案内する。アカウント画面の `returnTo` は `/` で始まるパスを URL として正規化し、同一オリジンであることを確かめる。正規化後の pathname が `//` で始まる場合、バックスラッシュやエンコードしたパスの区切りを含む場合、入力に制御文字がある場合は拒否し、検証済みの pathname・search・hash を返す。登録時は回復コードを控える手順を終えてから戻る。フレンドと招待の HTML は noindex で、sitemap に含めず、地図とパスキーのコードを読み込まない。

`/?friend=<利用者ID>` は既存の地図にフレンドの記録だけを重ねる。名前・戻るリンクを表示し、詳細の日付は閲覧専用にする。自分の記録は取得しない。フレンド以外・解除後・ブロック後などの 404 は「表示できません」と表示する。初期の API 取得は地図の初期化完了か失敗の後に行い、失敗しても公開カードの地図・検索・詳細は使える。未ログインでは私的な API を呼ばず、フラグが無効ならフレンド画面へのリンクも出さない。

型検査はアプリ・worker に `exactOptionalPropertyTypes` を適用する。生成された mapcn とその `cn` 補助だけは `tsconfig.mapcn.json` の参照プロジェクトで従来の設定で検査し、`.cache/mapcn/` に型宣言を生成する。`bun run typecheck` が宣言の更新と本体の検査を順に実行する。import される生成コードは `exclude` だけでは検査対象から外れないため、プロジェクト参照で分けている。
