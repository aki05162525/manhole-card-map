# Issue60 独自地理参照3件の採用

基準main `18c06f5cdb179521ce826212b219fde74250df2c`（PR83後）。親から引き継いだレビュー `db625998-d04d-4ecf-aed8-31b281e0fdaf` の承認No14/40/41だけを採用した。No7/13は未承認試算として原束に保存し、manifestには入れていない。新しい位置採否の判断はしていない。

[固定入力・承認](../../data/evidence/issue60/three-followup/adoption-review.json)、[全原本hash](../../data/evidence/issue60/three-followup/preserved-inputs.json)、[研究行→正規化行対応](../../data/evidence/issue60/three-transformations.json)、[最終採用hashと実生成差分](../../data/evidence/issue60/three-integration/generation.json)。原束と訂正版を別ディレクトリでbytes保存。candidates/assessment/calculationsの生hashと原束との一致、承認3行の標準json.dumps行hashを照合した。原本画像はpublic/distに配信していない。

県別 `three-followup` package、旧assessmentのhash付きsupersedes、manifest、[新残件索引](../../data/national/issue76/remaining-index-after-three.json)を追加した。既存130件の採用出力・固定入力・全ID・台帳1,670関係を保持し、変更は3施設のcoordinate/evidence/locationReviewのみ。既存helperを再利用し、No14はscope=facility（屋外区画）とした。helperの建物固定文言を既定値付き選択に、lifecycle理由を既存scopeに合わせた。先行の保留評価は履歴として保持し、歴史テストは固定manifestと読取専用ビューへ分離した。現在manifestの全採用検査と新3件の全差分検査は残した。

## 検証

- 対象REDは未採用3件による差分不足で失敗。採用後は対象2件成功、影響範囲の先行採用を含む8テスト成功。`issue60_three.py --check`でpackageを再現した。
- 保存一覧 `gkp-20261105.html`、基準日 `2026-11-06` で前後を実生成。全国未位置458→455、関東保留15→12、採用130→133、施設ピン1128→1131。生成後の1,735施設/1,825関係・1,313カードは台帳とは別集合。対象外全施設、既存全ピン、全カード・配布関係が不変。
- `bun run build`（typecheck含む）成功。新checkoutの未追跡raw/workは既存ローカルcheckoutから補い、生成時の入力hash検査を通した。既存の大チャンク警告は残る。
- 実生成full/splitの3件ずつの座標・位置由来説明を確認。[Chromium表示結果](../../data/evidence/issue60/three-integration/browser.json)は3施設×2方式=6件、配布情報の出典URL・Maps query・位置確定表示・pageerrorなしを確認。No14のupcoming状態も維持。検証サーバー `127.0.0.1:4187` は終了した。
- 親による訂正後verify.py 204 PASSと注釈の目視を継承し、同じ調査suiteは再実施していない。全国Python/Go全suiteは通常commit hookで実行し、結果は成功commit後の文書追記で記す。

## 証跡の差と限界

- No40原図は2000×1681、読取は1713×1440。原derive.pyの「original 1713x1440」は誤記で、訂正版はコメントのみ訂正。finalize.pyは縮小後に注釈を描くよう修正され、40-plan-annotated.pngとartifact-hashesが更新された。reportの輪郭余裕は約25m→約24m（計算24.0938m）。末尾の「未知の絶対誤差を25m以内と保証しない」は否定文として原文に残る。研究3ファイル・座標は不変。統合時に6変更ファイルだけの差分を確認した。
- No14は道路反対側の南100台屋外区画。No40は公式図とGSI写真の独自対応で、未使用差9.69/6.58m・輪郭24.09mは絶対保証ではない。No41はJR2023図保存版・1F改札外東口ブース・VAL南端・東西広場の対応、読取変動4.8～9.6mを保持。Google値は計算に含めない。これらをGSI建物外形由来とは記していない。
- 元研究の未承認・親確認待ち表現は研究時点の履歴であり、今回の承認とは別。旧検証文書が「現在/最新」と呼ぶ残件索引も各採用時点の結果であり、今回の現在値は上記索引による。
- 引継ぎ済みの外部README `./pmtiles@2.10.0/index.js` と実index `./lib/pmtiles@2.10.0/index.js` の差は再調査していない。過去の「公的polygon/Point待ち」「CRS親確認待ち」は現在の一律採用条件ではない。
- 現地測量、在庫・配布継続の新確認、スマホ・実地図性能、CIは未実施。座標情報の加工採用と原本画像全文の再配布条件は分けて扱う。
