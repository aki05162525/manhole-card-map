# 地図の比較試作

外部公開しない検証用の画面である。
操作方法と測定結果は [技術検証6](../docs/verification/06-map-prototype.md) を参照する。

リポジトリのルートで保存済みデータから生成し、背景地図を準備する。
GKP にアクセスする処理はない。

```sh
go run ./cmd/builddata
bash web/scripts/fetch-map.sh
cd web
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

`http://127.0.0.1:4173/?engine=a` が Leaflet、`?engine=b` が MapLibre である。
`&data=split` を付けると、ピンと詳細を別ファイルから並列に読む。
どちらも起動完了までに全詳細をメモリへ読み込む。
`&benchmark` は前回の範囲の復元だけを無効にする。

通常のデータ生成では、未確定の配布場所をピンにしない。
参考位置を使う試験は `go run ./cmd/builddata -reference-places` で生成できるが、公開用の確定状態には変更しない。
借用住所、町字や丁目などの粗い座標、自治体不一致は参考位置にも含めない。

```sh
pnpm typecheck
pnpm sizes
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
