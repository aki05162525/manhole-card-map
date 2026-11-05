# 茨城県位置調査：全18施設の再調査

Refs #65 / #60。確認基準日2026-11-05。取得日時・利用者回答の受領日時は別途記録する。今回の対象18施設すべてで、現配布案内・継承根拠・棟図または写真・数値外形の比較を実施した。**未承認候補17、棟外形の対応未確定1、未着手0、採用0**。共有manifestには反映していない。

[全18件の結果](../../data/national/kanto-prefecture/ibaraki/round2/outcomes.json)、[担当割当と8件の回答](../../data/national/kanto-prefecture/ibaraki/round2/assignments.json)から、各施設の原本読解範囲・方位・年代・周辺道路・面積・描画範囲・タイル境界・数値原本・限界へたどれる。土浦5、沿岸5、南部4、県担当4に重複なく分担した。全回答を記録済みで人手待ちはない。利用者回答は独立取得の事実と区別し、外形番号の追認を利用者による独立測量と扱わない。

古河は駅高架下の本体1階という回答を得た。市・観光協会の現案内と2017/2026写真を読み、9タイルと駅前広場・長大な平行外形を比較したが、JR公式構内図はHTML・画像とも403。高架下本体とホーム屋根のBldA対応が未確定で、長い屋根の重心を施設点にしない。回答済み棟質問は再質問せず、構内図原本の取得と外形対応確認が次作業となる。

守谷は初回候補を継承し、緑の基本計画135頁中PDF76頁（印刷72頁）の北記号・常磐道・北東の道路・市庁舎/図書館敷地を追加照合した。他頁は全文テキスト検索のみで全頁視認ではない。図書館の2026工事資料は年代差の確認に用い、増築後の外形不変とは主張しない。筑西の案内窓口は公式本文の「雑貨・ベーカリー棟」で、隣のトイレ・情報提供棟を除外。かわプラザ本体情報発信施設、雪入は位置案があっても配布休止を維持する。

今回の[locations案](../../data/national/kanto-prefecture/ibaraki/round2/locations-proposed.json)、[lifecycle案](../../data/national/kanto-prefecture/ibaraki/round2/location-lifecycle-proposed.json)、[明示選択案](../../data/national/kanto-prefecture/ibaraki/round2/manifest-selection-proposed.json)は初回の守谷のみの案を置き換える。**初回案と重複適用しない。** `approved`は現schemaの仮統合用キーで、承認を意味しない。[全18施設の旧値](../../data/evidence/kanto-prefecture/ibaraki/round2/old-values.json)も保存した。配布関係修正は今回の位置案に混入していない。龍ケ崎の既往代替配布提案は南部記録で区別して継承する。

製品CRSは初回の根拠と限界を継承する。最適化Vector固有の属性PDF全2頁を追加テキスト読解したが、測地系宣言はなく限界は解消していない。製品版・Range ETag/Last-Modified・raw hash・利用条件・加工表示を保持。自治体や施設のPDF/画像原本はignored workだけに置き、Gitは取得metadata、許諾条件を記録したGSIタイル、独自描画を保持した。各担当の時間記録は調査時点で記録し、共通整理時間や未計測区間を後付けで施設へ配賦しない。

県統合の[検証ログ](../../data/evidence/kanto-prefecture/ibaraki/round2/integration.log)は、18ID重複なし、17候補のschema・hash・binding、全台帳差分が17施設だけ、配布関係1,670件と他台帳項目不変を確認した。現manifestは全国未位置588のまま。仮統合571は未承認の計算値。各子は原本/hash/数値の軽量検証だけを行い、全suiteは県統合後の通常hookで一度実施する。研究資料のみなのでUI/ブラウザー検証は対象外。原本読解・棟同定・CRS採否の独立Codexレビューは親担当へ引き継ぎ、テスト成功では代替しない。

今回見つけた記録の食い違いは次の3点。共通コードは変更していない。

- 初回outcomesの「一中校舎4387」は誤記。公式資料では**土浦小学校校舎**。公民館4384自体は同じ対象で、原記録を保存したまま今回訂正する。
- 水戸の旧再開条件が指す協会accessは2026年の協会事務所移転先であり、駅内案内所とは別。今回は案内所専用公式ページを照合した。
- 旧保留条件にある室内点・施設固有マーカーの要求は、現AGENTSの建物代表点可という規約より厳しい。原判断は削除せず、現規約に従って棟を再照合した。

以下の初回記録にある「1施設比較・17未着手」「質問未送信」は当時の履歴であり、今回の結果ではない。

---

# 初回Draftの記録（以下はround2以前の履歴）

