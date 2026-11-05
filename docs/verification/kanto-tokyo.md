# 東京都位置調査：全24件の実査と未承認候補（Refs #61 / #60）

基準main `4f5253b8973cb388deecff0bc051f36770e77579`、確認基準日2026-11-05。取得日時は各retrievalsに別記する。全24件について現配布案内・既往根拠・棟資料・数値外形の比較を実施した。未着手0件、外形内の候補17件、対象外形がない派生候補4件、棟選択未解決2件、信頼できる点を提案できない1件。**全件未承認、採用0件、共有manifest未反映**。外形内包は現配布棟同定の保証ではない。

全国assembleは1,586施設・位置未確定588施設のまま。独立Codexレビューは関東親が新しい担当へ依頼する。全受入未達のためClosesは付けない。初回23件未着手の記録はcommit `6710b7bcb252dda5b5b2ef75b72d7a6b634a8469` に保持し、本稿では今回の実施結果を示す。

## 対象と履歴

[inventory.json](../../data/national/kanto-prefecture/tokyo/inventory.json)に全24IDの旧place・全relation・索引履歴・JSON Pointer参照先と入力hashを固定した。都県名省略の小金井市観光まちおこし協会とコネクトすみだは、それぞれ運営者contact／connect原本の東京都住所を独立読解した。旧原本の取得日を維持し、再取得扱いにしていない。小金井の商工会検索結果は旧本町6-5-3を示すが、市配布案内と協会原本は松島ビル103。旧住所を現配布先へ上書きしない。

現台帳の東京都住所と13-で始まるカード関係から追加の位置未確定IDがないことを確認。全国588施設すべての所属を原本で再審査したわけではなく、住所もカード番号も手掛かりのない所属誤記の網羅検証は未完了。Issue16/20/25〜27の東京都個別追補は索引履歴にない。第1弾はcoverage、第2弾は選定除外の履歴であり、東京都の外形実査として数えない。第2弾南関東8件の承認を東京都の採用承認へ転用しない。

[継承取得記録](../../data/evidence/kanto-prefecture/tokyo/inherited-retrievals.json)の延べ121原本参照はhash一致。これは全内容読了を意味しない。Issue57の回答済みキューと24IDの交差は0件。初回は追加質問0件だった。今回の質問・回答訂正はhuman-questions.jsonへ分離した。自治体への連絡はしていない。


## 担当と成果物

[assignments](../../data/national/kanto-prefecture/tokyo/assignments.json)にnorth/east/south/west各5件、outer4件を固定。利用者の許可でClaudeへ並列委任し、5群とも調査完了。各群のoutcomesに実施・未確認・次作業、evidenceのinspection/retrievals/timingに読解範囲・原本hash・実測時間を保存した。親の統合検証と子の原本検証を区別する。

[全24件outcomes](../../data/national/kanto-prefecture/tokyo/outcomes.json)は群の原記録へのpointerとhashを持つ。[外形内17件の明示選択案](../../data/national/kanto-prefecture/tokyo/integration/footprint-selection-proposal.json)と[派生4件の保留案](../../data/national/kanto-prefecture/tokyo/integration/derived-held-selection-proposal.json)を分離。`approved` は既存manifestのフィールド名であり承認ではない。後者は内包未確認・導出方式と利用条件未確定のため適用禁止。前者も施設別の棟同定・製品CRS・独立レビューが残る。初回足立の提案と各群の原提案は改変していない。

## 全施設の結果と残る理由

すべてに製品固有CRSの適用判断と独立レビューが残る。以下の「外形内候補」は採用可の評価ではない。面積は水平外形の概算で延床面積ではない。補助PNG描画はringを塗り重ねるため穴の表示に限界がある。内包は保存PBFのgeometryで検証し、穴や全範囲の確認は共通描画のSVGも参照する。

