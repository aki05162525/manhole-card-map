# Issue60 承認済み4施設の採用（2026-11-06）

先行PR82の `064203c7737b70e29566234ba77a28967a47351c` を `git merge --ff-only` で取り込み、番号8/10/30/36だけを追加した。座標・ID・配布状態・関係は承認範囲外で変更していない。No.6/11/19は保留のまま。先行12件の採用処理、元研究、固定承認入力、既存126件の出力を保持した。

[承認引継ぎ](../../data/evidence/issue60/four-followup/adoption-review.json)は親依頼が情報源。レビュー2件の取得はいずれも `thread_not_found` で、原文の引用はしていない。原候補4行は指定の正規化hash（`json.dumps(ensure_ascii=False, sort_keys=True)`、標準空白・改行なし）、A/B assessmentとA input-hashesは指定の生バイトhashと一致。元評価の未承認表記を改変せず、後続承認の時系列と条件を追補した。

[/tmp保存先・hash対応](../../data/evidence/issue60/four-followup/preserved-inputs.json)は研究パッケージと参照入力を追跡する。venv/cache以外を保存し、参照原本もhash照合した。利用者編集 `/tmp/kanto-remaining-recheck.md` は変更していない。[変換対応](../../data/evidence/issue60/four-transformations.json)が原候補→正規化候補を結び、各追補のprovenance/lifecycleと[最終採用行hash](../../data/evidence/issue60/four-integration/generation.json)からmanifestに追跡できる。原研究座標は変更していない。原本全文・画像は配信資産に含めていない。

東京・埼玉の `four-followup` packageは旧評価をhash付き `supersedes` で置換する。最新残件は [remaining-index-after-four.json](../../data/national/issue76/remaining-index-after-four.json)。旧索引は保存する。先行12件のテストは当時の固定manifestと読取専用の歴史入力で再現し、12件差分・旧値・全関係の検査を保持した。15件・衣笠の歴史テストにも今回4件の除外だけを加えた。新テストは現在manifestから4件を除いた結果が先行manifestと完全一致すること、既存126件保持、差分4件のみを別に検査する。

検証：

- 新4件テストは追加前に差分ゼロで失敗（RED）、追加後に成功（GREEN）。先行12件テストも現在値混入による失敗を記録し、歴史基準への分離後に成功。[ログ](../../data/evidence/issue60/four-integration/four-green.log)。台帳1,586施設のID集合と1,670関係は不変。
- 新4件・先行12件・衣笠・固定15件の再生成 `--check`、採用ゲート対象テスト成功。旧再生成helperは変更せず、新追補の挿入順を調整した。
- 保存一覧 `gkp-20261105.html`・`-as-of 2026-11-06` で前後を実生成。未位置462→458、関東保留19→15、採用126→130、施設ピン1124→1128。生成後1,735施設/1,825関係は台帳と異なる集合。カード、既存ピン、全配布関係、既存126件の生成施設オブジェクトが不変。
- `bun run build`（typecheck含む）成功。既存の大チャンク警告は残る。新checkoutの不足素材は同マシン既存checkoutから補い、builddataの入力hash検査成功。生成full/splitの座標・位置由来説明も4件ずつ確認。
- Chromiumでfull/split各4施設、計8詳細の位置確定・配布関係の出典URL・Google Maps query一致、pageerrorなし。[結果](../../data/evidence/issue60/four-integration/browser.json)。既存ポート確認後、4187に自分のサーバーを起動し終了済み。
- 全suiteは通常commit hookの非キャッシュGo（内部で全国Python suite実行）にまとめ、手動重複しない。commitと結果は実行後に追記する。

引き継いだ検証は東京原本32件・新取得5hash・2点座標再現、および独立承認時の棟同定。今回再調査した結果として扱わない。現地経路・在庫・現在の配布継続、実地図/スマホ性能、統合独立レビュー、GitHub CIは未確認。push/PR/GitHub merge/watchは行っていない。

文書・コード・記録の相違：

- 原候補の `adoptionApproved=false`・親レビュー待ちは承認前の履歴。後続承認と最終採用を別ファイルで結ぶ。旧索引の462/19は当時の値で、現在の458/15と混同しない。
- 8の西側誤座標、10の独立北ブース説は撤回済み。受付用途は利用者報告、配置は一次資料、同棟への対応はレビュー判断。8の旧事務棟の色材質は独立確認していない。10の古外形の幅差は残し、全周や入口の一致を装わない。
- 30の報告数値は408.56m差、南指定とも不一致。正門右の小棟998を採用し、室名看板・展示蓋写真は未確認。36の報告数値は217.39m差で棄却し、2018-11-14写真・2017町広報等から1258を採用。現在用途は利用者報告で補完。小さな境界余裕は精度保証ではない。
- UIの「この配布情報の出典」は位置根拠ではなく配布関係の出典。位置由来はJSONで検査した。生成座標にはlat/lng以外のstatus/source等が付くため、研究候補オブジェクトとの比較はlat/lngを抽出する（最初の手動比較は型の違いで失敗し、既存生成構造に合わせて再検査成功）。
- 共通研究が記録する外部READMEの `./pmtiles@2.10.0/index.js` と実indexの `./lib/pmtiles@2.10.0/index.js` の差は引継ぎ事項。外部実装を再調査していない。過去の「公的polygon/Point待ち」「CRS親確認待ち」は現在の採用条件ではない。
