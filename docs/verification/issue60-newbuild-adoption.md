# Issue60 No27/35/42 の採用

main `18c06f5cdb179521ce826212b219fde74250df2c` から独立checkoutで開始し、利用者指定の先行No14/40/41統合 `531b8d2b96eeb9d421d481b875959688e81c0a3c` をfast-forwardで取り込んだ。その133採用を基準に、独立レビュー `642054fc` の承認を利用者から引き継ぎ、No27/35/42だけを追加した。No43/45は公開利用手続保留のため未採用。実装担当による新しい採否判断・原典再調査はしていない。

[承認と固定入力](../../data/evidence/issue60/newbuild-followup/adoption-review.json)、[保存bytesのhash](../../data/evidence/issue60/newbuild-followup/preserved-inputs.json)、[原候補→正規化候補](../../data/evidence/issue60/newbuild-transformations.json)、[最終採用行までのhash対応・実生成差分](../../data/evidence/issue60/newbuild-integration/generation.json)を保存した。入力 `/tmp/issue60-own-georef-newbuild/` の原本・調査記録は `.venv` / `__pycache__` を除いてそのまま保持。入力verificationの299件hash検証成功・計算再現を引き継ぎ、統合時は保存bytesと承認された原候補3行の `json.dumps(ensure_ascii=False, sort_keys=True)`（既定空白・改行なし）hashを確認した。元候補のstatusを書き換えず、採用用行・binding・provenance・manifestを既存helperで別途生成する。

No27は深谷市2024航空写真2203/worldfileからの代表点。CC-BYの版を断定せず、保存APIの `isopen=false` を保持する。No35は設計前図とGSI2020写真の対応に完成資料を補完した代表域であり、完成屋根の直接測量ではない。No42はGSI2023写真の小屋根と2025広報の同定。8/15/6mは感度確認の範囲で、絶対精度や棟内包の保証ではない。Google数値は導出に不使用。採用証拠には加工元・不確かさ・限界を記載した。

現在UIの `SourceNotes` を独立コンポーネントへ抽出し、深谷市の資料名・CC-BY版未指定・加工表示・API登録値と、GSI全国最新写真・PDL1.0・加工表示・非承認の説明を追加した。標準地図を使う保留2件の利用区分と写真の区分を混同しない。原本は `data/evidence/` に保存し、public/distへ配信しない。

## 検証

- 新3件が未採用の状態で差分テストRED、統合後GREEN。出典表示も必要な文言がない状態でRED、追加後GREEN。対象・先行採用の8テスト成功。旧テストは固定manifestと読取専用の歴史ビューを使い、旧hash・件数の期待値を維持した。
- `issue60_newbuild.py --check` 成功。既存133採用・全施設ID・台帳1,670関係・状態を保持し、3施設のcoordinate/evidence/locationReviewだけが変わる。No43/45は座標なし。
- 保存一覧 `gkp-20261105.html`、評価日 `2026-11-06` で前後をGo実生成。台帳未位置455→452、関東保留12→9、採用133→136、配布施設ピン1131→1134。生成集合は1,313カード・1,735施設・1,825関係。対象外全施設・既存ピン・全カード・全関係を比較して不変。新checkoutの未追跡raw/workは先行checkoutからコピーし、生成時の入力hash検査を通した。
- frontend lint / format:check / typecheck、単体139件、build:fixture、fixture browser suite、実データbuild成功。既存のMapLibre大チャンク警告は残る。
- 実生成full/splitの3施設×2方式=6詳細について座標と加工出典を検査。Chromiumでは各詳細の位置確定・配布関係出典URL・Maps query・状態を確認し、現行UIの「この地図について」→「データの出典と注意」を開いて出典文言とリンクの可視表示を検査し、pageerrorなしを確認した。結果は[ブラウザー記録](../../data/evidence/issue60/newbuild-integration/browser.json)。初回の表示検査は外側detailsを開かずtimeoutとなり、利用者と同じ順序で外側から開く検査へ修正した。実装不具合ではない。
- 全国Python/Go全suiteは通常commit hookの `go test -count=1 ./...`（cmd/builddataからPython全suite）で1回実行する。手動の全suite重複はしない。hook結果はcommit後に追記する。

## 文書・実装の差と未確認範囲

- 元report/assessment/candidates/source-conditions/verificationの「未承認」「approvals=0」は研究時点の記録。今回の独立承認は別のadoption-reviewに保持する。原記録は訂正しない。
- 旧検証文書の「現在」「最新」残件は当時の集合。今回の現在値は `remaining-index-after-newbuild.json` による。
- No27のCRS適用は解釈で、JGD2000/2011計算差0は実際のdatum差ゼロの証明ではない。保存APIのCC-BYとisopen=falseも別フィールドとして併記し、版や開放性を追加推定しない。
- 先行文書にある外部READMEの `./pmtiles@2.10.0/index.js` と実indexの `./lib/pmtiles@2.10.0/index.js` の差は引継ぎ事項で、今回再調査していない。過去の公的polygon/Point・CRS親確認待ち記述は現在の一律採用条件ではない。
- 現地測量・在庫や配布継続の新確認・スマホ/実地図性能・CI・外部公開は未実施。自治体/設計者の原本画像全文の公開許諾は未確認で、配信資産には含めない。push/PR/merge/watch/再委任は行わない。
