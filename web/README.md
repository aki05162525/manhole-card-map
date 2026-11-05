# 地図の比較試作

外部公開しない検証用の画面である。
操作方法と測定結果は [技術検証6](../docs/verification/06-map-prototype.md) を参照する。

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
`bun run test:watch` で変更を監視する。フロントの挙動テストはまだないため、
現在は `passWithNoTests: true` とし、0 件を成功扱いする。
最初の機能を TDD で実装するときにこの設定を削除し、失敗するテストから始める。
0 件の成功は機能検証の完了を意味しない。

クリーン checkout で実データなしにビルド経路を確認するには、明示的に次を実行する。

```sh
bun run build:fixture
```

このモードだけは `dist-fixture/` に空の合成カードデータ、圧縮ファイル、
Service Worker と `FIXTURE_ONLY.txt` を生成する。
`public/` と通常ビルドの `dist/` は変更しない。
背景地図・フォント・スプライトを含まないため、地図表示・操作・オフライン動作の
検証には使えない。実データの代替や公開用成果物ではない。
通常の `bun run build` は素材が欠けると失敗し、fixture にフォールバックしない。

GitHub Actions は Go テスト、フロントの lint・format・型検査・Vitest と
fixture ビルドを実行する。`web-build-fixture-<SHA>` を7日間保存するだけで、
Pages 等へのデプロイは行わない。

リポジトリのルートで保存済みデータから生成し、背景地図を準備する。
GKP にアクセスする処理はない。

```sh
go run ./cmd/builddata
bash web/scripts/fetch-map.sh
cd web
bun install --frozen-lockfile
bun run build
bun run preview
```

`http://127.0.0.1:4173/?engine=a` が Leaflet、`?engine=b` が MapLibre である。
`&data=split` を付けると、ピンと詳細を別ファイルから並列に読む。
どちらも起動完了までに全詳細をメモリへ読み込む。
`&benchmark` は前回の範囲の復元だけを無効にする。

通常のデータ生成では、未確定の配布場所をピンにしない。
参考位置を使う試験は `go run ./cmd/builddata -reference-places` で生成できるが、公開用の確定状態には変更しない。
借用住所、町字や丁目などの粗い座標、自治体不一致は参考位置にも含めない。

```sh
bun run typecheck
bun run sizes
node scripts/measure.mjs
node scripts/lighthouse.mjs
node scripts/interaction.mjs
node scripts/verify.mjs
node scripts/summarize.mjs
```

Chrome の場所は `CHROME` 環境変数で変えられる。
既定値は `/usr/bin/google-chrome` である。
測定は競合を避けるため順番に実行する。
生の測定結果、トレース、スクリーンショットは `results/` に保存する。
`RUNS`（既定5）、`ENGINES`（既定 `a,b`）、Chrome 計測の `MODES`（既定 `full,split`）で対象を指定できる。

アプリとカードデータは Service Worker に保存し、背景地図と地図用フォントは保存対象にしない。
ビルドごとにキャッシュ名が変わる。
保存完了を画面で確認してからオフライン試験を行う。
`dist/maps` は大きなファイルの複製を避けるため、ローカルの背景地図へのシンボリックリンクである。

地図のライセンスは [背景地図のプログラムと素材](THIRD_PARTY_BASEMAPS.md)、[背景地図のデータ](THIRD_PARTY_DATA.md) に保存する。
フォントの OFL は取得した `public/fonts/OFL.txt` に含まれる。
