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

mise をシェルで有効化していない場合は `mise exec --` を付ける。Bun は依存管理・スクリプト起動・型検査、Node.js は Vite / Vitest / 検証スクリプトに使う。`typecheck` は `bun check -b` で mapcn の参照プロジェクトも検査する。依存は `bun.lock`、ツールはルートの `mise.toml` に固定する。APM は別途 [開発スキルの手順](../docs/development-agents.md)で導入する。

コミット前の検査対象と部分ステージ時の扱いは [check_staged.py](../tools/dev/check_staged.py) を参照。部分ステージでも検査は作業ツリーに対して行う。整形は `bun run format`。`hooks:install` は共通hooksディレクトリのうち、設定にないLefthook生成フックだけを削除してインストールする。

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

Git管理された保存入力だけから生成する。公開用4ファイルは `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。スクリプトは台帳の行ファイル `data/db/` から `tools/db/ledgerdb.py export-ledger` で書き出した台帳を `-places` で渡す（[台帳データベースの設計](../docs/database-design.md)）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。配布情報の変更の失効判定に使う現一覧 `data/raw/gkp-list-20261105.html` を `-review-list` で渡し、基準日を `2026-11-17` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイルをソースに、OS の配色設定に合わせてアプリが再配色する。地図ソースは切り替えず、OS 設定の変更時もカメラ・選択・読み込んだデータを保って paint とピン画像を更新する。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。本番は、本番のホストだけを許可した CARTO のキーを含む `VITE_MAP_STYLE_URL` でビルドする（[デプロイ手順](../docs/deployment.md#prプレビュー)）。

採用範囲は [台帳データベースの設計](../docs/database-design.md)を参照。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

自治体が許諾したカード画像は、カード詳細（`features/card-detail/card-image.tsx`）と、そのカードのカードページ（`src/pages/card/static-pages.tsx`）に1枚ずつ出す。カードページでは全体をそのままクレジットと一緒にHTMLへ書き、読み込めなかったときだけ小さなスクリプト（`src/card-image-main.ts`）が画像と枠を消す。詳細の先頭（スマホの要約では自治体名の左）にクレジットと一緒に置き、押すと画面いっぱいに同じ画像を出す。配置と開閉の決まりは [mapcn設計](../docs/mapcn-design.md#詳細の道順と窓口)。公開データの `cards[].image` が指す `/card-images/*` を Worker が KV から返す。KV のないローカルや fixture では 404 になり、詳細は画像と枠を消す。追加の手順は [カード画像の追加](../docs/data-maintenance.md#カード画像の追加)、配信は [デプロイ手順](../docs/deployment.md#カード画像)。

実データの操作確認はローカルサーバー起動後に `node scripts/real-data-browser-check.mjs` で実行する。

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

lint・型検査・ビルド・テストは独立したジョブで走る。CI の `build:fixture:ci` は型検査を別ジョブへ任せ、通常の `build` と `build:fixture` は型検査を含む。必須チェック `frontend` は選択された全ジョブの成功をまとめる。

PR のテストは3分割する。main の全件実行で保存した Vitest の所要時間を全 shard が同じキャッシュから読み、長いファイルから実行時間が均等になるよう割り振る。記録のないファイルは既知の時間の中央値、キャッシュがない初回は同じ重みで割り振る。PR で通常の `src` の TS/TSX だけが追加・変更されたときは、Vitest が import をたどって関連テストを選ぶ。scripts の検査と、ファイル読み取り・非リテラル import を使う画面のテストは追加で実行する。Worker は画面に依存せず、共有する `src/contract` の変更は全件実行に戻すため、無関係な画面変更では起動しない。削除・設定・データ・Worker の変更、比較履歴が取得できない場合も全件へ戻す。main と手動実行では、選択されたスイートを常に全件実行する。ローカルの `bun run test` も全件実行のまま。

性能は起動・詳細応答・移動を分けて評価し、fixtureの無地背景やPCの模擬計測をスマホ性能の合格としない。測定結果はPR・CIへ記録する。

実地図の計測は、稼働中の専用サーバーに対して `REAL_DATA_ORIGIN=http://127.0.0.1:4173 mise exec -- node scripts/map-performance.mjs <label>`、集計は `mise exec -- node scripts/summarize-map-performance.mjs <label>`。計測条件とマークはスクリプトを参照し、実行中にほかのビルド・ブラウザー試験を重ねない。workerの通信記録が欠けても0バイトとみなさず、TBTを実利用者のINPと混同しない。

`bun run sizes --fixture --check` がCIで全ページJS合計・MapLibre・全CSS・workerのBrotli予算を検査する。共有・動的チャンクを含む全ページ合計を、初期JS/CSSの保守的な上限にする。実データを生成した本番ビルドでは `bun run sizes --check` でHTML・フォント・データも集計できる。全国データと外部タイルのサイズはfixtureのCI予算の対象に含めない。予算は `scripts/size-budgets.mjs` で管理し、Viteの500KB警告とは別に検査する。MapLibreのmodule workerは `?worker&url` で内容ハッシュ付きの配信資産にし、既存の `/assets/*` のimmutableキャッシュを使う。`mise exec -- node scripts/worker-cache.browser-check.mjs` は実データの `dist` を一時ポートで配信し、再読込時のworker再取得の有無と、オフライン中の検索・詳細を検査して終了する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

## ソースの配置

画面の組み立ては `src/app/`、画面は `src/pages/`、機能は `src/features/`、純粋関数は `src/domain/`（ビルドと画面で使う about の集計は `src/domain/about-summary.ts`）、画面の共通補助は `src/shared/`、画面と Worker が共有する純粋なコードは `src/contract/`。どの層がどの層と npm package を取り込めるか（層の表と例外の一覧、一覧・about から地図のコードを離す規則）は `scripts/oxlint-layers.mjs`、globals と履歴の禁止は `.oxlintrc.json`、配信境界の検査は `scripts/check-deploy.mjs` を参照。

### 画面の切り替え

`src/app/` が地図・一覧・フレンド・アカウント・aboutを同じ文書で切り替える。地図と一覧を保持し、それ以外は離れたらアンマウントする。切り替えに失敗したら文書遷移へ戻す。

私的な応答・認証処理・隠した画面の副作用は [ハーネス](../docs/harness.md#同じ文書で切り替える画面)、認可・保存境界は [アカウント設計](../docs/account-design.md) に従う。履歴操作は `src/shared/browser/app-history.ts`、画面ごとのCSSは `src/app/app.css` と各ページのCSSを参照。

## 検索用の静的ページ

ビルド時に `scripts/generate-static-pages.mjs` が県・カードのHTML、サイトマップ、robots.txtを生成する。生成物はGitへ追加しない。サイトマップの更新日（`lastmod`）は全URLで同じで、データの `updated` と `evaluatedAt` のうち日付として読める新しい方を使う。ビルド日で新しく見せない。アカウント・フレンド・招待は検索索引へ出さない。

一覧のカードはカードページ（`/card/{番号}/`）へ移る。以前の `/cards?card=番号` も、番号を確かめてから同じページへ置き換える。カードページの本文はビルド時のHTMLのままで、`VITE_ACCOUNTS_ENABLED` が `true` のビルドでだけ、入手の記録欄（`src/card-record-main.tsx`、未ログインならログインへのリンク）が付く。生成処理は、ビルドが出した `assets/cardRecord-*.js` と、画像のあるカードでは `assets/cardImage-*.js` をカードページから参照する。県・カードページのCSSは、規約ページ（`terms.html`）が読むスタイルシート（フォント・トークン・ヘッダー・メニュー・本文）をそのまま使い、生成ページだけの規則（`src/pages/card/generated-pages.css`）を1ファイル足す。

OG画像の再生成は実データ生成後にweb/で実行する。陸地の生成は [地図生成](../tools/map/README.md#共有画像の陸地) を参照。

```sh
mise exec -- bun scripts/generate-seo-images.mjs
```

## アカウントとフレンド

`VITE_ACCOUNTS_ENABLED=true` でビルドしたときだけ有効。プレビューにはD1がなく `/api/*` は404になるため、操作確認はAPIのあるローカル環境で行う。認証・記録・招待・公開範囲は [アカウント設計](../docs/account-design.md)、本番の停止・復元は [配信手順](../docs/deployment.md#api-と-d1) を参照。

パスキーの仮想認証器による確認は `scripts/account.browser-check.mjs`（`test:browser`からも実行）。アカウント有効のビルドが必要で、実機のパスキーは人が確かめる。

背景地図の配信元を変更したら `deploy/_headers` のCSPも確認する。`VITE_` の値は公開される。
