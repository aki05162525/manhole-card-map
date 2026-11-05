# 地図の比較試作

外部公開しない検証用の画面である。
既存A/Bの測定結果は [技術検証6](../docs/verification/06-map-prototype.md) を参照する。
今回の標準画面は自前の簡略背景を使うCで、詳細な道案内はGoogleマップへ渡す。

開発ツールはルートの `mise.toml` に固定する。Bun はパッケージ管理と
スクリプト起動に使い、Vite・Vitest・既存の計測スクリプトは Node.js で動かす。

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

mise をシェルで有効化していない場合は、各コマンドに `mise exec --` を付ける。
依存関係は `web/bun.lock` に保存する。lefthook は明示的にインストールする。
pre-commit でフロントの lint・format・型検査と Go テスト、pre-push で Vitest を実行する。
整形は `bun run format`。Oxlint の標準 correctness ルールをエラーとして扱う。

Vitest の対象は `src/**/*.test.ts` と `scripts/**/*.test.ts`。
`bun run test:watch` で変更を監視する。テスト0件は失敗として扱う。
Googleマップのリンク、位置未確定データ、密集カードの選択などをVitestで検証する。
新機能は失敗する挙動テストを書き、実装後に成功を確認する。

クリーン checkout で実データなしにビルド経路を確認するには、明示的に次を実行する。

```sh
bun run build:fixture
bunx --no-install playwright install chromium
node scripts/browser-check.mjs
```

このモードだけは `dist-fixture/` に5枚の合成カードと簡略背景、圧縮ファイル、
Service Worker と `FIXTURE_ONLY.txt` を生成する。画面にも合成テストと表示する。
`public/` と通常ビルドの `dist/` は変更しない。
共有施設・複数配布先・位置未確定・島のケースを含み、実在の訪問先ではない。
ブラウザ検査は独立したループバックサーバーを起動し、終了時に停止する。
リンク・密集カード・キーボード・前回範囲・位置情報拒否・オフライン閲覧を検査する。
PMTiles、フォント、スプライトは含まない。性能測定は実データで別に行う。
通常の `bun run build` は素材が欠けると失敗し、fixture にフォールバックしない。

GitHub Actions は Go テスト、フロントの lint・format・型検査・Vitest と
fixture ビルドとChromiumによる操作検査を実行する。`web-build-fixture-<SHA>` を7日間保存するだけで、
Pages 等へのデプロイは行わない。

リポジトリのルートで保存済みデータから生成する。
GKP にアクセスする処理はない。

```sh
go run ./cmd/builddata
cd web
bun install --frozen-lockfile
bun run build
bun run preview
```

`http://127.0.0.1:4173/` はC（簡略図）である。
`?engine=a` は地理院タイル、`?engine=b` はMapLibre、`?engine=d` は診断用の背景なし。
Dは背景処理を省いた場合の時間を調べるためのもので、完成画面ではない。
Bの比較を行う場合だけ、ルートで `bash web/scripts/fetch-map.sh` を実行し、
`web/` で `bun run build:comparison` と `bun run preview` を実行する。
通常ビルドは大きなPMTilesや地図用フォントを要求しない。
`&data=split` を付けると、ピンと詳細を別ファイルから並列に読む。
すべて起動完了までに全詳細をメモリへ読み込む。
`&benchmark` は前回の範囲の復元だけを無効にする。

通常のデータ生成では、未確定の配布場所をピンにしない。
参考位置を使う試験は `go run ./cmd/builddata -reference-places` で生成できるが、公開用の確定状態には変更しない。
借用住所、町字や丁目などの粗い座標、自治体不一致は参考位置にも含めない。

```sh
bun run typecheck
bun run sizes
```

Chrome の場所は `CHROME` 環境変数で変えられる。
既定値は `/usr/bin/google-chrome` である。
測定は競合を避けるため順番に実行する。
生の測定結果、トレース、スクリーンショットは `results/` に保存する。
`RUNS`（既定5）、`ENGINES`（既定 `a,b`）、Chrome 計測の `MODES`（既定 `full,split`）で対象を指定できる。

