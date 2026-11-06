# PR84 frontend CI: 最大ズーム検査の保存範囲競合

2026-11-06、`b01c47d1b8a7fefc43f5d0f6fc4e2caaf9fc9632` を取り込んだ
`t3/fix-pr84-frontend-ci` で検証。変更はブラウザー検査と本記録のみ。
位置データ・アプリ・待ち時間・描画閾値は変更していない。

## CI と再現

- [失敗ジョブ](https://github.com/aki05162525/manhole-card-map/actions/runs/42162324924/job/127710964131)
  は merge commit `415ef8fbb81ab86914bc1ca46e7013c2c83456c8` の
  `browser-check.mjs:252`、`tapPoint() !== null` で20秒タイムアウト。
- この merge commit と上記取り込み元の `web/`・`.github/workflows/ci.yml` に差分はない。
- artifact `browser-mapcn-415ef8fbb81ab86914bc1ca46e7013c2c83456c8`
  を取得。mobile と mobile-detail の2画像には失敗前の地図ピンが描かれている。
  失敗時の保存範囲・console trace はCIに残っておらず、CI内部のイベント順序そのものは未確認。
- 未修正の通常ローカル実行は成功。過去の成功記録を今回の成功として流用していない。
- 未修正スクリプトの最大ズーム用 `localStorage.setItem` と `page.reload()` の間に
  診断用の `await page.waitForTimeout(600)` を挿入すると、同じ20秒タイムアウトを再現。
  この600msは先行カメラアニメーションを完了させる再現操作であり、修正には含めない。
  `Storage.prototype.setItem` の計測で以下の順序を確認した。

```text
テストの書き込み: {lat:35.68, lng:139.76, zoom:18}
アプリの後続書き込み: {lat:35.67815533142331, lng:139.7605398822784, zoom:15}
reload後のview: {lat:35.67815533142331, lng:139.7605398822784, zoom:15}
metrics.errors: []
tapPoint(): 20秒タイムアウト
```

原因分類はテストケース間の競合。`app.tsx` の `adapter.onMove` が、直前のカード選択に
よる `card-map.tsx` の450msの `fitBounds` 完了時に現在範囲を保存する。
詳細を閉じてもアニメーションは終了待ちされない。テストが同じページの保存範囲を
書き換えて即reloadするため、遅れて届く `moveend` がテスト値を上書きできる。
詳細パネルを避けるためにずらした範囲を、詳細なし・paddingなしで復元すると、
対象ピンが検索パネルの下に入り、`tapPoint` は到達可能なピンを返さない。
診断画像でも検索パネル外にピンがないことを確認した。
これは地図の描画待ちを延長して解消する状態ではない。

## 修正と差分検証

最大ズームのケース専用にcontextを作り、`storageState` で初期範囲を投入する。
前のページの選択・アニメーション・保存処理から分離し、起動後の緯度・経度・ズームも
明示的に検査する。描画された点のクリック、2枚の一覧、Enter選択、一覧へ戻る操作は維持。
後続の保存範囲復元・同一originオフライン検査は元のcontextで継続する。

修正版でも、新contextを作ってから `clusterPage.goto(origin)` の前に同じ600msを入れ、
前ケースの保存範囲が上記ズーム15になった後に最大ズーム検査を開始した。
新contextは `{lat:35.68, lng:139.76, zoom:18}` を復元し、クリックと一覧操作まで成功。
通常スクリプトにはこの遅延を残していない。

## 今回の検証結果

Node 24.22.1、Bun 1.4.4、PlaywrightのChromium 156.0.8078.4。
検証した `web/scripts/browser-check.mjs` のSHA-256は
`1a9a81c2dce1a9eff0faa7669f239afda9437360ba343bc907f2fe66e6b7531b`。

- `bun install --frozen-lockfile`、`bun run hooks:install`: 成功。
- `bun run lint`、`bun run format:check`: 成功。
- `bun run test`: 今回実行した17ファイル・139件が成功。
- `bun run build:fixture`: 型検査を含め成功。既存の500kB超チャンク警告は残る。
  ビルド後の変更は検査スクリプトのみなので再ビルドは不要。
- `bun run test:browser`: 修正後の全ケース成功。
- `node scripts/offline-browser-check.mjs`: 全ケース成功。
- 上記600msの順序制御による差分検証: 未修正RED、修正後GREEN。
- `git diff --check`: 成功。通常pre-commitフックの結果はコミット時の出力で確認する。

試験サーバーはfixtureが `http://127.0.0.1:4179/`、offline回帰が
`http://127.0.0.1:38209/`。事前に既存プロセス・portを確認し、各試験後の停止を確認した。
公開previewは使用していない。ローカル診断ログ・画像は `/tmp/pr84-*` に保存。
修正後のGitHub Actions実行、実地図・実データ性能は未確認。Python/Go対象は変更しておらず
再検証していない。参照した文書とコードの食い違いは見つからなかった。