|施設|区分|残る具体的理由|
|---|---|---|
|小金井市観光まちおこし協会|棟選択未解決|松島ビルが4550か4551かの確認。NAVITIMEは住所と徒歩分のみで建物同定に使わない。商工会検索の旧本町6-5-3は移転前の値として流用しない|
|丸吉玩具店|外形内候補・未承認|公式の店舗配置図がなく写真・マーカーからの推論。余裕1.68m。|
|ハンドメイドファクトリー マカロン|外形内候補・未承認|公式に棟を直接示す資料なし。|
|Hintmation|対象外形なし・派生点保留|製品に15号棟外形がなく外形内包で確認できない。|
|ヒノトントンZOO(羽村市動物公園)チケット売り場|外形内候補・未承認|外形2872とTICKET小棟の対応、外形2877と写真の不一致、製品測地系、独立レビュー|
|赤羽スポーツの森公園競技場|外形内候補・未承認|公式配置図がなく写真・寸法照合に留まる。トラック4670の帰属は未確定。|
|東京都虹の下水道館|外形内候補・未承認|製品CRS適用判断・独立レビュー未完了|
|秋川渓谷瀬音の湯|外形内候補・未承認|製品測地系、独立レビュー、706内の区画構成|
|荒川知水資料館 amoa|外形内候補・未承認|AREA MAPに方位なし。6頁写真は縮小読解のみ。|
|日野市環境共生部下水道課|外形内候補・未承認|marker精度・測地系は市資料に明記なし。隣接3315/3316/3318は同じ街区の別外形で用途未読。製品CRSと独立レビューが残る|
|URまちとくらしのミュージアム|対象外形なし・派生点保留|製品にミュージアム棟外形がなく外形内包で確認できない。|
|CADAN大手町|外形内候補・未承認|製品CRS適用判断・独立レビュー未完了|
|フレア五日市|対象外形なし・派生点保留|対象棟の外形が2026-07製品に未収録、配置図は概寸、Esri画像の日付と利用条件、採用方式の判断、製品測地系、独立レビュー|
|アイルしながわ|外形内候補・未承認|製品CRS適用判断・独立レビュー未完了|
|武蔵境駅北口QuOla内1階「DEAN&DELUCA」|外形内候補・未承認|フロアマップは模式図で店舗境界は測量ではない。2026年10月着手のJR東側駅ビルは検索要約のみで本文未読。製品CRSと独立レビューが残る|
|しながわ観光協会|外形内候補・未承認|製品CRS適用判断・独立レビュー未完了|
|コネクトすみだ[まち処]|対象外形なし・派生点保留|BldAに高架下店舗なし。桁位置が利用条件未確認APIに依存。|
|国指定重要文化財 旧三河島汚水処分場喞筒場施設|外形内候補・未承認|見学受付と旧事務棟の同一性が推論。|
|東映アニメーションミュージアムショップ|外形内候補・未承認|図の方位は明示なし。入口写真の方向は読取り推定。OSMの館nodeは5436南部で本比較と一致しないが、第三者点で採用根拠にしない。製品CRSと独立レビューが残る|
|総合レクリエーション公園サービスセンター|外形なし・点提案不可|数値外形・現況写真に新棟未収録|
|渋沢×北区 飛鳥山おみやげ館|外形内候補・未承認|図の年代不明。方位記号と棟配列の向きに約24度差。|
|滝山中央名店会(食祭館あまいけ2階)|外形内候補・未承認|模式図と区画の一対一照合、製品測地系、独立レビュー|
|荻外荘公園受付|棟選択未解決|受付が本体の見学者入口か、別の管理施設か。第三者投稿はチケット窓口での受領を記すが棟は不明。図と外形の幅差の原因（再移築部の未反映）は推定で未検証|
|一般財団法人足立区観光交流協会|外形内候補・未承認|製品測地系の明示宣言が未確認。3棟接続外形で南館単独境界は未復元。|

## 人手回答と独立照合