アプリとカードデータは Service Worker に保存し、背景地図と地図用フォントは保存対象にしない。
ビルドごとにキャッシュ名が変わる。
保存完了を画面で確認してからオフライン試験を行う。
比較ビルドの `dist/maps` は大きなファイルの複製を避けるため、ローカルの背景地図へのシンボリックリンクである。

地図のライセンスは [背景地図のプログラムと素材](THIRD_PARTY_BASEMAPS.md)、[背景地図のデータ](THIRD_PARTY_DATA.md) に保存する。
フォントの OFL は取得した `public/fonts/OFL.txt` に含まれる。

## 今回の技術選定

実行時はVite＋TypeScript＋Leafletを維持する。UI規模に対してReactへの移行は
今回必要なく、地図の操作を既存ライブラリへ任せ、背景の転送量と描画量を減らす。
Bunは開発ツールであり、ブラウザ側の描画を速くする仕組みではない。
Effect・ArkUIは現段階では導入せず、Alchemy・Reylo・Better Authは公開基盤や
バックエンドを決める段階で再検討する。tsrsは型検査の互換性を別途確認してから、
Fallowは静的解析の必要性が出てから検討する。portlessは現状の単一開発サーバーでは使わない。

検索は都道府県名・自治体名・カード番号の文字検索であり、専用の地域絞り込みUIはない。
配布場所の座標確定、公開データの更新運用、ホーム画面追加用manifestは未実装。
背景のオフライン保存は保証対象に追加していない。

A/C/Dの新しい測定では、過去の結果を上書きしないように保存先を指定する。
`bun run preview` で実データの通常ビルドを配信した状態で順番に実行する。

```sh
RESULTS_DIR=results/lightweight ENGINES=a,c,d MODES=full RUNS=5 node scripts/measure.mjs
RESULTS_DIR=results/lightweight ENGINES=c RUNS=5 node scripts/lighthouse.mjs
```

初回は新規ブラウザ、再起動は保存完了後。初期表示、カードデータ、詳細UIは共通。
C/Dの最大ズームは8で、Aとは最大拡大率が異なる。移動・拡大縮小の比較操作は全案で7/8を使用する。背景なしのDを製品の合格判定に使わない。
PC上の模擬計測だけでAndroid実機の性能合格は出さない。

簡略背景の生成・出典・保護する島・精度の制限は [background/README.txt](background/README.txt) を参照する。
ブラウザでは島や穴の座標を変えず、同じ県の図形を47県分の描画レイヤーへまとめる。
Cの背景はカードJSONと並列に取得し、背景の描画と全詳細の準備ができた時点を起動完了とする。

旧A/Bの計測スクリプト `interaction.mjs`、`verify.mjs`、`summarize.mjs` は技術検証6の
再検査用に残す。Bを含める場合は比較ビルドが必要で、当時の数値を再現するには当時のコミットを使う。
新しいA/C/Dの生データは `RESULTS_DIR` を分け、旧集計へ混ぜない。

## 技術検証7：今回の結果

2026-11-05の5回ずつの計測値、条件、測定対象ビルドのハッシュは
[07-results.json](../docs/verification/07-results.json) に保存した。
CのChrome模擬計測の中央値は初回3,194ms、再起動692.6ms、初回後の詳細194.9ms。
Lighthouseでは初回4,593.1ms、再起動889.4ms、初回後の詳細196.8msだった。
初回3秒・詳細100msの目標は未達であり、MVPの性能合格とはしない。
比較測定後に選択ピンの重なり順だけを修正し、ブラウザ検査を再実行した。
記録したハッシュはその修正前の計測対象ビルドを特定する。

実データの検査は1,313枚・蓋1,309ピン。配布場所の確定は引き続き必要。
実データの速度測定と、合成データによる共有施設・複数配布先の操作検査は区別している。
次の性能改善では、背景のCanvas再描画と全詳細データの転送・解析を対象にする。
背景なしDやLighthouseスコアだけで合格を判断しない。

今回のRED→GREENは、Mapsリンク・密集選択、小島の保持と精度、背景の配備と描画失敗、
共通ズーム操作、描画レイヤーの集約、読み込み中の選択、現在地ボタン、背景の並列取得、
選択ピンの重なり順を対象とした。単体テストに加え、ブラウザ検査で実際のDOMと操作を確認する。
