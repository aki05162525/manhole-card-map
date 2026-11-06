# Issue60：人手回答後の15施設採用

現在の索引は[衣笠事務所の1件追補後](../../data/national/issue76/remaining-index-after-kinugasa.json)（全国未位置474・関東保留31）。以下は各採用時点の履歴。[追補検証](issue60-kinugasa-adoption.md)を参照。

基準HEAD `5449e71046924c51834b538674c78342f2dc71b3`、2026-11-06の[独立承認](../../data/evidence/issue60/human-answers-20261106/round2/adoption-review.json)に従い、番号1・2・3・4・5・9・15・17・26・28・31・33・34・37・47だけを統合した。固定47 outcomesのSHA256は `b7f232a659f06f524b46c7ade69c0d4316459e5ce57cd548d7ce2597f25d55d2`。再審査・追加承認は行わず、白岡40はGoogle直接転記点の利用条件が未解決のため未採用。

東京6・千葉2・埼玉6・群馬1を各県の `human-followup/` に保存。旧assessmentのファイルhashをsupersedesし、全47評価hash・候補行hash・元承認ファイルhashを拘束したsubset承認を記録する。既存 `prepare_county` と `merge_assessment_packages` を再利用し、旧施設hash・binding・provenanceとmanifest登録を追加。吉岡の `gunma/followup` とは独立している。

`adoptionMethod` と `sourceVersion` の任意値はレビュー対象の行から読む。番号3/5はUR公式配置図の相似写像、9は区公式計画図からGSI写真への双線形写像であり、GSI外形内点という固定説明を付けない。sourceVersionは承認されたadoptionMethodから導出する。15座標と原資料checkedAtを変更せず、利用者回答・採用日は11月6日として分離。原調査・固定評価・人手原文・旧588/490索引は保持した。配布関係・状態・在庫は変更していない。

台帳1,586施設・1,670関係、未位置490→475。関東は145評価・113採用・32保留。最新索引は [remaining-index-after-human-answers.json](../../data/national/issue76/remaining-index-after-human-answers.json)。11月5日取得の一覧原本と `-as-of 2026-11-06` を採用前後で揃え、実生成の配布施設ピン1,096→1,111を確認。生成全体は1,735場所・1,825関係、カード1,313枚。追加ピン集合は承認15件と一致し、既存ピン・施設・カード・実効配布関係を保持した。

## 検証と再現

出典任意値と15件反映の2テストで修正前の失敗を確認。その後、採用・残件の対象15テスト成功。subsetパッケージ再現検査追加後は当該1テストだけ再確認した。既存98件の採用3出力をバイト比較し一致。全国Pythonと非キャッシュGoの全体検証は通常commit hookに委ね、手動で重複実行しない。

実生成・ビルド成功。既存の大チャンク警告は残る。full/split各15施設で詳細、Maps座標query、配布情報出典リンク・確認日を確認した。[生成差分](../../data/evidence/issue60/integration/generation.json)、[ブラウザー結果](../../data/evidence/issue60/integration/browser-result.json)、[監査要約](../../data/evidence/issue60/integration/audit-summary.json)を保存。共有プレビューは旧11月5日データを返したため結果を採用せず、ローカルPlaywrightで今回の配信世代hashを検査した。全国監査は最初のrepo外ledgerパスを拒否したため、同じledgerを `data/work/issue60-integration/` に置いて実行した。

```sh
python3 -B tools/national/issue60_adoption.py --check
python3 -B tools/national/issue76_remaining.py --check data/national/issue76/remaining-index-after-human-answers.json
python3 -B tools/national/assemble.py --out /tmp/national-assembled.json
mise exec -- go run ./cmd/builddata -places /tmp/national-assembled.json -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-06
```

`issue60_adoption.py` の `--check` を外すと固定承認から採用パッケージとmanifestを再現する。旧raw調査スクリプトの `/tmp` 絶対参照は当時の実行記録であり、現在の再現手順ではない。生成差分スクリプトは採用前full.jsonを引数に取る。ブラウザースクリプトは稼働中のローカル4181を使い、自動起動しない。

## 記述差と未確認

- 旧pending・adoptionApproved=false・レビュー待ちのnextAction、および12/14の初回取得方法不明は研究時点の履歴。現採用は別のsubset承認に記録し、原文を書き換えない。
- 既存のGSI固定説明は公式図写像点の由来と一致しなかったため、任意値で補う。値を持たない既存98件の出力は不変。
- web/READMEの生成例は11月5日評価で、11月6日確認の現在の台帳に合わなかったため11月6日へ修正した。保存一覧原本の取得日は更新しない。
- 現UIの「この配布情報の出典」はrelationの出典。位置evidenceのverificationMethod/sourceVersionを画面に出す機能はない。位置由来はfull/splitの生成JSONと採用bindingで検査した。位置の説明が画面表示されたとは扱わない。
- 古い98採用・490未位置・1,096ピンは吉岡追補時点の値。今回の索引と生成監査を現在値として参照する。

外部Maps経路、現地、入口・室内窓口、当日在庫、スマートフォン性能は未確認。全原タイル・全原典・旧レビューの再検証はしていない。利用者資料原本全文は配信資産に追加していない。

実装commit `51c47e399db9fde421a35e347d5ad276a11091d4` の通常フックは成功。`go test -count=1 ./...` 内の全国Python191件を含み、cmd/builddataは117.708秒。全suiteの手動重複なし。ログは `/tmp/issue60-adoption-commit.log`、SHA256 `d8a570fbb16b330130022810f4f156a941e23ed94876e6a0de0ca223e289a63a`。この結果追記だけをamendし、コード・台帳は検証時と同一。検証用サーバー・タブは終了済み。
