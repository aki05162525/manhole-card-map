# Issue60 最終8件の統合

基準 `882f8ccd6cf13af864711eaf14008e932b480771` にCI修正 `cb3d5380ab953c9e939a5ea6474960c62e2ebdf9` をマージし、独立Codexレビューe0bc6ec7の公開実採用承認を引き継いでNo43/45を追加した。先行の利用者指定No6/7/11/13/19/21は不変。今回の最終集合はこの8件。

No43 `facility:kanto-north-ab5de7e90313a0f18ac5` は `36.4361209,139.9091953`、No45 `facility:kanto-north-88ee40433ca2bfde9534` は `36.4057278,139.3307991`。指定された標準json.dumps行hashを照合し、数値を変えず正規化した。[承認追補](../../data/evidence/issue60/photo-resolution/adoption-review.json)と[行対応](../../data/evidence/issue60/photo-transformations.json)に結び付けている。独立承認と利用者指定の経路は分離したまま。

数値基準はseamlessphoto。43は2010年4～5月オルソ、45は2020年5～8月民有林写真。標準地図の旧制御点・旧行列はfit不使用、旧点は差の比較のみ。基本測量成果以外・出典記載で追加申請不要という独立承認を継承し、提供者の個別許諾とは記していない。source-conditionsの公式図・写真出典・加工主体・独自位置合わせの説明を既存SourceNotesへ追加した。現地絶対精度・原本全文の再配布許諾は保証しない。

検証：

- 2件未採用と出典表示欠落でRED、追加後GREEN。Issue60の影響範囲19テスト成功（53.268秒）、出典表示2テスト成功、`issue60_photo_resolution.py --check`成功。過去のCI修正・fixture/browser/offline成功は `pr84-frontend-ci.md` を再利用した。
- 入力35hash・成果52hashと候補行hashを照合。再計算成功は継承し再実施せず、旧束425ファイルとHEAD既存dataのbytes不変を再確認。旧採用・旧値provenance・歴史manifestは不変。歴史テストは後続の2件を除いた読取専用ビューで従来結果を再現する。
- 2026-11-05保存一覧・評価日2026-11-06で前後をGo実生成。台帳1,586施設・1,670関係、未位置444、関東保留1（No46玉村）、独立承認138・利用者指定6。生成1,313カード・1,735施設・1,825関係・配布ピン1,142。差分は2施設のcoordinate/evidence/locationReviewのみ、既存全カード・関係・ピンを保持。[生成比較](../../data/evidence/issue60/photo-generation.json)、[最新残件](../../data/national/issue60/remaining-index-after-photo.json)。
- web build成功。共有previewで実full/split×2施設の4ケースを確認。施設別Maps query、ORIGAMIの一時中止・桐生の配布中、位置確定、出典リンク・写真年代・加工主体が一致。[表示記録](../../data/evidence/issue60/photo-browser.json)。初回はサーバー起動前の接続拒否、検査用CSS指定エラー、桐生の複数窓口の先頭リンク選択で失敗したが、対象施設へ絞る検査に直して成功。アプリの不具合ではない。検査タブ2枚とサーバー127.0.0.1:4191は終了済み。
- 原写真/PDFのbytesがweb/public・web/distに含まれないことを確認。通常commit hookでGo／全国Python全suiteと差分frontend検査を実施し、結果とcommitは最終報告に記す。手動全suiteの重複なし。

文書との差：原prepare.pyの「各施設2x3」は実装43=2x2／45=3x3と異なるため、原本を保持して承認追補で訂正した。原資料の未承認表現は研究時点の履歴。verification.jsonのcheckedInputHashes=62はinput-hashes 35件に継承・取得記録の検査を加えた数であり、成果52hashとは別集合。既往PMTiles READMEの `./pmtiles@2.10.0/index.js` と実index `./lib/pmtiles@2.10.0/index.js` の差は再調査していない。利用者指定の限定例外・confirmedの意味は先行統合記録どおり維持。その他の新規文書/code不一致なし。

現地測量・在庫/配布継続の新確認・スマホ/実地図性能・今回commitのCIは未実施。既存大チャンク警告は残る。再委任・push・PR・watchなし。親が最終8件の統合差分レビューを担当する。