基準は main `4f5253b8973cb388deecff0bc051f36770e77579`、確認日2026-11-05。Refs #65 / #60。県全体の調査完了ではない。共有manifest・共通コード・既存台帳を変更していない。

現assembleの1,586施設中、全国位置未確定588。茨城県カード（08-）に関係する57施設は、既採用39・未位置18。住所「茨城県」と08-カード関係の二通りの抽出で未位置ID集合が一致した。GKP保存原本の08-一覧と施設住所を照合し、県名省略の結城蔵美館・結城市都市建設部下水道課は既採用なので対象から除外した。協会事務所の移転を観光案内所移転と読み替えない。

[対象・入力hash](../../data/national/kanto-prefecture/ibaraki/selection.json)、[全18施設の次作業](../../data/national/kanto-prefecture/ibaraki/outcomes.json)、[全履歴への参照・hashと原本取得履歴](../../data/evidence/kanto-prefecture/ibaraki/history.json)を保存した。索引内の全JSON pointerを解決し、参照ファイルと成功取得HTMLのhashを照合した。これは全過去図面の目視再レビューを意味しない。Issue16/20/25〜27・batch1/2の索引が持つ履歴を削除していない。Issue57人手キューに対象18IDと一致する回答はなく、回答済み34グループを再質問していない。

今回の追加外形比較は守谷1施設。未承認候補1、採用0。他17施設は履歴・保存本文の抽出確認までで、今回の外形比較は未着手。既存資料不足や外形未収録と新たに判定していない。土浦市立一中地区公民館の第2弾比較履歴も保持し、未調査だったとは扱わない。施設ごとの次資料・比較対象はoutcomesに記した。県の完了率や位置確定率の改善は主張しない。

## 守谷市役所の候補

対象は `facility:kanto-north-45e8eab7ba6d2bdde8e5`、カード08-224-A001の休日配布先。市の保存配布本文は市役所警備室、本庁舎案内は議会棟1階と明記する。平日の上下水道事務所は別所在地。休日関係は現台帳ですでにactiveで、修正候補はない。在庫・現地稼働の新規確認はしていない。

取得した公式1階PNGとPDF全1頁を目視した。PDFの内部Titleは2026-01-05版を示す。北矢印はないが、東側・西側・南側玄関の文字を方位の根拠にした。2階・3階図は未取得・未読。

GSI最適化Vectorの3×3タイルを取得し、建物・道路・水部を共通格子へ配置した。南西の斜め長棟である議会棟、北の行政B棟、東の行政C棟、南東の扇形D棟、中庭の並びを比較。公式図の角形の議会棟南東端と数値外形の丸み、行政A棟西辺の角度には模式化の差がある。公式図に周辺道路・図書館が載らないため、それらの名前付き独立照合は残る。形の比較を原本の測量精度と取り違えない。

候補は緯度 **35.9509455**、経度 **139.9752617**。z16/58249/25746のBldA feature[111]、tile格子の内部点[2944,354]を手動で選んだ。庁舎全体の重心ではなく、議会棟部分の代表点。警備室の室内位置や入口を測量した値ではない。

[数値・geometry・旧P05比較](../../data/evidence/kanto-prefecture/ibaraki/moriya-geometry.json)に、元点と小数7桁丸め後の内包を保存した。選択点は外形境界から約8.61m、選択fragmentは約3,168m²。ただし北側bufferで切れたfragmentの面積で、議会棟単独または庁舎全体の面積ではない。北隣も取得・描画し、議会棟部分は選択fragment内に収録される。旧P05市役所点・守衛室点は議会棟より北にあり、採用元に使っていない。

[観察記録](../../data/evidence/kanto-prefecture/ibaraki/moriya-observation.json)、[全域SVG](../../data/evidence/kanto-prefecture/ibaraki/moriya-all.svg)、[詳細PNG](../../data/evidence/kanto-prefecture/ibaraki/moriya-detail.png)を参照。SVGはbufferを含め全地物を描画、詳細PNGは比較範囲だけを切り出す。青線はタイル境界。ラベルはタイルごとのBldA indexであり全国一意IDではない。一般の市PDF/PNG原本はignored `data/work/kanto-ibaraki/` に保持し、Git・ブラウザー配信資産に追加していない。取得日時・原本hash・原本の絶対保存先は[取得記録](../../data/evidence/kanto-prefecture/ibaraki/retrievals.json)にある。

## CRS・利用条件と独立レビューへの引継ぎ

[製品条件](../../data/evidence/kanto-prefecture/ibaraki/source-conditions.json)と[Range取得記録](../../data/evidence/kanto-prefecture/ibaraki/vector-retrievals.json)を保存した。製品固定READMEは2026-07-01版、PMTiles応答はETag/Last-Modifiedの一致を確認。9タイル原本を県専用evidenceに保存した。GSI規約等は北関東batch2の実rawをhash照合して再利用し、原取得日時と再利用日時を分離した。

