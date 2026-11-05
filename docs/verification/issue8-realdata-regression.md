# Issue #8 実データ UI 回帰検証

2026-11-05、既存 `http://127.0.0.1:4180` に Playwright Chromium 156.0.8078.4 で接続。全国1,313枚、data.updated は `2026-10-21`。interactive preview は使用せず、サーバー起動・停止、dist 再ビルド、データ編集もしていない。

## 再現した不具合

**終了カード `01-231-B001` を選ぶだけで React root が空になる。合成 DOM 操作の batching は再現条件ではない。** 新しいブラウザーの `#cards.selectOption("01-231-B001")` だけでも再現した。5件を逐次検索して選ぶケースでも full/split とも同じカードで失敗する。

実データの `placeText` が null なのに `CardDetail` が `card.placeText.join("\n")` を実行し、`TypeError: Cannot read properties of null (reading 'join')` を投げる。配信 asset のスタック先頭は `assets/app-ODm1mP3k.js:4:840`。`#root.innerHTML` は空、`window.prototype.metrics.errors` は `[]` のまま。metrics は詳細画面の未捕捉例外を記録せず、MapBoundary も詳細画面を包んでいない。

`app.tsx` を `(card.placeText || []).join("\n")` に修正した。既存の hours / links と同じ欠損値処理である。`CardDetail` を export し、`card-detail.test.ts` に null の source fields を持つ終了カードの React server renderer 回帰テストを追加した。終了表示、施設なし表示、蓋ボタン、Google Maps の座標リンクまで検査する。

親の元の preview セッションの例外履歴は取得していないため、その原因を完全に同定したとはしない。ただし「5件目で root 空・metrics.errors は空」と一致する通常操作の不具合は上記で再現できる。

## 再実行

```sh
cd web
mise exec -- node scripts/real-data-browser-check.mjs
# 別 origin の場合
REAL_DATA_ORIGIN=http://127.0.0.1:4180 mise exec -- node scripts/real-data-browser-check.mjs
mise exec -- bunx vitest run src/card-detail.test.ts src/ui.test.ts
```

既存の実データサーバー専用で、fixture は拒否する。CI の合成 fixture 試験には追加していない。full/split ごとに独立した ephemeral browser context を作り、検索、selectOption、ボタンクリックを逐次 await する。ピンは adapter.tapPoint で描画済み geometry の座標を取得して実際に mouse.click する。選択 callback は直接呼ばない。クリック後の metrics.taps 増加と対象カードの詳細を検査し、クリック前の詳細が残っただけの誤判定を防ぐ。Google には移動せず、href の施設座標または施設名・住所、蓋座標、api=1、target/rel を検査する。pageerror を記録し、失敗時は root と metrics を出力する。context とブラウザーは finally で閉じる。

## 結果

配信中の修正前 dist に対し、full/split の両方で以下の結果。最終スクリプトは終了コード1となり、終了カードの不具合を検出した。

- `14-100-A001`: PASS。横浜駅観光案内所で検索、詳細1施設、確定施設ピンクリック、蓋、Maps 2リンク。
- `14-100-D001`: PASS。桜木町駅観光案内所で検索、詳細1施設、確定施設ピンクリック、蓋、Maps 2リンク。
- `01-100-C001`: PASS。2施設を表示。施設位置は未確定で配布場所ボタンは disabled。蓋の実ピンをクリックし、施設名・住所検索2リンクと蓋1リンクを確認。
- `01-218-A001`: PASS。一時中止、1施設、確定施設ピンクリック、蓋、Maps 2リンク。
- `01-231-B001`: FAIL。上記 TypeError で root 空。配信中の旧 asset では蓋・Maps 操作に到達できない。

修正ソースの typecheck、追加ファイルの oxlint / oxfmt check は成功。`card-detail.test.ts` と `ui.test.ts` は計15テスト成功。**修正後 production dist のブラウザー成功は未確認**。親担当が再ビルドした後、同じスクリプトで各5件の成功を確認する必要がある。既存4180サーバーは維持し、自分の Chromium は終了した。

## 制約と照合で見つけた差

- Issue #8 の D001 を「位置未確定」とする前提は現行データと異なる。D001 は confirmed、`35.4511374,139.6312274` で施設ピン・座標リンクがある。A001 も confirmed、`35.4666121,139.6223259`。今回のローカル文書検索では D001 を未確定と書いた箇所自体は見つからず、元 Issue 記述は依頼で伝えられた前提として扱う。
- `types.ts` の Card は placeText / hours / links を string[] と宣言する一方、終了カードの実 JSON は3つとも null。今回は型やデータは変更せず描画側を修正した。
- `issue8-browser-regression.md` の「実データ UI は未検証」はその合成データ検証の範囲。今回の記録で通常操作検証を補う。SW 世代更新試験や親の preview を置き換えない。

desktop Chromium の通常操作のみ。スマートフォン、実端末、オフライン地図操作、既存 profile の HTTP cache、SW 世代切替、Google 側の表示は対象外。施設の現地位置や営業状況を外部サイトで再確認したという意味でもない。

## 親による再ビルド後の確認

親が通常ビルドを再実行した後、同じ4180に対して実データスクリプトを実行し、full/split各5件の全10ケースがPASS（終了コード0）。終了カードも蓋ピン・Maps hrefまで到達し、空画面を解消した。ここまでの結果は上記の修正前FAILと別時点の記録。
