# Issue60：衣笠商店街事務所1件の採用

基準main `44f84df1318bab2b51bd515f78d6d787fcac503f` から、承認された `facility:kanto-south-ec19477e52b814868f78` だけを35.2571552,139.6625254（GSI BldA589、building）として採用した。固定15件の承認入力・既存113件の採用出力・旧保留評価は変更していない。No11/13/14は未採用。採用判断は親から引き継ぎ、再審査していない。

[承認記録](../../data/evidence/issue60/kinugasa-followup/adoption-review.json)はreviewed HEAD `059ae372da8e7e9c65d0d526783ff552a70a8bf2`、独立Codex task `0d241474-9200-4843-9620-f1de26a08a21` を保存する。スレッド再取得は `thread_not_found` だったため、親の明示的な承認引継ぎを記録元とした。必須指摘なし、棟同定・代表点・逆投影・丸め内包の検証は継承。未知の絶対精度をゼロとせず、7.65m境界余裕を精度保証としない。

原候補のcompact SHA256は `58f5d1f71b0c355d1801c911c6c3b066ad797bd78056c368af2d585ff062be82`、assemble方式（JSONスペースあり）は `08870f6707008fc2cc8d72483b17837a1518ce58212ab4b9ef440d5f7a451b35`。共通評価のnormalized hashは `4624a179b682670e776eae22c94f45f6820a87825e7e41b2def49daaf159a7b6`。原本はbyte同一で `data/evidence/issue60/kinugasa-followup/original/` に保存し、[preservation.json](../../data/evidence/issue60/kinugasa-followup/preservation.json)で旧絶対パスと保存先・hashを対応付けた。元候補は一切変更せず、追補評価にのみ保存先参照・採用メタデータを付加。派生評価hashと拡張common hashをreview.jsonへ記録し、元承認・元入力hashへ遡れるようにした。原本は配信資産に含めない。

新packageは `data/national/issue76/kanagawa/kinugasa-followup/`。既存 `prepare_county` と `supersedes` を再利用し、旧保留assessmentのファイルhash、候補行hash、旧施設hashを拘束する。最新索引は [remaining-index-after-kinugasa.json](../../data/national/issue76/remaining-index-after-kinugasa.json)。台帳1,586施設・1,670配布関係を保持し、全国未位置475→474、関東保留32→31、採用113→114。

## 検証

- 対象未反映テストのREDを確認後、対象2テストと既存採用9テストがGREEN。固定15件の回帰テストはその時点のmanifestに限定して検証するよう修正した。期待値を現在値へ置換していない。
- 新追補 `issue60_kinugasa.py --check` と固定15件 `issue60_adoption.py --check` が成功。既存113件の採用出力はGit差分なし。原候補・保存資料hashを新追補の再現処理で検証。
- 11月5日保存一覧と `-as-of 2026-11-06` を揃え、採用前後を実生成。[生成差分](../../data/evidence/issue60/kinugasa-integration/generation.json)でピン1,111→1,112、対象以外の全施設・既存ピン・カード・実効配布関係不変を確認。新checkoutで不足した未追跡のmunicheck等は既存ローカル作業ディレクトリから補い、builddataの入力hash検査を通した。
- webで `mise exec -- bun run build` を実行。既存の大チャンク警告は残る。初回のルートでのbun buildは実行場所違いで失敗し、webで実施し直した。
- full/split各1件の詳細・Maps座標query・配布情報出典URL/確認日と配信世代hash検査が成功。[ブラウザー結果](../../data/evidence/issue60/kinugasa-integration/browser-result.json)。試験URLは http://127.0.0.1:4187/ 、検証終了後に自前サーバーを停止。位置由来は両形式のJSONで一致確認。
- 通常commit hookの非キャッシュGo全体検証（全国Python suiteを含む）が1回で成功（120.50秒）。手動の全suiteは重ねていない。検証commitは `bd450b9875e499f6db53811e8b9ee766265e2718`。ログ `/tmp/kinugasa-adoption-commit.log`、SHA256 `64522cc9f865199e1c78bbfb0f378971b12fa08aa450bec98d28c212afab4386`。この結果追記のみをamendし、検証対象コード・データは同一。

再現：`python3 -B https://github.com/aki05162525/manhole-card-map/blob/590fe84ce57b0c9a6f3ff28b41e888820a2168fb/tools/national/issue60_kinugasa.py --check`、`python3 -B tools/national/issue76_remaining.py --check data/national/issue76/remaining-index-after-kinugasa.json`。実生成はweb/READMEと同じ保存原本・基準日を指定する。

## 記述差と未確認

旧原調査の `adoptionApproved=false`・独立レビュー待ち・旧/tmp参照は研究時点の履歴として保持し、今回の承認と保存先対応で補う。既存文書の「最新索引」475/490/491件は各採用時点の記録で、今回474件の索引を最新とする。UIの「この配布情報の出典」は配布関係の出典であり、位置の由来説明は画面に表示されないためfull/split JSONで検証する。これ以外の新しい文書・コード不一致は見つかっていない。

2009図は現況測量図ではなく、1969沿革も現棟境界図ではない。利用者の約50×40mは街区説明で、589の約890㎡外形の面積ではない。No11の約5m移動という概算と約10mの数値差は原研究に保持し、未採用である。

現地・入口・室内窓口・外部Maps経路・当日在庫・スマートフォン性能は未確認。全原典・全タイル・独立承認の棟同定を再検証していない。配布状態を更新したものではない。利用者編集中の `/tmp/kanto-remaining-recheck.md` は変更していない。