固定READMEは地理院タイルと同じ配信方式とし、リンク先一般仕様が国内JGD2011を示す。ただし製品自身の直接的な測地系宣言ではないため、最適化版への適用判断は独立レビューへ残す。逆投影式だけで承認しない。格子はWeb Mercator、x東/y南、出力lat/lng、測地系変換なし。小数7桁は測量精度ではない。製品READMEからコンテンツ規約への直接リンクとPDL1.0の適用、出典・加工表示を確認した。一般市原本の再配布条件とは別判断。

[locations案](../../data/national/kanto-prefecture/ibaraki/locations-proposed.json)、[lifecycle案](../../data/national/kanto-prefecture/ibaraki/location-lifecycle-proposed.json)、[明示選択案](../../data/national/kanto-prefecture/ibaraki/manifest-selection-proposed.json)、[旧値](../../data/evidence/kanto-prefecture/ibaraki/old-values.json)は**未承認・manifest未反映**。schemaの`approved`キーは仮統合検査用の形式であり、採用許可ではない。

親のCodexレビューでは、公式周辺図または図書館を含む独立資料による道路・隣棟の対応、CRS適用、議会棟内部点の再計算を優先する。確認日を更新せず、原本の読解をテスト成功で代替しない。親が承認後に共有manifestへ順次統合する。今回は人手質問の送信、自治体への連絡、watch、mergeを行っていない。

## 検証・時間・不一致

既存assembleにメモリ内だけで選択案を追加し、差分が守谷1施設のみ、配布関係1,670件が完全一致することを確認した。仮統合なら未位置588→587だが、実manifestの全国値は588のまま。[検証記録](../../data/evidence/kanto-prefecture/ibaraki/validation.json)に入力hash・コマンド・終了コード・ログを対応させる。データと調査文書のみの変更で、新しい機能・修正コードはないためRED→GREEN対象なし。全suiteは通常commit hookの`go test -count=1 ./...`（内部で全国Python）を利用し、手動で重複実行しない。UI/ブラウザー検証は変更対象外。

[時間記録](../../data/evidence/kanto-prefecture/ibaraki/timing.json)は機械処理と手作業を分離。最初の守谷壁時計区間には共通の全県確認が混入したため施設専用時間としては使えない。後付け配賦しない。代表点計算以降は守谷の専用区間として計測した。時間短縮率・施設別総時間の比較には使わない。

本追加で新たに確認した文書/コード不一致はない。既往の北関東READMEとEvidenceの`fetchedAt`契約差等はissue57-workflowと原履歴の参照を継承し、今回解消したとはしない。一般原本の保管場所はこのworktree固有で、別マシンで独立レビューする場合はhash指定で原本を共有または再取得し、取得版の違いを記録する。

## 実行後の検証証跡

対象commit `4f9fdd47a7ac39f74e763e3c7e27ad296695ef3d`。`mise exec -- git commit -m 'research: record Ibaraki scope and provisional Moriya building point'` は終了コード0。通常hookによる`go test -count=1 ./...`成功、所要82.06秒。`cmd/builddata/fragments_test.go:59`が全国Pythonの`unittest discover`を必須実行するため、その成功も含む。Goの通常出力は成功時のPython個別ケースログを表示しない。

`validation.json.commitHook.status=pending` はcommit前に保存した履歴で、この節が実行後の確定記録。validation.jsonのinputSHA256全件がこのcommit時点のbytesと一致することを再確認した。この追記は文書のみで、データ・コード・manifest・テスト入力は同一のため全suite結果を継承する。hook自体は後続文書commitでも通常実行する。

hook標準出力（ANSI色指定を除去。gitの作成ファイル一覧は除外）:

```text
╭──────────────────────────────────────╮
│ lefthook  v2.2.2   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  frontend ❯

┃  go-test ❯
+ go test -count=1 ./...
?   	github.com/aki05162525/manhole-card-map/cmd/addresses	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/builddata	81.046s
?   	github.com/aki05162525/manhole-card-map/cmd/fetchimages	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/fetchlist	[no test files]
?   	github.com/aki05162525/manhole-card-map/cmd/inspect	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/listdiff	0.004s
ok  	github.com/aki05162525/manhole-card-map/cmd/municheck	0.006s
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
ok  	github.com/aki05162525/manhole-card-map/internal/gkp	0.005s
ok  	github.com/aki05162525/manhole-card-map/internal/municipality	0.004s

  ────────────────────────────────────
summary: (done in 82.06 seconds)
✓ frontend (0.03 seconds)
✓ go-test (82.06 seconds)
```
