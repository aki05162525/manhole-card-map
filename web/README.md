# マンホールカードの地図

標準画面は Vite + React + mapcn / MapLibre。配布場所を主に表示し、カードを受け取ってから対応する蓋へ向かう。詳細から Google マップへ渡す。外部公開は行わず、ローカル検証と CI 成果物保存までを対象にする。

[配布場所の設計・整備手順](../docs/distribution-design.md)・[採用理由と設計](../docs/mapcn-design.md)・[検証結果](../docs/verification/08-mapcn.md)・[APM と公式スキル](../docs/development-agents.md)を参照。

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

lefthook の pre-commit は lint・format・型検査・Go テスト、pre-push は Vitest。整形は `bun run format`。mapcn 生成ファイルだけ Oxlint の冗長な spread の規則を無効にし、その他の検査は適用する。新機能は失敗するテストを書いてから実装し、成功を確認する。

## 合成データで動かす

実データなしで再現できる。架空カード5枚と通信不要の検査用スタイルを生成する。

```sh
bun run build:fixture
SERVE_DIR=dist-fixture PORT=4179 bun run preview
```

`http://127.0.0.1:4179/` を開く。背景は検査用の無地で、実際の道路地図ではない。共有施設・複数配布先・位置未確定を含む。`FIXTURE_ONLY.txt` と画面上の警告で識別し、実在する訪問先として使わない。旧比較 C の簡略背景も同梱される。

```sh
bunx --no-install playwright install chromium
bun run test:browser
```

ブラウザー検査は独立したループバックサーバーを起動・終了する。外部地図サービスを使わず、地図のクリック、リンク、クラスタの全件選択、キーボード、位置情報、保存範囲、地図サイズ、オフライン閲覧と障害時の一覧を検査する。

## 実データで動かす

ルートで保存済みデータから生成する。この処理で GKP へアクセスしない。素材が不足していれば通常ビルドは失敗し、合成データへ自動で置き換えない。

```sh
python3 -B tools/national/assemble.py --out /tmp/national-assembled.json
go run ./cmd/builddata -places /tmp/national-assembled.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05
cd web
bun run build
bun run preview
```

`http://127.0.0.1:4173/` が新しい標準画面。開発時は `bun run dev` を使える（カードデータの生成は必要）。標準の背景は mapcn の CARTO 明色スタイル。背景を変更する場合は `VITE_MAP_STYLE_URL` に MapLibre 互換スタイル URL を指定して起動・ビルドする。`VITE_` の値はブラウザーへ配信されるため秘密値を入れない。公開先・利用条件・配信サービスは公開前に別途決定する。

MapLibre Worker と shared モジュールはインストールした版から同一オリジンへ配信する。unpkg に依存しない。mapcn の取得元、変更点、MIT ライセンスは [MAPCN_PROVENANCE.md](MAPCN_PROVENANCE.md) を参照。

位置未確定の配布場所は通常ピンにしない。`go run ./cmd/builddata -reference-places` は参考位置を使う検証用。公開用の確定状態に変換しない。標準画面は確認済みの配布場所のみを初期表示する。「蓋の位置も表示」で蓋を追加し、カード詳細の「このカードの蓋を見る」で個別の蓋へ進む。参考ピンは標準画面には出さない。検索は都道府県・自治体・カード番号・施設名・住所を対象にする。全国一覧との照合と地域別調査を反映しているが、未確定の配布条件・施設位置は残る。[全国統合手順](../docs/national-assembly.md)の採用範囲を確認する。静的JSONは時間経過だけで再評価されないため、利用時は基準日を進めて再生成する。

## オフラインと比較画面

保存完了後はカード一覧・詳細とリンクの表示をオフラインで使える。背景・タイル・背景フォントの保存は保証しない。Google マップを開くには通信が必要。保存状態は「この地図について」に表示する。

前回の比較画面は `/legacy.html?engine=c`。A は地理院、B は自己配信 PMTiles、C は自前簡略背景、D は背景なしの診断用。従来の `/?engine=a|b|c|d` は比較画面へ移動する。B だけは追加素材が必要で、`bash web/scripts/fetch-map.sh` と `bun run build:comparison` を使う。

`?data=split` はピンと詳細を分割取得するが、全詳細をメモリに保持する。`?benchmark` は保存範囲を復元しない。過去の結果は [技術検証6](../docs/verification/06-map-prototype.md)、[技術検証7](../docs/verification/07-results.json) に残す。前回の数値を今回の実装の結果として使わない。

## CI と性能検証

GitHub Actions は Go、lint、format、型検査、Vitest、fixture ビルド、Chromium 操作検査を実行する。`web-build-fixture-<SHA>` を7日保存し、デプロイはしない。別ワークフローで APM frozen install・監査・配置内容の一致を確認する。

速度は起動・詳細応答・移動時のフレーム間隔を分けて評価する。`CHROME` で Chrome の実行ファイルを指定できる。fixture の無地背景の速度は実地図の評価に使わず、PC の模擬計測だけでスマホ性能の合格とはしない。今回の実施範囲と残課題は [技術検証8](../docs/verification/08-mapcn.md) に記録する。

地図データの出典は [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md)、既存比較地図のライセンスは [THIRD_PARTY_BASEMAPS.md](THIRD_PARTY_BASEMAPS.md)、簡略背景の精度・再生成の制約は [background/README.txt](background/README.txt) を参照。
