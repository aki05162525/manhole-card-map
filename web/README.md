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

Stylelint（`bun run lint:css`）は src/**/*.css とルート HTML の style を検査する。正しさの規則だけを使い、整形は Oxfmt に任せる。Tailwind 固有の at-rule は現行 CSS にある theme・apply・source だけを許可する。コミットフックは変更された CSS・HTML を検査し、Stylelint 設定や依存の変更では全体を検査する。

Knip（`bun run knip`）は CI で全体を検査する。地図・一覧・about・404・アカウント・規約・フレンド・招待の HTML とそこから参照するエントリ、Vite/Vitest 設定（組み込みプラグインが検出）、scripts/*.mjs、テストを入口にする。生成 mapcn の src/components/ui/map.tsx と src/lib/utils.ts は未使用 export・型の検査から除外し、ファイルや依存の検査は残す。Worker（worker/）の入口は wrangler.jsonc の `main` から Knip の wrangler プラグインが見つける。lefthook はリポジトリ直下の lefthook.yml から `web/node_modules/.bin/lefthook` として呼ばれる。Knip の lefthook プラグインは設定を web/ の中でだけ探し、ほかには導入済みの Git フックしか見ない。フックを入れていない CI では使い道が見えないので、`ignoreDependencies` で除外する。

Worker のテスト（worker/*.test.ts）は wrangler の `createTestHarness` で workerd を起動し、空のローカル D1 に全マイグレーションを当ててから検査する。`@cloudflare/vitest-pool-workers` は Vitest 5 で起動できなかったので使わない。

Vitest は *.dom.test.tsx だけを jsdom プロジェクトで実行する。既存の *.test.ts は node のまま。React Testing Library の DOM テストは対象ファイルの隣に置く。

## 合成データで動かす

実データなしで再現できる。架空カード5枚と通信不要の検査用スタイルを生成する。

```sh
bun run build:fixture
SERVE_DIR=dist-fixture PORT=4179 bun run preview
```

`http://127.0.0.1:4179/` を開く。背景は検査用の無地で、実際の道路地図ではない。共有施設・複数配布先・位置未確定を含む。fixture ビルド（`--mode fixture`）は地図・一覧の両画面に警告を表示して識別し、実在する訪問先として使わない。

```sh
bunx --no-install playwright install chromium
# アカウント検査用。実データ生成後に実行する
VITE_ACCOUNTS_ENABLED=true bun run build
bun run test:browser
```

ブラウザー検査は独立したループバックサーバーを起動・終了する。一覧のnull・終了カードなどの描画検査には `public/data/full.json` を使うため、先に次節の実データ生成も行う。検査対象は `scripts/browser-check.mjs`・`scripts/cards-page.browser-check.mjs`・`scripts/account.browser-check.mjs` を参照。アカウント検査は `dist/assets` が必要で、アカウントを有効にしたビルドでのみ実行する。

## 実データで動かす

Git管理された保存入力だけから生成する。公開用4ファイルは `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。スクリプトは台帳の行ファイル `data/db/` から `tools/db/ledgerdb.py export-ledger` で書き出した台帳を `-places` で渡す（[台帳データベースの設計](../docs/database-design.md)）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。配布情報の変更の失効判定に使う現一覧 `data/raw/gkp-list-20261105.html` を `-review-list` で渡し、基準日を `2026-11-06` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイルをソースに、OS の配色設定に合わせてアプリが再配色する。地図ソースは切り替えず、OS 設定の変更時もカメラ・選択・読み込んだデータを保って paint とピン画像を更新する。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。本番は、本番のホストだけを許可した CARTO のキーを含む `VITE_MAP_STYLE_URL` でビルドする（[デプロイ手順](../docs/deployment.md#prプレビュー)）。

採用範囲は [台帳データベースの設計](../docs/database-design.md)を参照。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

実データの操作確認はローカルサーバー起動後に `node scripts/real-data-browser-check.mjs` で実行する。

地図を開いた文書は、まず `pins.json` だけで地図とピンを出す（`features/card-data/card-data.ts`）。MapLibre の地図はデータを待たずに作り始め、ピンの層は `pins.json` が届いてから載せる（`map-ready` はピンが載った後）。地図に要らない `details.json` は、地図が使えるようになる（`onReady`）か初期化に失敗する（時間切れを含む）まで取らず、地図が要るものと帯域を分け合わない。ただし、`/?card=…` で開いたとき、ピンを選んだとき、検索を開いたとき、一覧へ切り替えたときはその時点で取る（`requestDetails()`）。キャッシュにあるときも同じで、その解析は地図の初期化と重ならない。詳細が届くと検索・詳細が使えるようになり、両方の `updated` が一致しなければデータ取得の失敗と同じ表示になる。詳細より前に選んだピン・`/?card=…`・検索の入力は保ち、届いたら表示する。それまでの「読み込み中」は400ms たってから出す（`shared/ui/delayed.tsx`）。待っている間のスマホの要約シートは見出しの帯の高さで、詳細が届いたら要約と操作欄を測り直して伸びる（`use-explorer-layout.ts` は届いたデータでも測り直す）。`/?card=…` のカードの配布施設へはピンだけでカメラを向ける。詳細の到着前は配布施設のピンをそのまま出す（`cmd/builddata` は位置を確かめた施設にだけピンを出す。到着後は従来どおり `places` で絞る）。どちらも全詳細をメモリに保持する。地図の裸の `/` は全国表示で始まり、`?benchmark` に特別な範囲復元の挙動はない。`/?card=…` は詳細を復元し、配布施設ピンがあれば対象へ移動する。`/cards` は県・検索・ページ・詳細をQueryに保持する一覧で、直接開いたときは地図のコードを読み込まない（地図との切り替えは「画面の切り替え」）。県も検索語も回収状況の絞り込みも指定されていない全国表示は地域選択だけを表示し、県を選ぶか検索・絞り込みを使うとカード一覧を表示する。戻る・進む操作でもこの状態を復元する。全国表示の枚数・基準日・県ごとの枚数はビルド時に `cards.html` へ埋め込み、全国データを待たずに最初の描画で出す。データ到着前に県・検索・戻る進むを操作するとURLと見出しはすぐ変わり、結果と詳細の欄だけが読み込み表示になる。

配布場所ピンは状態の色で■を描く。色の凡例は地図に置かず、記号の説明はaboutに置く。OpenStreetMap contributors・CARTOへの出典は地図右下に枠なしの小さな1行（10px）で常時表示し、シート表示中は実測した要約の高さに従って移動する。

全国の9地方の件数は丸の中だけに表示し、横のラベルは地名だけにする。表示位置・左右の向きは `features/map/area-layout.ts` で管理する。412×915・1440×900の投影テストで丸と地名の重なり・見切れを、県代表点の外接範囲（単独県は本土側範囲）のテストで位置の逸脱を検査する。後者は海岸線の厳密な判定ではないため、位置変更時は実背景の画像も確認する（件数・ラベルの決まりは [mapcn設計](../docs/mapcn-design.md)）。

配布施設ピンのタップは周囲±12pxで画面上で最も近い1か所を選ぶ。強調・カメラの扱い（単一ピンは画面上端から25%、最大ズーム15）も含め、[mapcn設計](../docs/mapcn-design.md) と同じ。

## API（Worker）をローカルで動かす

`/api/*` は web/worker/ の Worker が受ける。設計は [アカウント設計](../docs/account-design.md)、配信は [デプロイ手順](../docs/deployment.md#api-と-d1) を参照。ローカルの D1 と値は `wrangler.jsonc` の `env.dev` にあり、`wrangler dev` は既定で本番に触れない。web/ で次を実行する。

```sh
bun run build
bun run wrangler d1 migrations apply DB --local --env dev
bun run wrangler d1 migrations apply TOMBSTONES --local --env dev
bun run wrangler dev --env dev
```

`http://localhost:8787/` を開く。状態を変える要求は Origin が `http://localhost:8787` と完全に一致しないと 403 になるので、`127.0.0.1` ではなく `localhost` で開く。`/api/health` は D1 に `SELECT 1` を実行して `{"ok":true}` を返す。ローカルの D1 は Git 管理外の `web/.wrangler/` に残る。

- `--env=""` で起動すると、トップレベルの `DB`・`TOMBSTONES` をローカルの D1 として結び付ける。D1 なしで確かめるときは、プレビューと同じく D1 を除いた設定を作って起動する。`/api/*` は JSON の 404 になる。作った `wrangler.preview.json` は Git の管理外にしていないので、確かめたら消す。

  ```sh
  node scripts/wrangler-config.mjs preview wrangler.preview.json
  bun run wrangler dev --config wrangler.preview.json
  ```

- 緊急停止の確認は `bun run wrangler dev --env dev --var API_DISABLED:1`。`/api/*` は 503 になる。

マイグレーションは `migrations/`（本体）と `migrations-tombstones/`（復元後に削除を再適用するための別 DB）に置く。足すときは追加だけの変更にする。

## CI と性能検証

CI の実行内容と差分判定は [.github/workflows/ci.yml](../.github/workflows/ci.yml) と [tools/ci/changes.py](../tools/ci/changes.py) を参照。ブラウザー検査はCIで実行しない。画面操作は人間が確認し、必要ならローカルで手動実行する。

地図の配色・レイアウトの回帰は、fixtureをビルドした後に `mise exec -- node scripts/map-design.browser-check.mjs` で手動検査できる。2026-11-06基準の地方件数を合成データに入れ、412×915/1440×900の9個の円と地名、壊れたstyleの即時エラー、長い詳細と出典の重なり、オフラインの日付を検査する。専用のループバックサーバー（既定4187、`MAP_DESIGN_PORT`で変更）を起動・終了する。CARTOのglyph取得が必要で、実地図や実機の性能を保証する検査ではない。

性能は起動・詳細応答・移動を分けて評価し、fixtureの無地背景やPCの模擬計測をスマホ性能の合格としない。測定結果はPR・CIへ記録する。

実地図の計測は `REAL_DATA_ORIGIN=http://127.0.0.1:4173 mise exec -- node scripts/map-performance.mjs <label>`、集計は `mise exec -- node scripts/summarize-map-performance.mjs <label>`（412×915・モバイル・CPU 4倍・下り1.6Mbps・遅延150ms、初回/キャッシュあり各5回、サーバーは起動しない）。ページとworkerのCDP通信を記録し、実行中は他のビルドやブラウザー試験を重ねない。計測マークは `data-requested`（データの取得開始）、`map-create`（地図の画面の作成。データを待たない）、`pins-ready`・`data-ready`（ピン・詳細の到着）、`map-ready`（ピンを載せた地図の描画後）。TBTはFCPから既存のmap-readyまでの計測窓で、LighthouseのTTIによる値や実利用者のINPとは区別する。worker本体の転送量がCDPで欠ける場合は0バイトと解釈しない。

`bun run sizes --fixture --check` がCIで全ページJS合計・MapLibre・全CSS・workerのBrotli予算を検査する。共有・動的チャンクを含む全ページ合計を、初期JS/CSSの保守的な上限にする。実データを生成した本番ビルドでは `bun run sizes --check` でHTML・フォント・データも集計できる。全国データと外部タイルのサイズはfixtureのCI予算の対象に含めない。予算は `scripts/size-budgets.mjs` で管理し、Viteの500KB警告とは別に検査する。MapLibreのmodule workerは `?worker&url` で内容ハッシュ付きの配信資産にし、既存の `/assets/*` のimmutableキャッシュを使う。`mise exec -- node scripts/worker-cache.browser-check.mjs` は実データの `dist` を一時ポートで配信し、再読込時のworker再取得の有無と、オフライン中の検索・詳細を検査して終了する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

地図の検索は modal dialog で開く（幅1001px以上は左上の420pxパネル、それ以外は全画面）。空欄の案内、履歴の扱い、閉じ方は [mapcn設計](../docs/mapcn-design.md) に従う。スマホの詳細は「要約・全画面・たたむ」の3状態で、全画面だけ同じURLの履歴を1件追加し、背景をinertにする。操作の詳細も同じ文書に従う。要約は施設名、配布状態、配布時間、経路と「詳しく」をスクロールなしで表示し、上限は `min(56dvh, 440px)`。文字拡大で高さ上限を超える場合は、前置き、施設名の2行目の順に詳細ブロックへ回し、配布時間の1行表示・「続きあり」と主ボタンを残す。スマホのボタン列は動くシートの外で画面下端に固定し、要約・全画面で位置を保ち、全画面では「詳しく」を表示しない。要約ブロックは全画面でも同じ配置・省略で先頭に置き、その下に常設した詳細ブロックで配布時間の全文を表示する。詳細のinertとフォーカスは動きの終了後に切り替える。PCは右、短い横画面は左の配置を保つ。シート表示中の現在地と出典表示、選択の余白は実測した要約の高さを使う。

全画面の「蓋の場所」「配布場所に戻る」は `history.back()` で全画面の履歴を消費し、要約への移動と再計測が終わってから既存の選択余白で地図を動かす。外部の Google マップへのリンクはそのまま開く。レイアウト用の `has-summary-layout` / `has-full-layout` はシート自身の transform の `transitionend` 後に切り替え、背景の inert とフォーカスもそのあとに更新する。ドラッグ中と切り替え中は要約の高さを書き換えない。ドラッグの残りの移動は方向にかかわらず280ms、`cubic-bezier(.2,.8,.2,1)`。reduced-motion では即時に完了する。

実データでの切り替え性能は、稼働中の本番ビルドに対し `REAL_DATA_ORIGIN=http://127.0.0.1:4188 mise exec -- node scripts/sheet-performance.mjs <label>` で記録できる。412×915、モバイル、CPU 4倍遅延の Chromium で、上スワイプと「詳しく」を各3回実行する。`results/sheet-smooth/<label>/` にトレースと集計を保存する。操作開始から transform 終了まで、transform の移動中、終了100ms後までの3区間で、50ms以上のタスク、Layout、UpdateLayoutTree、DroppedFrame を数える。サーバーは起動しない。計測値はPRへ記録し、iOS実機の性能とは区別する。

実データのシート配置を確認する読み取り専用の検査は `scripts/detail-sheet-geometry.mjs` に置く。開発サーバーを412×915・ライトで開き、フォントとアニメーションが落ち着いてからブラウザー内でモジュールをimportする。砂川市 `01-226-A001` の全画面先頭で `checkFullSheet()`、要約で `checkSummarySheet()`、ルートの文字サイズを200%（32px）にした要約で `checkSummarySheet({ scaled: true })` を実行できる。主ボタンの位置、全画面の見出しと取っ手の重なり、配布時間、検索バー、現在地と出典の重なりを検査する。サーバーやブラウザーは起動しない。

## ソースの配置

```text
worker/            /api/* の Worker（ルート、CSRF・本文上限・ヘッダー、セッション）
migrations/ migrations-tombstones/  D1 のマイグレーション
src/
  main.ts / cards-main.tsx / about-main.tsx / not-found-main.tsx
  app/             地図・一覧・フレンド・アカウントを同じ文書で切り替える層、画面ごとの head（document-meta.ts）
  account-main.tsx / terms-main.tsx / friends-main.tsx / invite-main.tsx
  pages/map/       map-page の組み立て、検索、URL状態、詳細選択、シート操作・計測、ページCSS
  pages/cards/     一覧ページ、履歴・フォーカス操作、結果描画、CSS
  pages/about/     aboutページ、クレジット、CSS
  pages/not-found/ 404ページ、CSS
  pages/account/   ログイン・新規登録・回復・設定、CSS
  pages/terms/     規約とプライバシーポリシー
  pages/friends/   フレンド画面と招待ページ、CSS
  features/card-detail/  詳細UIとdetail-content.css
  features/card-data/    データ取得とフック
  features/map/         地図描画、Adapter、色、地図操作の純粋関数
  features/records/     回収の記録の取得・編集・絞り込み、CSS
  features/account/     アカウントAPIとパスキー（WebAuthn）の呼び出し
  features/friends/     フレンドAPIとフレンドの回収マップ
  domain/          カード・データ型、カタログ、検索・ピン選択、施設リンク
  shared/browser/  履歴の口（app-history.ts）、paintedと計測補助
  shared/url/      URL生成・解析
  shared/ui/       出典UIと表示ラベル
  shared/universal/  WorkerとブラウザーがどちらもimportするJST日付・base64url（他へ依存しない）
  components/ui/map.tsx / lib/utils.ts / prefectures.ts / pref-borders.json
```

テストは対象ファイルの隣に置く。末尾の4ファイルは生成物として出力先を維持する。地図の動的importは `features/map/map-stage.tsx` に保持する。

一覧は `cards-page.tsx` が検索・県選択・詳細を組み立て（データ到着前は `cards-main.tsx` が `#root` から読んだ集計で地域選択を描く）、`use-catalog-navigation.ts` がURL・履歴・フォーカス、`catalog-results.tsx` が件数・50件ごとの結果描画を担当する。カタログ索引はデータ単位で親が保持し、詳細へ渡す。未送信の検索入力ではID集合・ピン件数の集計・結果描画をやり直さない。

fixtureビルド後も、配信前検査と同じ一覧・about・404などの依存検査を実行する。

```sh
node --input-type=module -e 'import { checkAuthBoundary, checkCatalogDependencies, checkFirstView } from "./scripts/check-deploy.mjs"; await checkCatalogDependencies("dist-fixture"); await checkAuthBoundary("dist-fixture"); await checkFirstView("dist-fixture", "/data"); console.log("Catalog dependencies: OK");'
```

これは各ページの最初の表示で取得するもの（HTML の資産、静的 import、動的 import と Vite がそれに添えて先読みするファイル）をたどり、地図の文書以外に地図のコード（MapLibre・worker・地図の CSS など）が、アカウントの文書以外にパスキーのコード（`checkAuthBoundary`）が入っていないことを検査する。例外は、画面を切り替えるページ（地図・一覧・フレンド・アカウント・about）がほかの画面へ切り替えるための動的 import（`app/*-screen.tsx` のチャンク `map-screen-*.js`・`catalog-screen-*.js`・`friends-screen-*.js`・`account-screen-*.js`・`about-screen-*.js`）とその先読みだけで、そのページの最初の表示には含めない。import は Vite の `parseAst` で構文木から読み、この例外は import が関数の中にあるとき（Vite が動的 import を包む矢印関数のほかに、関数がもう1つ外側にあるとき）だけ認める。モジュールのトップレベルに置いたほかの画面の import、画面を切り替えないページからの同じ import、静的な参照は最初の表示に含めて検査する。地図とアカウントの画面のチャンクは、中身によらず名前でも拒否する（アカウント機能を無効にしたビルドにはパスキーのコードがないため）。限界：関数の中にあれば、その関数が起動時に呼ばれても通る（起動時に即時実行する関数や、最初の描画で呼ぶ関数は見分けられない）。実行時は `scripts/cards-page.browser-check.mjs` が、一覧を開いて操作する間に地図のチャンク・CSS・worker・スタイルを取得しないことを確かめる。`checkFirstView` は、地図のデータのpreloadが指定の場所の `pins.json` だけを、一覧のpreloadが `full.json` を指し、地図の HTML が MapLibre の束と `card-map-*.js` を modulepreload し、地図の preconnect が `_headers` の CSP の `connect-src` に収まり（`_headers` は実データのビルドだけにある）、ほかのページに preconnect がなく、一覧に埋め込んだ集計がその `full.json` と一致することを確かめる（本番用の `checkDeploy` は `/data-v/<世代名>` で同じ検査をする）。fixture全体は `checkDeploy` によって引き続き配信禁止になる。本番用の配信前検査は `node scripts/check-deploy.mjs`。

依存方向は `.oxlintrc.json` のディレクトリ別 overrides と `no-restricted-imports` の patterns で検査する。型だけのimportにも適用する。

- app は pages / features / domain / shared を組み立て、各画面を同じ React ツリーに置く。ほかの層は app を import しない（循環は `import/no-cycle` が検査する）。

- pages は features / domain / shared を使い、他のページをimportしない方針。lint が検査するのは pages/map・pages/cards・pages/about の互いのimportで、ほかのページ（account・friends・terms・not-found）は方針として守る。
- features は domain / shared を使い、ページをimportしない。lint が検査するのは features/map・features/card-detail・features/card-data の3つで、ページと、この3つの互いのimportを禁じる。それ以外の機能同士のimportはあり、features/card-detail と features/friends が features/records を、features/friends が features/account をimportしている。
- domain は React・MapLibre・上位層をimportしない。生成された都道府県マスターの参照は許可する。DOM・fetch・history などのブラウザーグローバルも `no-restricted-globals` で禁止する。
- shared は pages / features をimportしない。
- worker は src・React・MapLibre をimportせず、DOM・ストレージなどのブラウザーグローバルを使わない。Worker のコードとアカウントの SQL がブラウザー向けの配信資産に入っていないことは、配信前検査が確かめる。
- pages/cards・pages/about・features/card-detail・features/card-data は features/map・生成mapcn・MapLibreをimportしない。間接的な地図依存は前述の配信前検査で確認する。

### 画面の切り替え

地図（`/`、`/?card=…`、フレンドの回収マップ `/?friend=…`）、一覧（`/cards`、クエリ付き）、フレンド（`/friends`）、アカウント（`/account`、`?returnTo=` 付きを含む）、about（`/about`、`#credits` などのフラグメント付きを含む）の間は、同じ文書の中で画面を切り替える（`app/app.tsx`、Issue #260）。各 HTML は自分の画面から起動し（`main.ts`・`cards-main.tsx`・`friends-main.tsx`・`account-main.tsx`・`about-main.tsx`）、直接開いたとき・再読み込み・404 はこれまでどおり。

- 捕まえるのは、ほかの画面へのリンクの、修飾キーのない通常のクリックだけ。`<a href>` は本物のまま。新しいタブ・修飾キー・`target`・`download`、ほかのページ（招待・規約・県・カード）、同じ画面へのリンク（about の中の `#…` も）、回復（`/account?recover`）、`openExternalBrowser` 付きのリンク、LINE のアプリ内ブラウザーでのフレンドとアカウント（文書として開けば Worker が標準ブラウザーへ渡す）は通常の移動。地図から地図へは、見せている人（自分かフレンドか）が変わるときだけ切り替える。移動先の画面のチャンクを取得できないとき、画面を見せるまでの処理（行き先の決定、利用者の再確認、離れる画面の後始末、view transition、履歴の書き込み、フォーカス）が例外を投げたとき、切り替えた後に画面の描画が失敗したときは、その URL を文書として開く。戻る・進むで同じことが起きたら再読み込みする。
- 保持するのは地図と一覧だけ。見せていない地図と一覧はマウントしたまま隠す（`inert`）。about は状態を持たないので、離れたらアンマウントし、入り直すと同じ表示を描く。フレンドとアカウントは離れたらアンマウントし、状態（回復コード、招待の URL、認証の途中、入力、確認ダイアログ）を捨てる。読み取りの結果（フレンド一覧・受け取った申請・ブロック一覧・招待の期限、プロフィール・パスキー一覧・回復コードの残数）は、同じ文書の間、今の利用者（`session_mark`）に結び付けてメモリに持ち（`features/account/private-reads.ts`）、入り直したら最初の描画でそれを出して裏で取り直す。回復コードそのもの、招待の URL、ログイン・登録・再認証の途中、入力途中の値、確認ダイアログは持たない（ログアウト・401・削除・印の不一致で消し、storage と history には入れない）。取り直しに失敗しても、出した結果はそのままにして既存のエラー表示で知らせる。それでも届かないときの「読み込み中…」は、400ms たってから出す（`shared/ui/delayed.tsx`）。離れた後に届いた応答や、開いたままのパスキーの確認は、画面の私的な API（`features/account/account-api.ts` の `usePrivateApi`）が捨てる。離れるときに確認の WebAuthn 要求を中止し（`signal`）、確認が通っても、その後の再認証の verify と重要な操作（回復コードの再発行、パスキーの削除、アカウントの削除）は送らない。ログイン・登録は離れた後でも成立させる（画面は移動しない）。地図は `visibility: hidden` で離れたときの大きさを保ち（`app/app.css`）、MapLibre のインスタンスは文書に最大1個。隠している間はカメラを止め、データを地図へ反映せず、遅れて届いた地図の操作（位置情報の結果、シートの後の移動など）も Adapter が無視する。位置情報は戻ってからもう一度押してもらう。表示に戻すときに `resize()` と再描画をする（`features/map/map-layers.tsx`）。検索の modal は隠すときに閉じ、戻ると開き直す。開いているメニューの popover は切り替え前に閉じる。一覧は `hidden` で文書の流れから外す。
- 各画面のチャンク（`app/*-screen.tsx`）は、その画面を初めて開いたときに読む。その前に、メニューが開いたとき（`shared/ui/site-menu.tsx` が `sitemenuopen` を出す）と、切り替えるリンクへの `pointerdown`・`focus`・`pointerenter` で読み始め、ログイン中ならフレンド・アカウントの最初の読み取りも始める（`readAhead`。guard を通し、同じ要求を重ねず、入ったときはその結果を使う。未ログインでは呼ばない）。地図のチャンクは、地図へのリンクへの `pointerdown`・`focus` のときだけ。メニューを開くとアカウントのチャンク（パスキーのコード）も読むが、最初の表示ではないので `check-deploy.mjs` の境界の内側にある。全国データは `features/card-data/card-data.ts` が文書で1回だけ取得する。地図から始めた文書は分割（`sharedMapData()`）、一覧から始めた文書は `full.json`（`sharedCardData()`）で読み、あとから開いた画面はその結果を使う。
- ヘッダー・メニュー・ロゴの `/`・`/cards` は、その画面を離れたときの項目（地図のカメラ・選択・詳細・検索、一覧の県・検索・ページ・詳細・スクロール位置）へ戻る。ただし最後の地図の項目がフレンドの回収マップなら、`/` はそのカメラのまま自分の地図を開く。本文のリンクはその URL へ進む（`/?card=…` と `/?friend=…` は保持した地図でそのカードを選ぶか、その人の記録に替え、「地域から探す」は地域の選択を出す）。
- 切り替えると title・description・canonical・`og:*`・viewport・robots を画面に合わせ（`app/document-meta.ts`。HTML にないものは消し、あるものは作る。`document-meta.dom.test.tsx` が各 HTML と一致することを確かめる。地図の description の枚数は、フレンド・アカウント・about の HTML では `#root` の `data-card-count` から読む）、移動先の `h1`（なければ `main`）へフォーカスを移す。リンクにフラグメントがあれば、その要素までスクロールしてフォーカスを移す（`/about#credits`）。about の件数・配布場所の数・基準日は、ビルド時に about と各入口の HTML の `#root` へ同じ値を入れ（`data-about-summary`、`pages/about/about-summary.ts` の `aboutAttributes`）、どの文書から入っても同じ表示になる。`check-deploy.mjs` の `checkFirstView` が、各入口の値がデータから数えた値と一致することを確かめる。戻る・進むでは、その項目を離れたときのスクロール位置とフォーカスを戻す。画面の切り替えは、リンクでも戻る・進むでも、演出なしで即時に行う（ロゴや帯が動くと行き来のたびにちらつくため）。別の文書への移動（規約・県ページなど）は `shared/ui/document-transitions.css` の帯の切り替えとフェードだけで、ロゴは動かさない。
- ログイン後に `returnTo` へ戻るなど、ページが自分で移動するときは `navigate(href)`（`shared/browser/app-history.ts`）を使う。app の層が受ければ切り替え、受けなければ `location.assign`。
- 文書のヘッダーは最初に開いたページのもののままなので、5つの入口（地図・一覧・フレンド・アカウント・about）は同じ保護ヘッダーを返す（[アカウント設計](../docs/account-design.md) の SE-1）。
- ビルド時のフラグ `VITE_SCREEN_SWITCH=false` で止められる（未設定なら有効。[配信手順](../docs/deployment.md)）。無効のビルドは従来の文書遷移になる。
- 検査は `src/app/app.dom.test.tsx`（往復しても地図の生成1回、状態・スクロール・フォーカスの復元、データと記録の取得1回、フレンドを替えても前の記録を出さないこと、アカウントの状態を残さないこと、`returnTo` へ戻る流れとログアウト、未ログインで私的な API を呼ばないこと、通常の移動に任せる条件、取得・描画の失敗時の退避、地図の初期化失敗後の一覧）、`src/entries.dom.test.tsx`（フラグ）、`check-deploy.mjs`（各ページの最初の表示）。

### 画面ごとの CSS

地図・一覧・フレンド・アカウントは同じ文書の中で切り替え（Issue #260）、読み込んだ CSS は画面を離れても残る。画面の CSS は自分の根の要素の内側にだけ効かせる。

- 地図（`pages/map/style.css`・`map-search.css`）は全体を `:where(.explorer) { … }` の入れ子にする。`:where()` は重みを足さないので、各規則の重みはこれまでどおり。Tailwind の preflight は `pages/map/preflight.css`（根に絞った写し）を使い、`@import "tailwindcss"` は使わない。utilities の走査対象は `components/ui` だけ。`@keyframes` は入れ子の外に置く。ビルドは入れ子を平坦なセレクターに直して出力する。
- 一覧は `.cards-page`、アカウント・フレンド・招待は `.account-page` の内側。クラス名は `catalog-`・`account-`・`friend-` などの接頭辞で分ける。
- どのページにも効かせる規則（トークン、`body` の余白、見出し・段落の折り返し、フォーカスの輪郭、押下の動き）は `shared/ui/tokens.css` に置く。クラス・ID・属性のない規則を足すときは `scripts/css-isolation.test.ts` の許可の一覧に足す。
- `features/card-detail/detail-content.css` のように複数の画面が使う CSS は、別の画面の束と一緒にもう一度読み込まれ、画面の規則より後ろに来ることがある。画面の規則と共通の規則が同じ重みで同じプロパティを指定すると、読み込み順で見た目が変わる。画面側の規則に要素名を足して重みで決める（`section.detail-panel h3`）。どちらの画面でも負けている共通の指定は消す。

`scripts/css-isolation.test.ts` は、ビルドした CSS にクラス・ID・属性のない規則が許可の一覧以外に残っていないことと、Tailwind の preflight が写しを作った版から変わっていないことを CI で検査する。見た目は `bun run build:fixture` の後に `mise exec -- node scripts/css-isolation.browser-check.mjs` で手動検査する。一時ポートで配信し、一覧・地図・フレンド・アカウント・about の各状態を、そのまま撮った画像と、他の画面の CSS を `<link>` で足した画像とで比べる（ライト・ダーク、412×915・1280×800、画素と各要素の箱）。差が出たら、変わった計算後のスタイルを要素ごとに表示する。`--save <dir>` で撮った画像を残し、`--against <dir>` で別のビルドの画像と比べる。`--dir dist --card <ID>` は実データのカード1枚を一覧と地図の詳細で比べる。検索用の静的ページの CSS（`static-pages-*.css`）は対象外。

### 履歴の口

History API への書き込み（`pushState`・`replaceState`・`back`）と popstate の購読は `shared/browser/app-history.ts` だけが行う。pages・features・app では `history` を直接使えない（`no-restricted-globals`、`window.history`・`globalThis.history` の分割代入なども含め `history` の取り出しと `onpopstate` は `no-restricted-properties`、`popstate` という名前は JS プラグイン `scripts/oxlint-app-history.mjs`。テストは対象外。同じ文書で切り替える画面ではない招待ページのフラグメント消去だけ、理由付きの例外を置く）。shared に置くので pages / features をimportせず、画面のフックがこの口をimportする。

- 履歴項目の持ち主はパスで決まる（`/` は地図、`/cards` は一覧、`/friends` はフレンド、`/account` はアカウント。ローカルの `.html` も同じ）。フレンドとアカウントは履歴へ書かない。画面のフックは `routeHistory("map")`・`routeHistory("catalog")` を通して、自分の画面の項目だけを読み書きする。別の画面の項目が現在のあいだ、`state()` は null を返し、`push`・`replace` は何も書かずに false を返す。`subscribe` の購読先は、自分の画面の項目への到着だけを受け取る。到着は、その項目へ移動した popstate と、`switchScreen()` による別の画面からの切り替え（その画面が最後に見せていた項目と同じでないとき）の2つ。
- 口が書いた項目は `history.state.appEntry` に `route`・`id`・`from`（直前の項目の画面）を持つ。画面固有の状態は従来どおり `mapFocus`・`mapSearch`・`mapCardNavigation`・`sheet`・`catalog`・`catalogDetailEntry` に分けて置く。`appEntry` のない項目（最初の項目、再読み込みや bfcache 復帰で残った古い形）は、パスから持ち主だけを決める。私的データは入れない。
- 「閉じる」で履歴を戻るときは `back()` を使う。直前の項目が同じ画面のものだと分かるとき（`from` が自分の画面）だけ戻って true を返す。false のときは、呼び出し側が自分の状態だけを閉じる。
- 遅らせる書き込みは `deferred()` で作る（地図の検索の500ms後の `replaceState`）。予約した項目が現在でなくなっていたら捨てる。`flushHistoryWrites()` は保留中の書き込みをすぐ確定する。画面を離れる前と、保留を持たないフックが `push` する前に呼ぶ。
- 画面の切り替えは `switchScreen({ from, to, url, state })` だけが行う（`push` は同じ画面の中の項目用。地図から別の人の地図へ移るときは `from` と `to` が同じで、到着として届ける）。保留中の書き込みを離れる項目へ確定し、その項目に印を付けてから、`to` の項目を `from` の後ろに積む。`to` の購読先は、その画面が最後に見せていた項目と同じでなければ到着を受け取る。`onTraversal` は app の層が popstate を先に受け取り、画面を見せてから購読先へ届けるための口。`latestEntry(route)` は各画面が最後に現在だった項目を返す。

カードの検索・ピン選択・複数カードの選択は `domain/card-selection.ts`、Google Maps へのリンクとURLの検査は `domain/map-links.ts`、地図だけが使う履歴の読み取り `focusFromHistory` は `features/map/map-history.ts` に置く。Adapterと色は `features/map/types.ts`、表示ラベルは `shared/ui/labels.ts`、描画待ちは `shared/browser/painted.ts` に置く。`import/no-cycle` と `import/no-duplicates` は移動後も継続する。

### 地図ページの分割

`main.ts` は `app/app.tsx` と `app/map-screen.tsx`（`pages/map/map-page.tsx` とその CSS）を動的に読み込む（フラグ無効のビルドは、従来どおり `map-page.tsx` を直接）。ページ内の責務は次のように分ける。地図描画は引き続き `features/map/map-stage.tsx` の動的 import 境界を使う。

| ファイル（pages/map/）   | 責務                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| map-page.tsx             | データ・地図・検索・詳細の組み立て、安定した検索中の空ピン配列         |
| use-map-navigation.ts    | 地図階層の変更と mapFocus の履歴復元                                   |
| use-map-url-state.ts     | カードの URL と検索状態の履歴、遅らせた書き込み                        |
| use-detail-selection.ts  | 選択と URL の同期、施設・蓋の切り替え                                  |
| use-detail-sheet.ts      | 開閉・たたむ・選択時のリセット、フォーカスの復帰、ドラッグ操作との連携 |
| use-explorer-layout.ts   | ResizeObserver と CSS 変数。高さと safe-area を読んでから書き込む      |
| use-selection-metrics.ts | 見出しへのフォーカスと選択から描画までの計測                           |
| map-detail-sheet.tsx     | 詳細の JSX、Escape の委譲                                              |
| map-notices.tsx          | fixture・URL 指定・データ取得・地図の通知                              |

検索は `domain/card-selection.ts` の data 単位の索引を使う。施設の Map とカードの検索文字列を再利用し、AND 検索を保ち、自治体名の完全一致・前方一致・部分一致・その他の順に並べる。同じ段と空欄検索は入力順（カタログでは県コード・カード番号順）を保ち、一覧検索も同じ並びを使う。データは取得時に丸ごと置き換える前提で、古い data とカードは WeakMap のキーから回収できる。

## 検索用の静的ページ

`build` / `build:fixture` の prepare で `scripts/generate-static-pages.mjs` を呼び、出力先の `data/full.json` から県別 `/pref/{slug}/` とカード別 `/card/{id}/` を生成する。47都道府県は固定のローマ字slugを使い、県に属さないカードがある場合は `/pref/other/` も生成する。本文と共通 SiteHeader はビルド時の React 静的描画で、クライアントJSは不要。一覧の県選択時の見出し付近とサイトマップから県ページへ移動できる。県ページは自治体見出しへの目次を持ち、カードページは同じ自治体のほかのカードへリンクする。地図の全画面・PC詳細と一覧詳細の出典付近からカードページへ移動できる（スマホ要約には表示しない）。地図は県指定クエリを読み取らないため、県ページの地図リンクは先頭カードの既存 `?card=` を使う（県指定 `?pref=` は一覧の機能）。

`sitemap.xml` は `/`・`/cards`・`/about` と生成ページを収録する。lastmod はデータの updated / evaluatedAt の新しい日付で、ビルド日には置き換えない。`robots.txt` はクロール許可とサイトマップのURLを出す。Cloudflare 管理の robots.txt は使っていない。存在しないカードのURLは既存の404配信に任せる。

ページ用CSSは既存トークン・ヘッダーCSSをまとめて内容ハッシュ付きで出力し、Viteの既存フォントCSSを参照する。`sizes --check` の既存予算は地図起動を保守的に制限するJS/CSS用であり、個別に取得される静的HTMLの合算は対象にしない。予算の除外・上限変更は行わず、追加CSSとaboutのリンク用JSも従来の予算内で検査する。生成HTML・サイトマップ・robots.txtはGitへ追加しない。

## 既存ページの検索・共有情報

地図・一覧・about・404・アカウント・規約の6つのHTMLにtitle・description・canonical・OGPを置く（フレンド・招待はtitleとnoindexだけ）。地図の枚数プレースホルダーはViteのabout-data-summaryで公開データの全カード数へ置換する（fixtureはfixtureData）。同じプラグインが一覧の `data-catalog-summary` を県ごとの枚数（`data-catalog-totals`）と基準日（`data-evaluated-at`）へ置き換える（`domain/catalog-summary.ts`）。地図と一覧のHTMLには、ページの `fetch()` と同じURL・同じcredentials（`crossorigin`）の `<link rel="preload" as="fetch">` をViteのcard-data-preloadが入れ、JSの実行を待たずにデータの取得を始める。地図は `pins.json`、一覧は `full.json`。地図の HTML には、Vite の map-chunk-preload が地図の生成までの束（`app`・`map-screen`・`card-map`・MapLibre とその静的 import）の `<link rel="modulepreload">` と、その CSS の `<link rel="preload" as="style">` を入れる。これらは動的 import の連鎖の後ろで見つかるので、HTML の解釈の時点で取得を始める。MapLibre の module worker は Chromium が先読みできない（`as="worker"` を無効として二重に取る）ので入れない。同じく basemap-preconnect が、地図のスタイルとタイルの配信元への `<link rel="preconnect" crossorigin>` を入れる。配信元は `VITE_MAP_STYLE_URL`（未設定なら mapcn の CARTO 明色スタイル）のオリジンで、CARTO ならタイルの `tiles.basemaps.cartocdn.com` も足す。fixture の無地のスタイルはサイト自身のものなので入れない。これらはほかのページには入れない（`check-deploy.mjs` の最初の表示の検査）。canonicalとサイト内リンクは拡張子なしURLにそろえる。旧来の `.html` URL は本番の307リダイレクトで引き続き使える。404・アカウント・規約はnoindex。WebSiteとWebApplicationのJSON-LDはindex.htmlに置く。

OG画像・apple-touch-icon・manifestはpublic/の管理対象で、Viteのseo-assetsが配信先に配置する。画像の再生成はweb/で次を実行する。既存ロゴのパスとローカルのNoto Sans JPを使い、本文への画像・フォント追加は行わない。OG画像の右側は、陸地（`scripts/og-outline.json`。作り方は `tools/map/README.md`）と県境（`src/pref-borders.json`）の上に、生成済みの `public/data/pins.json` の配布場所を状態の色で打ったもの。本州・北海道・四国・九州の範囲だけを描く。データを作ってから実行する。

```sh
mise exec -- node scripts/generate-seo-images.mjs
```

一覧とaboutの本文は引き続きクライアント描画（一覧の全国表示はビルド時の集計で最初の描画から出す）。事前描画を導入するときは、一覧のURL条件・非同期データと初期HTMLを一致させ、renderDocumentの同期描画に依存する画面遷移も確認する。

### 回収の記録

アカウント機能は `VITE_ACCOUNTS_ENABLED=true` でビルドした場合だけ表示する（既定は無効）。
`signed_in=1` の表示用 Cookie がある場合に、地図の初期描画後（地図が失敗した場合は失敗後）に記録を取得する。
一覧でも同じフラグと Cookie を使う。画面を切り替える文書では、`RecordsHost`（`features/records/records-entry.tsx`）がすべての画面の外側に Provider を1つ置き、地図と一覧の `RecordsBoundary` は内容を描いたことを知らせるだけになる。片方で付けた記録はもう片方にすぐ出て、切り替えても取り直さない。Provider は未ログインでもマウントしたままにし、画面を作り直さずにログイン・ログアウトに従う。ログイン状態の変化（アカウントの画面でのログイン・登録・回復・ログアウト・削除、どの画面の 401 も）は `shared/browser/signed-in.ts` の `sessionChanged()`（`forgetSignedIn()` も呼ぶ）が1か所から伝え、記録・フレンドの回収マップ・フレンドとアカウントの画面・ヘッダーの表示（`useSignedIn()`）が Cookie を読み直す。フレンドの画面（一覧、申請、ブロック、招待）とアカウントの設定・回復の後の操作は、記録と同じく `shared/browser/session-guard.ts` を通す（`usePrivateApi`）。送る直前に印を確かめ、替わっていたら送らずに知らせて（`UserChanged`）表示を消して取り直す。画面を離れた後や利用者が替わった後の応答は、成功も失敗（401 を含む）も捨てる（`Dropped`）。表示用 Cookie を消すのは、今も Cookie がその利用者を指しているときの 401 だけ。回復のセッションには表示用 Cookie がないので、回復の手順は画面が開いているかだけで判断する。招待ページは自分の 401 を自分で扱うので、この知らせは受けない。別のタブで利用者が替わったこと（表示用 Cookie `session_mark` の変化）は、私的な API を送る直前（`shared/browser/session-guard.ts`。記録とフレンドの回収マップが共通に使う）、ページへ戻ったとき、画面を切り替える前に確かめ、前の利用者の記録を捨てて取り直す。替わる前に頼んだ要求の結果は、401 を含めて捨てる（[アカウント設計](../docs/account-design.md)）。カードの詳細は、回収済みかどうかと日付を手元の記録から最初の描画で出し、メモだけを `GET /api/me/records/:cardId` で取る（一覧にないカードは未回収としてすぐ出し、別のタブで付けた記録に備えて裏で取る）。一度取った詳細は開き直すとすぐ出して裏で取り直す。メモが 400ms たっても届かないときだけ「記録を読み込み中…」を出し（`shared/ui/delayed.tsx`）、届くまでは「日付・メモを編集」と「未回収に戻す」を受け付けない。取得が届く前に押した「回収した」は画面だけ先に回収済みにし、取得で記録がないと分かってから保存を送る（すでにあれば送らずに届いた記録を出し、失敗なら押す前に戻す。詳細を閉じる・利用者の交代・ログアウトでは送らない）。詳細の取得に失敗したカードには、再読み込みで取得できるまで「回収した」を出さない。記録とメモはメモリだけで扱い、保存の失敗時には操作前の表示へ戻す。日付・メモの保存に失敗したときは、入力した内容を編集欄に残す。
「回収した」と「未回収に戻す」は押した時点で保存する。メモのある記録を未回収に戻すときだけ確認を挟む。「回収した」は詳細の配布状態の横と記録欄の両方にあり、どちらも回収した日を今日（日本時間）にして保存する。配布状態の横で押した直後は、同じ場所に「取り消す」を出す。回収済みのカードでは、配布状態の横のバッジが記録欄へ移動する。未ログインのときは同じ場所に「ログインして記録」を出し、ログイン後に元の画面へ戻す。フレンドの回収マップでは状態の表示だけで、保存はしない。フレンドの回収マップは絞り込みを「回収済み」にして開く。
ログアウトで Cookie を消した場合は、フォーカス復帰・ページ再表示・表示状態の変更時に記録も消す。
本番は `wrangler.jsonc` で D1 を結び付け、配信のビルドでフラグを有効にしている（リポジトリ変数 `VITE_ACCOUNTS_ENABLED`）。プレビューには D1 を結び付けないので `/api/*` は404になる。記録を確かめるには API のある開発環境が必要。

### ログイン・アカウント

入口はヘッダーと、ヘッダー・地図の検索バーにあるメニュー（`src/shared/ui/site-menu.tsx`）にあり、フラグが有効なときだけ「フレンド」と並べて表示する。ヘッダーは幅40em未満でリンクを隠してメニューだけにし、地図の検索バーは幅によらずメニューを置く。メニューは Popover API で開き、未対応のブラウザーではスクリプトで開閉する。`signed_in=1` の有無で「ログイン」と「アカウント」を切り替えるだけで（同じ文書のほかの画面でのログイン・ログアウトにも従う）、未ログインの画面からは API を呼ばない。
`/account` はログイン・新規登録・回復・設定を1ページで切り替え、パスキーのコードはこのページの束にだけ入る。`check-deploy.mjs` は地図・一覧・about・404・規約・フレンド・招待の各ページの最初の表示を辿り、パスキーのコードが入っていないことを確かめる（例外は前述の切り替え用の動的 import）。ログイン後の `returnTo` へは、同じ文書の中で切り替えて戻る（`navigate()`）。フラグ無効のビルドでは、アカウントページは「まだ使えません」の表示だけになる。
回復コードで入った後は、新しいパスキーの登録だけを求める。再読み込みしても sessionStorage の印で同じ手順に戻る。削除・再発行・パスキー削除で API が 403 `reauth_required` を返したら、パスキーで再認証して操作をやり直す。
規約とプライバシーポリシーは `/terms`。アカウント・規約のページは noindex で、sitemap に入れない。

サイト全体の CSP は `deploy/_headers` で強制している。地図の通信先は CARTO の `basemaps.cartocdn.com`（スタイル）と `tiles.basemaps.cartocdn.com`（スプライト・フォント・タイル）で、MapLibre の worker のために `worker-src` と `img-src` に `blob:` を許可している。地図の背景を別の配信元へ替えるときは `connect-src` も直す。

パスキーの流れ（登録→ログアウト→ログイン→回復→パスキー削除→アカウント削除）と各ページの CSP は、`VITE_ACCOUNTS_ENABLED=true bun run build` の後に `node scripts/account.browser-check.mjs` で確かめる。8787番で `wrangler dev --env dev` を起動し、ローカル D1 にマイグレーションを当て、Chromium の仮想認証器を使う。`bun run test:browser` からも続けて実行し、フラグ無効の dist なら理由を出して飛ばす。実機のパスキーは人が確かめる。

## フレンド画面

`VITE_ACCOUNTS_ENABLED=true` でビルドすると、メニュー・ヘッダーの「フレンド」から `/friends` へ進める。招待リンクの発行・作り直し、受け取った申請の承認・削除、フレンドとブロックの一覧を扱う。作り直すと前の招待リンクは無効になる。リンクの平文は発行時だけ API が返すため、再表示はできない。送った申請の一覧や状態は表示しない。画面は上から、受け取った申請（1件以上あるときだけ）、フレンド一覧、招待リンク、ブロック一覧の順に並べる。フレンドが0人のあいだは招待リンクをフレンド一覧の上に置く。フレンドの解除とブロックは、行ごとの「その他」（`details`）を開いて選び、確認ダイアログを経て実行する。

`/friends/invite?openExternalBrowser=1#t=…` は起動時にフラグメントを URL から消して照会する。ログイン・登録に進むときだけトークンを sessionStorage に置く。招待ページの起動時と、bfcache からの復帰を含む pageshow・フォーカス復帰・再表示時に保存値を読み出してすぐ消し、そのページのメモリだけに持つ。再ログインへ進むときだけ保存し直し、ログアウト時にも保存値を消す。復帰時に Cookie を読み直して別タブのログインを表示へ反映し、ログイン中から未ログインに変わっていたらメモリと保存値のトークンを捨てる。その場合は招待リンクをもう一度開くように案内する。アカウント画面の `returnTo` は `/` で始まるパスを URL として正規化し、同一オリジンであることを確かめる。正規化後の pathname が `//` で始まる場合、バックスラッシュやエンコードしたパスの区切りを含む場合、入力に制御文字がある場合は拒否し、検証済みの pathname・search・hash を返す。登録時は回復コードを控える手順を終えてから戻る。フレンドと招待の HTML は noindex で、sitemap に含めず、地図とパスキーのコードを読み込まない。

`/?friend=<利用者ID>` は保持している地図にフレンドの記録だけを重ねる（`pages/map/map-page.tsx` の `FriendLayer` が記録の context だけを替え、地図の祖先の構造は自分の地図と同じ。取得は `features/friends/friend-map.tsx`）。地図を表示するたびに取り直し、隠したら捨てるので、解除・ブロック後や利用者の交代後に前の記録を出さない。名前・戻るリンクを表示し、詳細の日付は閲覧専用にする。自分の記録は取得しない。フレンド以外・解除後・ブロック後などの 404 は「表示できません」と表示する。初期の API 取得は地図の初期化完了か失敗の後に行い、失敗しても公開カードの地図・検索・詳細は使える。未ログインでは私的な API を呼ばず、フラグが無効ならフレンド画面へのリンクも出さない。

型検査はアプリ・worker に `exactOptionalPropertyTypes` を適用する。生成された mapcn とその `cn` 補助だけは `tsconfig.mapcn.json` の参照プロジェクトで従来の設定で検査し、`.cache/mapcn/` に型宣言を生成する。`bun run typecheck` が宣言の更新と本体の検査を順に実行する。import される生成コードは `exclude` だけでは検査対象から外れないため、プロジェクト参照で分けている。

### ローカルの文書URL

Vite の開発サーバーと `bun run preview`（`scripts/serve.mjs`）は、`/cards`・`/about`・`/account`・`/terms`・`/friends`・`/friends/invite` に対応する HTML を直接返す。Vite は標準の HTML パス補完を使う。クエリとハッシュはブラウザー側に保持する。

ローカルでは `.html` URL も転送せず200で返す。本番の Workers Static Assets は `.html` から拡張子なしへ307で転送する。一覧はどちらから開いても状態を読み、以後の履歴更新には `/cards` を使う。存在しないURLは、Vite では既定の SPA フォールバック、`serve.mjs` では簡易404となる。本番のカスタム404とHTML正規化は Worker テストで確かめる。
