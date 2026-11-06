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
bun run format:check
bun run typecheck
bun run test
```

mise をシェルで有効化していない場合は `mise exec --` を付ける。Bun は依存管理とスクリプト起動、Node.js は Vite / Vitest / 検証スクリプトに使う。依存は `bun.lock`、ツールはルートの `mise.toml` に固定する。APM は別途 [開発スキルの手順](../docs/development-agents.md)で導入する。

lefthook の pre-commit はステージ済みの変更から対象を選ぶ。lint・format は変更ファイルのみ、型検査はフロントエンドのコード変更時、Go テストは Go・台帳・全国統合処理の変更時に実行する。型検査と Go テストは依存先の破損も検出するため全体を対象とし、設定・依存の変更時は lint・format も全体へ戻す。削除・移動元も判定する。文書だけの変更ではこれらを実行しない。検査対象の内容は作業ツリーなので、部分ステージ時の未ステージ変更は含まれる。pre-push の Vitest は廃止し、PR の CI で実行する。整形は `bun run format`。mapcn 生成ファイルだけ Oxlint の冗長な spread の規則を無効にし、その他の検査は適用する。新機能は失敗するテストを書いてから実装し、成功を確認する。

## 合成データで動かす

実データなしで再現できる。架空カード5枚と通信不要の検査用スタイルを生成する。

```sh
bun run build:fixture
SERVE_DIR=dist-fixture PORT=4179 bun run preview
```

`http://127.0.0.1:4179/` を開く。背景は検査用の無地で、実際の道路地図ではない。共有施設・複数配布先・位置未確定を含む。`FIXTURE_ONLY.txt` と画面上の警告で識別し、実在する訪問先として使わない。

```sh
bunx --no-install playwright install chromium
bun run test:browser
```

ブラウザー検査は独立したループバックサーバーを起動・終了する。外部地図サービスを使わず、地図のクリック、リンク、全国→地方→都道府県の移動、キーボード、位置情報、全国からの起動、地図サイズ、障害時の一覧を検査する。

## 実データで動かす

Git管理された保存入力だけから生成する。公開用4ファイルは `web/public/data/`、根拠・入力一覧を含む完全なデータと quality は Git 管理外の `data/work/internal-data/` に出力する。監査は内部 full.json を読む。ルートで次を実行する（mise未有効時は `mise exec --` を付ける）。基礎の一覧原本は `-list` の既定値 `data/raw/gkp-list-20261021.html` を使う。スクリプトは配布情報の変更の失効判定に使う現一覧 `data/evidence/national/list-source/gkp-20261105.html` を `-review-list` で渡し、基準日を `2026-11-06` に固定している。根拠を確認したうえで更新する。入力欠損・照合hash不一致は失敗となり、ネットワーク取得やfixtureへの置換は行わない。

```sh
python3 -B tools/build-real-data.py
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が新しい標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイル。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。配信先は Cloudflare Workers Static Assets。背景地図の利用条件は公開前に確認する。

MapLibre Worker と shared モジュールはインストールした版から同一オリジンへ配信する。unpkg に依存しない。mapcn の取得元、変更点、MIT ライセンスは [MAPCN_PROVENANCE.md](MAPCN_PROVENANCE.md) を参照。

位置未確定の配布場所は通常ピンにしない。`go run ./cmd/builddata -reference-places` は参考位置を使う検証用。公開用の確定状態に変換しない。標準画面は確認済みの配布場所のみを初期表示する。「蓋の位置も表示」で蓋を追加し、カード詳細の「このカードの蓋を見る」で個別の蓋へ進む。参考ピンは標準画面には出さない。検索は都道府県・自治体・カード番号・施設名・住所を対象にする。全国一覧との照合と地域別調査を反映しているが、未確定の配布条件・施設位置は残る。[全国統合手順](../docs/national-assembly.md)の採用範囲を確認する。静的JSONは時間経過だけで再評価されないため、新しい根拠を確認してからスクリプトの基準日を更新し再生成する。

実データの操作確認はローカルサーバー起動後に `node scripts/real-data-browser-check.mjs` で実行する。

`?data=split` はピンと詳細を分割取得するが、全詳細をメモリに保持する。`?benchmark` は保存範囲を復元しない。

## CI と性能検証

GitHub Actions は PR、main への push、手動実行で起動する。作業ブランチの push と PR で二重実行しない。PR は base とマージ結果の差分、main の push は前回 SHA との差分で対象を選ぶ。削除・移動元を含め、比較元を取得できない場合・未知のファイル・CI 共通設定の変更・手動実行は全検査へ戻す。

- `web/` の変更：lint、format、Vitest、fixture ビルド内の型検査。ブラウザー操作の検査はCIでは実行しない。
- Go・`data/`・`tools/national/` の変更：`go test -count=1 ./...`。`TestNationalAssemblyFailureGuards` が Python の全 unittest も実行するため、CI 内で別途重複実行しない。コンパイルキャッシュは利用し、テスト結果キャッシュは使わない。
- APM 入力・除外設定の変更：別ワークフローで frozen install・監査・ロックファイル不変を1回確認する。
- 文書だけの変更：差分判定とフックのテストのみ。既存の `checks` と `reproducibility` の結果は引き続き返す。

フロントエンドとバックエンドは必要な場合に並列実行し、Bun のダウンロードキャッシュと Go のモジュール・コンパイルキャッシュを再利用する。CI の `checks` は対象ジョブの失敗・キャンセルを失敗として集約する。外部デプロイは独立した Deploy ワークフローで扱う。差分判定・フックの回帰テストはルートで `python3 -B -m unittest discover -s tools/ci -v` と `python3 -B -m unittest discover -s tools/dev -v`。

速度は起動・詳細応答・移動時のフレーム間隔を分けて評価する。`CHROME` で Chrome の実行ファイルを指定できる。fixture の無地背景の速度は実地図の評価に使わず、PC の模擬計測だけでスマホ性能の合格とはしない。測定結果はPR・CIへ記録する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md) を参照。

CIではChromiumの導入、ブラウザー検査、画像・fixture成果物のアップロードを行わない。画面操作は人間が確認し、必要なら既存のブラウザー検査スクリプトをローカルで手動実行する。