[human-questions](../../data/national/kanto-prefecture/tokyo/human-questions.json)に既往回答との交差、質問・回答・撤回を分離。旧三河島の受付＝旧事務棟、羽村のTICKET小棟、総合レクリエーションの新棟配置資料の3問は追加通知済み。回答を待たず統合した。小金井・荻外荘は回答済みだが解消していないため再質問しない。自治体への連絡はしていない。

小金井 `/association/` と荻外荘 `/1092823.html` は独立取得で404。利用者は推測URLと「管理休憩棟受付」という引用を撤回した。現配布案内本文は「荻外荘公園受付」である。独立取得したR1基本計画の6頁すべて（印刷頁19〜24）では受付券売の計画位置は北西側で、東側管理棟という主張を確認できない。これは計画図であり現在の受付棟確定にも使わない。現在の運営者案内図にも受付ラベルはない。[計画図追補](../../data/evidence/kanto-prefecture/tokyo/integration/ogikubo-plan-followup.json)に方位・年代・読解範囲を保存。小金井の公式移転告知は住所を確認できるが隣接2棟の選択までは解消しない。

## 検証と再現

[統合検証](../../data/evidence/kanto-prefecture/tokyo/integration/all24-integration-check.json)は実行前commit、コマンド、終了コード、入力hash、変更前後の全placeを記録。メモリ上の仮manifestで17件と4件を別試行し、変更ID完全一致、座標・evidence・locationReview以外のplace項目不変、全配布関係不変、実manifest不変を確認。4件の試行成功は採用承認ではない。最初の統合生成でlifecycleの必須events/groupsを欠き失敗したが、空配列を明示して成功した。共通実装の変更はない。

子の検証は原本hash、保存PBFの再decode、丸め前後の内包、Range同一ETag、提案hash/bindingを対象とする。north209項目、east27項目、west91原本・45タイル、south64取得記録・54タイル、outer36タイルの各ログを保存。取得失敗も記録に残し成功扱いしない。原本の未読頁・縮小表示・推論の範囲は各inspectionとcomparisonを参照。新規機能・共通コードの変更はなくRED→GREEN対象なし。全Python/非cacheGoは通常commit hookで一度実行し、手動で重複しない。研究資料だけのためUI/ブラウザー再検証なし。

親は取得記録の524 raw hash参照を再照合した。利用条件未確認のABR点重畳PNG2件は原hashのままdata/workへ移しGitから除外した（artifact-audit.json）。一般HTML/PDF/写真はGit無視されたdata/workのみ。レビュー環境ではretrievalsのhashに一致する原本が必要。公開するGSIタイルと派生図には加工・出典記録を保持する。アドレス点・地図サービス・UR図の利用条件が未確認のものを採用承認へ転用しない。PMTilesの版・ETagと一般仕様のJGD2011は記録したが製品固有宣言と同一視しない。個別建物の測量日や現況一致は不明。既知P3（Range不一致時metadata不足）は発生せず共通コード未変更。

時間は各群timingの実測区間を継承し、後付け配賦しない。northのUR共通資料はmuseum区間、westの複数市ABR取得は小金井区間、東映の計算一部は荻外荘区間に含まれる。eastの初回再起動区間は終了時刻を失い推定しない。未計測の共通読解や統合作業を施設別時間に足さない。速度向上率は測定していない。

## 文書・コード・原資料の差と引継ぎ

現行アプリ実装の新しい不整合は見つからなかった。以下は手順の適用範囲、旧記録、台帳と原資料の差であり、共有文書・台帳は変更していない。

