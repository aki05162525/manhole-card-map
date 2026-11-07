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

| 規則 | 理由 |
| --- | --- |
| react/react-in-jsx-scope | react-jsx の自動ランタイムを使うため。 |
| react/set-state-in-effect | 既存の副作用と状態同期の再設計は今回の検査基盤の範囲外。 |
| react/immutability | 既存の地図・DOM の可変参照の扱いを保ち、別途検討するため。 |
| react/refs | 既存の ref を介した地図・シート制御を保ち、別途検討するため。 |
| jsx-a11y/prefer-tag-over-role | 既存のカスタム UI の要素選択は今回変更しないため。 |
| import/no-unassigned-import | CSS・フォントの副作用 import が必要なため。 |

次の一時例外は設定の overrides で各ファイルだけに限定する。いずれも **#136 PR4 で解消**する。

| ファイル | 規則 | 理由 |
| --- | --- | --- |
| src/pages/map/use-map-url-state.test.ts | react-hooks/rules-of-hooks | 既存のテスト用 render 関数が Hook を直接呼ぶ。 |
| src/pages/map/use-sheet-drag.ts | react-hooks/exhaustive-deps | ドラッグ中の購読を維持する既存 effect を PR4 で分離する。 |
| src/pages/map/app.tsx | jsx-a11y/no-noninteractive-element-interactions | 詳細 section からの Escape イベント委譲を PR4 で見直す。 |

生成ファイル src/components/ui/map.tsx の unicorn/no-useless-fallback-in-spread の既存例外も保持する。生成元の書き方を維持するため。

Stylelint（`bun run lint:css`）は src/**/*.css とルート HTML の style を検査する。正しさの規則だけを使い、整形は Oxfmt に任せる。Tailwind 固有の at-rule は現行 CSS にある theme・apply だけを許可する。コミットフックは変更された CSS・HTML を検査し、Stylelint 設定や依存の変更では全体を検査する。

Knip（`bun run knip`）は CI で全体を検査する。3つの HTML とそこから参照する main.ts・cards-main.tsx・about-main.tsx、Vite/Vitest 設定（組み込みプラグインが検出）、scripts/*.mjs、テストを入口にする。生成 mapcn の src/components/ui/map.tsx と src/lib/utils.ts は未使用 export・型の検査から除外し、ファイルや依存の検査は残す。wrangler は .github/workflows/deploy.yml・preview.yml と tools/ci/publish_inputs.py から呼ばれるため、未使用依存の誤検出から除外する。lefthook もリポジトリ直下の lefthook.yml から `web/node_modules/.bin/lefthook` として呼ばれる。CI は lefthook.yml を取得しないため Knip から使い道が見えず、同様に除外する。

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
bun run test:browser
```

ブラウザー検査は独立したループバックサーバーを起動・終了する。一覧のnull・終了カードなどの描画検査には `public/data/full.json` を使うため、先に次節の実データ生成も行う。検査対象は `scripts/browser-check.mjs` と `scripts/cards-page.browser-check.mjs` を参照。

## 実データで動かす

Git管理された保存入力だけから生成する。公開用4ファイルは `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。監査は内部 full.json を読む。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。スクリプトは配布情報の変更の失効判定に使う現一覧 `data/evidence/national/list-source/gkp-20261105.html` を `-review-list` で渡し、基準日を `2026-11-06` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイル。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。背景地図の利用条件は公開前に確認する。

`go run ./cmd/builddata -reference-places` は参考位置を使う検証用で、公開用の確定状態に変換しない。採用範囲は [全国統合手順](../docs/national-assembly.md)を参照。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

実データの操作確認はローカルサーバー起動後に `node scripts/real-data-browser-check.mjs` で実行する。

`?data=split` はピンと詳細を分割取得するが、全詳細をメモリに保持する。地図の裸の `/` は全国表示で始まり、`?benchmark` に特別な範囲復元の挙動はない。`/?card=…` は詳細を復元し、配布施設ピンがあれば対象へ移動する。`/cards.html` は地図を読み込まない独立した一覧で、県・検索・ページ・詳細をQueryに保持する。

## CI と性能検証

CI の実行内容と差分判定は [.github/workflows/ci.yml](../.github/workflows/ci.yml) と [tools/ci/changes.py](../tools/ci/changes.py) を参照。ブラウザー検査はCIで実行しない。画面操作は人間が確認し、必要ならローカルで手動実行する。

性能は起動・詳細応答・移動を分けて評価し、fixtureの無地背景やPCの模擬計測をスマホ性能の合格としない。測定結果はPR・CIへ記録する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

地図の検索バーから全画面検索を開く。入力前は案内を表示し、全国の結果を50件ずつ追加できる。検索と詳細は排他で、語・表示件数・スクロール・選択行を履歴に保存する。結果の選択で `?card=…` の詳細を開き、バーまたはブラウザー戻るで結果へ戻る。検索由来の詳細を×などで閉じると、語を残して地図へ戻る。スマホの詳細は下端のシート（上限50dvh、本文スクロール）で、地図のタップ・ズームか下スワイプで見出しだけにたたむ。横移動ではたたまない。たたんだシートはタップか上スワイプで開き、×か下スワイプで閉じる。PCは右、短い横画面は左の配置を保つ。シート表示中も現在地と出典表示はシート上に見えるようにする。

## ソースの配置

```text
src/
  main.ts / cards-main.tsx / about-main.tsx
  pages/map/       地図ページ、検索、URL状態、シート操作、ページCSS
  pages/cards/     一覧ページ、履歴・フォーカス操作、結果描画、CSS
  pages/about/     aboutページ、クレジット、CSS
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

fixtureビルド後も、配信前検査と同じ一覧ページの依存検査を実行する。

```sh
node --input-type=module -e 'import { checkCatalogDependencies } from "./scripts/check-deploy.mjs"; await checkCatalogDependencies("dist-fixture"); console.log("Catalog dependencies: OK");'
```

これはHTMLから共有・動的チャンクをたどり、一覧に地図コードが入っていないことを検査する。fixture全体は `checkDeploy` によって引き続き配信禁止になる。本番用の配信前検査は `node scripts/check-deploy.mjs`。

依存方向は `.oxlintrc.json` のディレクトリ別 overrides と `no-restricted-imports` の patterns で検査する。型だけのimportにも適用する。

- pages は features / domain / shared を使い、他のページをimportしない。
- features は domain / shared を使い、他の機能やページをimportしない。
- domain は React・MapLibre・上位層をimportしない。生成された都道府県マスターの参照は許可する。DOM・fetch・history などのブラウザーグローバルも `no-restricted-globals` で禁止する。
- shared は pages / features をimportしない。
- pages/cards・pages/about・features/card-detail・features/card-data は features/map・生成mapcn・MapLibreをimportしない。間接的な地図依存は前述の配信前検査で確認する。

カードの検索・ピン選択・複数カードの選択は `domain/card-selection.ts`、Google Maps へのリンクとURLの検査は `domain/map-links.ts`、地図だけが使う履歴の読み取り `focusFromHistory` は `features/map/map-history.ts` に置く。Adapterと色は `features/map/types.ts`、表示ラベルは `shared/ui/labels.ts`、描画待ちは `shared/browser/painted.ts` に置く。`import/no-cycle` と `import/no-duplicates` は移動後も継続する。
