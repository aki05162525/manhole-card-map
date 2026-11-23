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

ブラウザー検査は独立したループバックサーバーを起動・終了する。一覧のnull・終了カードなどの描画検査には `public/data/full.json` を使うため、先に次節の実データ生成も行う。検査対象は `scripts/browser/browser-check.mjs`・`scripts/browser/cards-page.browser-check.mjs`・`scripts/browser/account.browser-check.mjs` を参照。アカウント検査は `dist/assets` が必要で、アカウントを有効にしたビルドでのみ実行する。

## 実データで動かす

Git管理された保存入力だけから生成する。公開用の `full.json` と `manifest.json` は `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。スクリプトは台帳の行ファイル `data/db/` から `tools/db/ledgerdb.py export-ledger` で書き出した台帳を `-places` で渡す（[台帳データベースの設計](../docs/database-design.md)）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。配布情報の変更の失効判定に使う現一覧 `data/raw/gkp-list-20261105.html` を `-review-list` で渡し、基準日を `2026-11-19` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイルをソースに、OS の配色設定に合わせてアプリが再配色する。地図ソースは切り替えず、OS 設定の変更時もカメラ・選択・読み込んだデータを保って paint とピン画像を更新する。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。本番は、本番のホストだけを許可した CARTO のキーを含む `VITE_MAP_STYLE_URL` でビルドする（[デプロイ手順](../docs/deployment.md#prプレビュー)）。

採用範囲は [台帳データベースの設計](../docs/database-design.md)を参照。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

自治体が許諾したカード画像は、カード詳細（`features/card-detail/card-image.tsx`）と、そのカードのカードページ（`src/pages/card/static-pages.tsx`）に1枚ずつ出す。カードページでは全体をそのままクレジットと一緒にHTMLへ書き、読み込めなかったときだけ小さなスクリプト（`src/card-image-main.ts`）が画像と枠を消す。詳細の先頭（スマホの要約では自治体名の左）にクレジットと一緒に置き、押すと画面いっぱいに同じ画像を出す。配置と開閉の決まりは [mapcn設計](../docs/mapcn-design.md#詳細の道順と窓口)。公開データの `cards[].image` が指す `/card-images/*` を Worker が KV から返す。KV のないローカルや fixture では 404 になり、詳細は画像と枠を消す。追加の手順は [カード画像の追加](../docs/data-maintenance.md#カード画像の追加)、配信は [デプロイ手順](../docs/deployment.md#カード画像)。

実データの操作確認はローカルサーバー起動後に `node scripts/browser/real-data-browser-check.mjs` で実行する。

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
  node scripts/deploy/wrangler-config.mjs preview wrangler.preview.json
  bun run wrangler dev --config wrangler.preview.json
  ```

- 緊急停止の確認は `bun run wrangler dev --env dev --var API_DISABLED:1`。`/api/*` は 503 になる。

マイグレーションは `migrations/`（本体）と `migrations-tombstones/`（復元後に削除を再適用するための別 DB）に置く。足すときは追加だけの変更にする。

## CI と性能検証

CI の実行内容と差分判定は [.github/workflows/ci.yml](../.github/workflows/ci.yml) と [tools/ci/changes.py](../tools/ci/changes.py) を参照。ブラウザー検査はCIで実行しない。画面操作は人間が確認し、必要ならローカルで手動実行する。

lint・型検査・ビルド・テストは独立したジョブで走る。PR のテストの分割と関連テストの選び方（全件実行に戻す条件を含む）は `ci.yml` と `changes.py` が決める。必須チェック `frontend` は選択された全ジョブの成功をまとめる。main と手動実行、ローカルの `bun run test` は全件実行する。CI の `build:fixture:ci` は型検査を別ジョブへ任せ、通常の `build` と `build:fixture` は型検査を含む。

性能は起動・詳細応答・移動を分けて評価し、fixtureの無地背景やPCの模擬計測をスマホ性能の合格としない。測定結果はPR・CIへ記録する。

通常表示では地図の診断 API や操作サンプルを公開・収集しない。地図の検査・計測スクリプトは Playwright の初期化時に `window.enableMapDiagnostics = true` を指定し、同じビルドで `window.mapDiagnostics` を利用する。

実地図の計測は、稼働中の専用サーバーに対して `REAL_DATA_ORIGIN=http://127.0.0.1:4173 mise exec -- node scripts/perf/map-performance.mjs <label>`、集計は `mise exec -- node scripts/perf/summarize-map-performance.mjs <label>`。計測条件とマークはスクリプトを参照し、実行中にほかのビルド・ブラウザー試験を重ねない。workerの通信記録が欠けても0バイトとみなさず、TBTを実利用者のINPと混同しない。

サイズ予算は `bun run sizes --fixture --check` がCIで検査する（対象と値は `scripts/perf/size-budgets.mjs`）。Viteの500KB警告とは別の検査で、警告の閾値を変えて解消扱いにしない。実データを生成した本番ビルドでは `bun run sizes --check` でHTML・フォント・データも集計できる。`mise exec -- node scripts/browser/worker-cache.browser-check.mjs` は実データの `dist` を一時ポートで配信し、再読込時のworker再取得の有無と、オフライン中の検索・詳細を検査して終了する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

## ミューテーションテスト

[mutator](https://github.com/mizchi/mutator)（`@mizchi/mutator`）は、コードを1か所ずつ変えた mutant をテストが検出するかを調べる。テストの品質を測り、消しても観測できない（要らない）コードと、足りないテストを探すリファクタリングの道具として使う。CI では走らせない。

```sh
bun run mutate                                   # 対象の全件。関数とテストが同じなら結果を再利用する
bun run mutate --since origin/main               # 分岐点からの差分だけ
bun run mutate --include 'src/domain/**/*.ts'    # 範囲を絞る（設定の include を置き換える）
mkdir -p .mutator
bun run mutate --include 'src/features/map/map-history.ts' --kill-matrix --time-budget 1200 --reporter json --reporter agent > .mutator/agent.json
bun run mutate --reporter simplify > .mutator/simplify.txt                         # 消しても検出されないコード
```

- 実装担当がレビュー依頼前に `git fetch origin main` を実行し、`web/` で `bun run mutate --since origin/main` を測る。PR には対象、検出数と母数、生き残った mutant への対応を書く。未測定（Pending）があれば範囲と件数も書く。
- テストだけの差分では通常の `--since` で対象が0件になることがある。テストを整理するときは、先に main の対象ソースを `--include` で指定して kill-matrix を取り、整理後も同じ指定で測る。重複・包含の候補は、どの入力と結果を保証しているかを読んで判断する。前後の対象 mutant と検出結果を比較し、検出できなくなったものは理由を調べる。
- 対象と除外は `mutator.config.ts` にある。IO のない速いテストで検査できるコードに絞っている。
- テストは `vitest.mutator.config.ts` で走る。`vitest.config.ts` の projects のうち、ソースを同じプロセスで動かすテスト（`src/**/*.test.ts`・dom のテスト・`worker/card-ids.test.ts`・`worker/rows.test.ts`）だけを集める。`scripts/` のテストはサーバーや子プロセスを起動し、ほかの Worker のテストは workerd を起動するので、mutant を観測できない。Worker の残りのファイルは workerd のテストでしか検査されず、1回の実行に15分を超える（予算の15分で733件中35件が残った）ので対象から外した。
- 結果とキャッシュは `.mutator/`（Git 管理外）に出る。`agent`・`text`・`simplify` は標準出力へ出る。`agent` は `text`・`simplify` と分け、ファイルに出る `json` とは同時に使える。`json` の `mutation.json` は `.mutator/report/` に出る。
- 全件の `--kill-matrix` は、8並列で90分を超える（2026-11-19、`--time-budget 5400` で7504件中102件が残った）。範囲を `--include` か `--since` で絞り、`--time-budget` で区切る。結果は関数と、それを実行するテストが変わらない限り再利用される。実行中に設定・テスト・lockfile を書き換えると、その回の結果が次に再利用されない。
- 生き残った mutant は、コードを消す・テストを足す・等価として `bun run mutate accept <key> --reason "…"` で受け入れる（`mutator.accepted.json` をコミットする）のどれかに決める。手順は `mutation-test-loop` スキル、設定と報告の読み方は `mutator` スキルにある。
- accept は、公開されている関数・コンポーネントの結果（返り値、投げる例外とその message、書き込む state・履歴、登録するリスナー、消す資源）で区別できないときだけにする。今の呼び出し元や画面で区別できないだけなら、理由に「限定付き」とその条件を書く。#383 の整理では、担当が等価とした accept のうち10件に、独立レビューが反例を作った。多かったのは、state に書き戻される値、取り消した予約の再登録の順序、読むたびに増えるリスナー、外部の同名の資源を消す後片付け、空文字と `??`、持ち主のいない値の照合。accept を含む PR のレビューでは、理由を信じず反例を試させる。
- mutant を製品コードへ手で書き込んで試したら、終わる前に必ず戻し、`rg -n 'Stryker' src worker` が空であることを確かめる（担当が途中で止まり、書き込みが残ったことがある）。

## ソースの配置

画面の組み立ては `src/app/`、画面は `src/pages/`、機能は `src/features/`、画面の共通補助は `src/shared/`、ログイン状態と私的 API の関門は `src/session/`、純粋関数は `src/domain/`（ビルドと画面で使う about の集計は `src/domain/about-summary.ts`）、画面と Worker が共有する純粋なコードは `src/contract/`。取り込める層と package の規則は `scripts/lint/oxlint-layers.mjs`、globals と履歴の禁止は `.oxlintrc.json`、配信境界の検査は `scripts/deploy/check-deploy.mjs` が持つ。

### 画面の切り替え

`src/app/` が地図・一覧・フレンド・アカウント・aboutを同じ文書で切り替える。地図と一覧を保持し、それ以外は離れたらアンマウントする。切り替えに失敗したら文書遷移へ戻す。

私的な応答・認証処理・隠した画面の副作用は [ハーネス](../docs/harness.md#同じ文書で切り替える画面)、認可・保存境界は [アカウント設計](../docs/account-design.md) に従う。履歴操作は `src/shared/browser/app-history.ts`、画面ごとのCSSは `src/app/app.css` と各ページのCSSを参照。

## 検索用の静的ページ

ビルド時に `scripts/build/generate-static-pages.mjs` がカードのHTML、サイトマップ、robots.txt、旧県URL用の `_redirects` を生成する。旧URL（例 `/pref/hokkaido/`）は同じ県を選択した一覧（`/cards?pref=01`）へ301転送する。生成物はGitへ追加しない。ページごとの最終更新日を記録していないため、サイトマップでは `lastmod` を省略する。アカウント・フレンド・招待は検索索引へ出さない。

一覧のカードはカードページ（`/card/{番号}/`）へ移る。以前の `/cards?card=番号` も、番号を確かめてから同じページへ置き換える。カードページの本文はビルド時のHTMLのままで、`VITE_ACCOUNTS_ENABLED` が `true` のビルドでだけ、入手の記録欄（`src/card-record-main.tsx`、未ログインならログインへのリンク）が付く。生成処理は、ビルドが出した `assets/cardRecord-*.js` と、画像のあるカードでは `assets/cardImage-*.js` をカードページから参照する。カードページのCSSは、規約ページ（`terms.html`）が読むスタイルシート（フォント・トークン・ヘッダー・メニュー・本文）をそのまま使い、生成ページだけの規則（`src/pages/card/generated-pages.css`）を1ファイル足す。

OG画像の再生成は実データ生成後にweb/で実行する。陸地の生成は [地図生成](../tools/map/README.md#共有画像の陸地) を参照。

```sh
mise exec -- bun scripts/build/generate-seo-images.mjs
```

## アカウントとフレンド

`VITE_ACCOUNTS_ENABLED=true` でビルドしたときだけ有効。プレビューにはD1がなく `/api/*` は404になるため、操作確認はAPIのあるローカル環境で行う。認証・記録・招待・公開範囲は [アカウント設計](../docs/account-design.md)、本番の停止・復元は [配信手順](../docs/deployment.md#api-と-d1) を参照。

パスキーの処理は `src/pages/account/` にある。仮想認証器による確認は `scripts/browser/account.browser-check.mjs`（`test:browser`からも実行）。アカウント有効のビルドが必要で、実機のパスキーは人が確かめる。

背景地図の配信元を変更したら `deploy/_headers` のCSPも確認する。`VITE_` の値は公開される。
