# Issue60 先行6件と利用者指定6件の統合

`t3/user-approved-location-exceptions` の `37e6c4face18cca08afef2defe5c4ec36fd6b369` に、先行6件の `b01c47d1b8a7fefc43f5d0f6fc4e2caaf9fc9632` をマージした。No14/40/41、No27/35/42の独立承認と、No6/11/19の利用者指定採用を保持し、最新の明示許可でNo7/13/21を追加した。他checkoutへの編集、位置再調査、画像要求、採否の再質問、再委任はしていない。

| No | 利用者指定の採用値 | 限界・訂正 |
| --- | --- | --- |
| 6 | 35.73177,139.22852 | 赤枠駐車列との所見と旧点から約83m南の履歴を維持 |
| 7 | 35.710431,139.805807 | 高架下店舗の独立位置同定成功とはしない |
| 11 | 35.25792,139.66228 | a795f32cが承認したGSI別点35.2578411,139.6621914とは別 |
| 13 | 35.18845,139.65330 | 初回35.1889,139.6538を採らず、訂正版を使用 |
| 19 | 35.57720,140.38395 | 5.328km離れた35.53986,140.34586は転記誤りとして撤回済み |
| 21 | 35.72350,140.10600 | 初回35.7208,140.1005を採らず、旧上下水道局敷地代表点。単体棟未確定 |

No21の対象は `facility:kanto-south-integration-legacy-yachiyo-1` だけ。scopeは `user-designated-historical-site` とし、位置理由にも「旧敷地代表点」「単体棟・位置精度・利用条件は未検証」を表示する。現施設の位置・配布状態・関係は変更しない。実生成の旧窓口関係は `ended` のまま。

[追加許可の利用者原文](../../data/evidence/issue60/manual-user-additional/user-message.txt)、[訂正履歴と採用判断](../../data/evidence/issue60/manual-user-additional/decision.json)、[保存入力一覧](../../data/evidence/issue60/manual-user-additional/preserved-inputs.json)を保存。初回回答は `/tmp/kanto-remaining-answers.md`、No13訂正版の既往報告は `/tmp/issue60-recheck-six/user-report.json` と `/tmp/issue60-own-georef-other/assessment.json`、No21は `/tmp/issue60-recheck-chiba-nov6/human-report.json` から元bytesを保存した。recheck JSONは回答の要約であり会話原文とは呼ばない。今回は保存した最新利用者原文が採用値を明示している。原調査の「比較専用」「未承認」等は当時の記録として維持し、独立承認済みに書き換えない。

利用者指定経路は6施設の固定ID・指定数値・2つの判断記録に限定した。先行3件のdecisionと旧施設行hashは書き換えず、追加3件は統合後・追加前の[基準manifest](../../data/evidence/issue60/manual-user-additional/baseline-manifest.json)に結び付けた。判断記録の承認集合はそれぞれの3件に固定し、グループ間で承認を流用しない。独立承認ヘルパーには変更なし。manifest・原本hash・旧行hash・ID・参照・関係・bindingの検査を維持した。

## 実測と検証

保存一覧 `gkp-20261105.html`、評価日2026-11-06で実生成した。[生成・保護比較](../../data/evidence/issue60/combined-generation.json)を参照。

- 台帳1,586施設・1,670関係。全国未位置446、関東保留3（No43/45/46）、その他443。関東独立承認136、利用者指定6。43/45は別作業、46は保留を維持。
- 生成1,313カード・1,735施設・1,825関係。配布施設ピンは先行6件ブランチの1,134から1,140。双方の既存採用を合わせた追加前台帳では未位置449・関東6。新旧比較で全カード・全関係・既存ピン不変、変更施設は利用者指定6件のみ。
- 両親commitのdata配下の全ファイルをGit blob hashと照合し不変。37e6c4fa側18,975ファイル、b01c47d1側19,319ファイル。旧値provenance・歴史manifest・原画像も含む。新しい[統合残件索引](../../data/national/issue60/remaining-index-combined.json)を追加し、双方の旧索引を上書きしない。
- 追加3件未採用で差分テストRED、追加後GREEN。Issue60の影響範囲16テスト成功（44.355秒）。既存3件と先行6件の歴史テストは読取専用の履歴ビューで当時のmanifest・packagesを再現する。旧期待値や履歴hashを現在の件数で置換していない。
- No21のscopeでapprovalModeを削除した入力の拒否を追加テストし、RED→GREENを確認。初回撤回値と建物・中心点scopeへの誤変更も拒否する。
- full/splitの座標・未検証理由が一致。No21の旧窓口はendedを維持。web build（typecheck含む）成功。先行branchのUIテスト・ブラウザー成功記録を引き継ぎ、同じ全suiteは再実行しない。
- 通常commit hookでGo／全国Python全suiteと変更対象frontend検査を実施する。結果・最終commitは実装担当の報告に記す。手動の全suite重複なし。CLIの基準manifestを/tmp絶対パスで指定した初回は既存のrepo外パス保護で拒否されたため、メモリ上の読取入力で基準台帳を生成した。保護検査は変更していない。

## 文書との差・未確認

通常のAGENTS.md／REVIEW.mdの独立位置承認基準とは別に、今回の利用者判断を限定例外として適用した。位置精度・CRS・Google出典の利用条件を確認済みとはしていない。旧文書の現在件数は各基準時点の記録であり、統合後の値は新索引を参照する。生成の `confirmed` は採用状態であり独立位置検証成功を意味しない。構造化した未検証属性は原採用行・監査に、未検証理由は配信にも保持する。

既往のPMTiles外部README `./pmtiles@2.10.0/index.js` と実index `./lib/pmtiles@2.10.0/index.js` の差は引継ぎのみ。新たな文書・コード不一致は上記以外に発見していない。既存MapLibre大チャンク警告は残る。位置精度・利用条件・現地経路・在庫・現在配布継続・元画像の再配布条件は未確認。今回のブラウザー表示・実地図性能・CIは未実施。原本画像を配信へ追加していない。push／PR作成／merge公開／watchは実施せず、独立レビューは親担当へ引き継ぐ。
