# Issue60 承認済み12施設の採用（2026-11-06）

基準 `f7fdd5cd402e873c6565cab2b75f49a4f854bd4a` に、親が独立採用承認を引き継いだ番号16/18/20/22/23/24/25/29/32/38/39/44を追加した。再審査・配布関係更新はしていない。承認元の2 task は取得時に `thread_not_found`。原文の引用は作らず、[承認記録](../../data/evidence/issue60/twelve-followup/adoption-review.json)に親引継ぎ、review head `44f84df1`、留意条件を区別して保存した。

原候補12件、A/B全outcomes、C評価全体、共通評価の正規化SHA256は指定値と一致。正規化は `json.dumps(ensure_ascii=False, sort_keys=True)`、標準空白、末尾改行なし。入力原本は `twelve-followup/original/` に保存し、[保存先対応](../../data/evidence/issue60/twelve-followup/preserved-inputs.json)が元/tmp絶対パスと保存ファイルhashを対応付ける。venvとPythonキャッシュを除く原パッケージを保持し、未採用施設を含む元評価も変更していない。利用者編集の `/tmp/kanto-remaining-recheck.md` は操作していない。

[行変換](../../data/evidence/issue60/twelve-transformations.json)は原候補hash→正規化候補hashを記録する。施設IDで追補の `adoption-provenance.json`、`location-lifecycle.json` の `adoptionSHA256`、manifestの最終採用行hashへ追跡できる。候補座標を変えずに、既存 `prepare_county` に渡す形式とevidenceを整えた。千葉18/20は写真ネイティブ画素由来であり、建物外形由来と記していない。別IDを保持し、未使用角3.11～4.61m差・撮影日不明・手読取・補助一致0.25mの限界を保存した。38は旧本庁舎の歴史IDだけに適用した。

新packageは各県の `twelve-followup/`。旧assessmentへの `supersedes` を使い、過去15件・衣笠の固定承認入力と原調査、既存114件の採用出力は変更していない。過去の回帰テストは後続12件を除いた歴史manifestを再現するようにし、最新件数の検査は新テストに置いた。最新索引は [remaining-index-after-twelve.json](../../data/national/issue76/remaining-index-after-twelve.json)。旧索引は保存した。

検証結果：

- 恒久テスト `test_issue60_twelve.py` は未採用状態で12件差分が無く失敗（RED）し、実装後に成功（GREEN）。施設ID集合と台帳1,670関係は不変、変化は12件のcoordinate/evidence/locationReviewだけ。
- 新追補、固定15件、衣笠の再現 `--check` 成功。既存採用テストで見つけたprovenanceの余分なフィールドは除去し、既存helperの形式に合わせた。
- 11月5日保存一覧を `-as-of 2026-11-06` で採用前後に実生成。[生成結果](../../data/evidence/issue60/twelve-integration/generation.json)：未位置474→462、関東保留31→19、採用114→126、施設ピン1112→1124。既存ピン、カード、実効配布関係は不変。台帳1,586施設/1,670関係と、生成後1,735施設/1,825関係は異なる集合。
- `bun run build` 成功（typecheck含む）。既存の大チャンク警告は残る。新checkoutに不足した未追跡municheck等は同マシン既存作業ディレクトリから補い、builddataの入力hash検査を通した。
- Chromiumで実生成のfull/split各12施設、計24詳細を検査。[ブラウザー結果](../../data/evidence/issue60/twelve-integration/browser.json)：位置確定、配布関係の出典URL、Google Maps queryが採用座標と一致、pageerrorなし。既存ポート確認後に4186で自分のサーバーを起動し、終了済み。
- 全全国Python suiteと非キャッシュGoは通常commit hookの `go test -count=1 ./...`（内部でPython suite実行）を1回使用する。成功結果はコミット完了時の報告に記す。手動で全suiteを重ねない。

原本全文・図・研究候補は配信資産に混ぜていない。実地図性能、スマホ性能、現地経路、現在の在庫・配布継続は今回の検証範囲外。ブラウザーは生成物に対する検査であり、座標の再審査ではない。

文書・コード・記録の相違：

- 研究原本の未承認・親レビュー待ち・元/tmp参照は当時の履歴。今回の承認と保存先対応がそれを補う。旧「最新」索引の474等は過去値で、現在は462。
- 38の「配布終了」案内は既存実装では永久廃止の明記なしとして `suspended`。本文と状態をそのまま保持し、新位置により既存生成規則どおりピンが増える。`ended` への変更や移転承継はしていない。
- UIの「この配布情報の出典」は配布関係の出典。位置由来の説明は画面表示されないためfull/split JSONで確認した。
- 保存済み共通調査が報告する外部資料の既知差はREADMEの `./pmtiles@2.10.0/index.js` と実indexの `./lib/pmtiles@2.10.0/index.js`。今回その外部実装は再検査していない。
- 研究記録の相違も保持：24/32の利用者数値と建物叙述、25の旧比較集合、29の旧822だけの比較不足、22/23の代表点加工と用途境界の区別、16の利用者「本館」と公式「分館」、旧88692_225349_misc.pdfは案内図ではなく電話表、旧取得方法不明文と後続回答済み文の併存。これらをコード不一致や新たな未解決レビュー指摘として扱っていない。