- Issue57の「実タイルdecodeのみmapbox-vector-tile」は共通モジュールの依存の説明。今回のPMTiles取得コマンドは別途pmtilesを使う。初回3.7.0と一部子3.8.1の差を各実行記録で明示する。共通モジュールの説明自体が誤りとは断定しない。
- 旧足立の各階案内404は旧URLの結果。eastは現行R8全館案内を取得して南館4階を確認した。旧取得失敗を現在の停止理由にしない。CADAN旧500と虹の旧TLS/429も同様。虹は公開中間証明書をシステムCAで検証して取得し、TLS検証を無効化していない。
- 初回「管理事務所内のおみやげ館」と台帳住所に対し、運営者は「隣」、区地図は別棟。Hintmationとmuseumも14号棟と通路が介在し直接隣接ではない。初回未着手23件の記述は本稿とoutcomesで更新、inventoryの初回履歴は保持する。
- 羽村の台帳住所「羽村市羽村4122」に対し市公式は「羽村市羽4122」。飛鳥山とともに座標とは別の住所修正検討事項で、[住所修正検討案](../../data/national/kanto-prefecture/tokyo/integration/address-correction-notes.json)に旧値と提案値を分離し、今回は未適用。
- amoaの閉館時刻は区案内と館公式が異なる。URmuseumの館開館9:45と配布10:00、瀬音の配布18時までと季節別売店19時閉店は別の判断。滝山の旧名称不明カード休止を現行BJ・ピノコへ流用しない。旧三河島の終了告知はアースくんでD101ではない。
- 江戸川は同じ電話番号に富士公園／総合レクリエーションの名称差、駐車台数16／25の資料差、計画図の縮尺と現況画像に約295m／239mの差がある。新棟の写像残差約10mが半幅11〜15mに近く、点提案を見送った。
- ABR手順のcatalog.registries.digital.go.jpは今回NXDOMAIN。west/northは直接DCAT・CSVを取得。整備検討中という外部説明と取得可能な市別データは区別する。eastのコネクトすみだは利用条件未確認の地理院住所検索APIに依存するため保留し、04-geocodingの未採用方針を変更しない。
- QuOla（台帳・配布案内）とQuOLa（市報告書）の表記差は未修正。東京ミズマチ現行サイトは503で配置資料は2024年アーカイブ。赤羽台新棟・フレア・江戸川では製品に対象外形がなく、旧形状らしい外形を現棟として代用しない。旧南関東のJGD2011断定も今回のCRS承認には使わない。

## 初回のみのフック証跡（今回24件の検証とは別）

対象データcommit `5016cdd6a4ab2dcab959848763275dbc89acdc96`。`mise exec -- git commit` 終了コード0。下記は通常フックの実ログ（ANSI色のみ除去）。`go test -count=1 ./...` の `TestNationalAssemblyFailureGuards` が全国Python unittestを実行し、成功時はPython個別ログを出力しない既存仕様。入力hashはverification.jsonとこのcommitのGit treeで照合できる。以降はこの検証文書のみを追記し、データ入力・コード不変を確認する。

```text
╭──────────────────────────────────────╮
│ lefthook  v2.2.2   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  frontend ❯ 

┃  go-test ❯ 
+ go test -count=1 ./...
?   	github.com/aki05162525/manhole-card-map/cmd/addresses	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/builddata	77.911s
?   	github.com/aki05162525/manhole-card-map/cmd/fetchimages	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/fetchlist	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/inspect	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/listdiff	0.003s
ok  	github.com/aki05162525/manhole-card-map/cmd/municheck	0.005s
?   	github.com/aki05162525/manhole-card-map/cmd/ocrcheck	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue5/review-west-south	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue5/review-yokohama-priority	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/kyushu-okinawa	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-chugoku	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-hokkaido	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-kinki-west	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-koshin	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-kyushu-okinawa	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-south-kanto	[no test files]
?   	github.com/aki05162525/manhole-card-map/data/evidence/issue7/review-tohoku	[no test files]
ok  	github.com/aki05162525/manhole-card-map/internal/cardimg	0.003s
ok  	github.com/aki05162525/manhole-card-map/internal/gkp	0.004s
ok  	github.com/aki05162525/manhole-card-map/internal/municipality	0.003s

  ────────────────────────────────────
summary: (done in 78.77 seconds)
✓ frontend (0.03 seconds)
✓ go-test (78.77 seconds)
```
