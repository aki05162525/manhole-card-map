# 北関東：位置調査第2弾（Issue35、PR51修正）

基準commit `f66b7e994ef250fadee78f396d22fdfc40ba6a83`、評価日2026-11-05。開始時はIssue24 originalRefで北関東91ID、第1弾baselineとの一致と未採用をassembleで検証した。全国608は開始時集合。Issue24保存分類はactive78・suspended12・ended-only1で、当日の在庫確認ではない。

選定8件のうち**2件を採用候補として仮統合、6件を保留**。独立再レビュー未完のため採用承認はまだない。最新main `65e7b2f7`（北海道PR56と近畿西PR45の3採用を含む）統合後、北関東仮統合で地域未位置91→89、全国605→603、配布施設ピン981→983。開始時全国608とは区別する。全関係と既存ピンは不変。未選定83件は未調査である。

[selection.json](../../data/national/location-batch2/north-kanto/selection.json)は8IDを最初に保存した記録を維持し、当初予定と実施手法を分離した。公開CSVを実施済みとは扱わない。[coverage.json](../../data/national/location-batch2/north-kanto/coverage.json)に91件の除外理由と保留参照を保持。ぱりっせ/入間2窓口の選定判断補足は事後明文化と明示した。

## 実照合の結果

| 施設 | 実照合と判断 | 停止・再開条件 |
| --- | --- | --- |
| 土浦市立一中地区公民館 | 公民館平面図の1階駐車場・2階事務室・3階集会室を確認し、GSI周辺外形を描画。学校の大外形4387と隣接する矩形4384等があり、方位・周辺道路のない室内平面図から公民館の外形を独立に選ぶ対応が不足。旧地図点をcontainsするだけでは採用しない。 | 今回取得した資料だけでは現配布棟と再利用可能な数値原典を結べないため採用停止。 地理的に接続できる公民館周辺配置図、または競合する両点の原典・建物対応を取得する。 |
| まちの駅 新・鹿沼宿 | 市と運営者の施設概要から本館案内処・物産館を区別。営業情報画像は2026年4月1日以降の本館/物産館の区分を示すが配置図ではなかった。運営者の数値地図はGoogle埋込であり抽出せず、本館の外形対応は未成立。 | 今回取得した資料だけでは現配布棟と再利用可能な数値原典を結べないため採用停止。 本館を名指す配置図と道路・外形の対応を取得する。Google埋込値や施設全体の旧マーカーを本館点として流用しない。 |
| 一般社団法人 矢板市観光協会 | 市PDF24999の4頁は2026年10月26日以降に宿泊棟受付を通る経路、5頁は観光協会受付を示す。運営者館内図は宿泊棟と2号館を同じ並びに表示。数値外形では北の長棟892と南の長棟900・接続部899を確認したが、館内図に北・河川・道路の参照がなく、宿泊棟の並びを892へ割り当てる独立根拠が未確定。アクセスPDFのGoogle航空写真の座標は使用しない。16945.pdfの404のみを保留理由とした初回判断を訂正。 | 宿泊棟/2号館の並びを北側外形892へ接続する独立した周辺配置根拠が不足。 宿泊棟を名指す地理的周辺配置（道路・川等）を取得し892/900の対応を確定する。入口・窓口測量は不要。 |
| 日立市役所下水道課 | 市報9頁の北側道路、西側道路・水路、東側国道6号と、本庁舎/大屋根/ホールの順序をGSI外形に照合。本庁舎は西の矩形（BldA index241）、大屋根は東の穴を持つ外形274、ホールは275。現配布案内は本庁舎6階海側下水道課を指定。市HTML qは矩形内、P05は西側で外形外（hitachi-conflict.json）。qは比較専用で、座標は独立同定したGSI矩形の重心から派生。 | 独立再レビュー未了の間は仮統合。重大指摘が残れば採用しない。 新規Opusレビューで建物同定・原典・派生計算・全差分の判断を確認する。 |
| 熊谷駅観光案内所内 | 2026年市資料の北口/南口、アズ本館/アズセカンド/Tiara、改札正面の観光案内所とGSI周辺を照合。北口広場と東側Tiara8003は対応する。数値外形7981はアズ本館と北側駅建物をまとめ西タイル5899へ続く。案内所は構内図の本館西側コンコースにあるが、7981と南の平台屋根7982のどの外形が案内所を含む駅舎の建物単位かはこの概略図だけで確定できない。旧点や商業棟全体重心は採用しない。 | 案内所を含む建物単位を、商業棟・平台屋根に分かれる数値外形へ一意に対応付けられない。 駅構内図の案内所を含む建物と、再利用可能な建物外形の対応を確認する。室内窓口の測量は不要。 |
| 羽生市三田ヶ谷農林公園 キヤッセ羽生「ムジナモ市場」 | 初回の「3棟」を訂正。園内図の4主要棟は、北西の斜めのバーガー棟1454、北東の事務所/体験棟1462、南西の縦長ムジナモ市場1456、東隣の横長加工棟1458に対応。西外周道路の北側入口/南側出口、中央を蛇行する水部、東側周回路と円形丘の配置も一致し、単なる形の類似や点containsでの選択ではない。現市配布案内も市場を指定。市場外形の重心を採用候補とし丸め後内包を確認。 | 独立再レビュー未了の間は仮統合。重大指摘が残れば採用しない。 新規Opusレビューで建物同定・原典・派生計算・全差分の判断を確認する。 |
| 道の駅かわもと 深谷市物産館 | 市施設案内では物産館1280-1とJA直売所1279-2を区別。県ガイドは物産館内の写真と駅全体の略図を掲載するが、敷地内の2棟の位置を示さず、住所欄も駅全体1279-2。2026年10月移転後の配布先建物を外形に対応付ける根拠には不足。 | 今回取得した資料だけでは現配布棟と再利用可能な数値原典を結べないため採用停止。 物産館を名指す配置図を取得し、直売所との別棟対応と現配布案内を照合する。駅全体点を流用しない。 |
| 白岡市役所仮設本庁舎 商工観光課 | Issue16で既取得の広報28頁を再利用し、2026年版GSI外形/道路/水部と新たに照合。旧市役所3081、生涯学習センターこもれびの森3080、南側のはぴすしらおか3441と道路配置は対応する。広報が示す「はぴの東・来庁者駐車場の南」の仮設庁舎区画には一致する外形がない。東側の小外形3148/3149を大型仮設庁舎へ流用しない。版の日付は個別仮設棟の収録保証でなく、旧P05も非採用を維持。 | 配置図から特定した仮設庁舎区画に対応する数値外形が未収録。 2025年12月開庁の仮設棟を収録する数値外形・施設点と広報配置図を照合する。旧本庁舎と区別できることが必要。 |

## 原典・再現・権利

[comparison-facts.json](../../data/evidence/location-batch2/north-kanto/comparison-facts.json)に6施設の比較対象地物、tile/index/原形、描画・デコードhashを記録。[revision-windows.json](../../data/evidence/location-batch2/north-kanto/revision-windows.json)の54タイルを`revision-scan.py`で取得/デコードし、`render-revision.py`で道路・水部・注記も比較した。地物番号はその固定順による作業番号で恒久IDではない。粗い探索窓中心は施設点ではない。

日立の市HTML qとP05の実数・距離・内包結果は[hitachi-conflict.json](../../data/evidence/location-batch2/north-kanto/hitachi-conflict.json)。qは競合検査専用で採用根拠にはしない。日立と羽生の採用候補は独立同定したGSI BldA外形から計算し、[geometry-inputs.json](../../data/evidence/location-batch2/north-kanto/geometry-inputs.json)と保存PBF2タイル、`derive.py`から再現できる。両重心は外形内、丸め後も内包。入口・窓口測量は要求していない。

[取得記録](../../data/evidence/location-batch2/north-kanto/retrievals.json)はURL/取得日時/HTTP失敗/hash/版を保持。一般HTML/PDF/画像の再配布条件は未確認なのでworkだけに保持した。引用ではなく事実抽出をGitへ保存。PBF2タイルはPDL1.0に従い出典・加工表示を付けて保存する。最適化Vectorは基本測量成果ではない試験公開であり、ラスターの利用条件を流用していない。

[CRS・利用条件](../../data/evidence/location-batch2/north-kanto/source-conditions.json)に一次仕様の参照を追記。地理院タイル仕様の国内JGD2011とメルカトル格子、Vector定義の同仕様への参照を確認。タイルx東/y南・extent4096を逆投影しlat/lngへ保存する。測地系変換はせず、小数7桁は精度保証ではない。データ版2026-07-01・HTTP更新2026-09-17は個別建物の測量日ではない。

## 既往保留・新規性

Issue16白岡`group-a-outcomes.json#/outcomes/8`と吉岡`#/outcomes/3`を引き継いだ。白岡広報PDFは同じURL/hashの既取得資料で、新発見とは呼ばない。既往の「画像と新外形で再開」の条件に対し、画像と2026年GSI外形を実際に照合し、仮設棟外形がないため継続保留とした。吉岡の県CSV再検索は行わず、現庁舎と隣接施設の区別を再開条件に残す。小山2窓口、Issue20/25/26/27、第1弾integration/followupsの保留も維持。

[source-novelty.json](../../data/evidence/location-batch2/north-kanto/source-novelty.json)はlocation-batch2を除いたGit既往テキスト全体でURLを検索する。PDF本文・ignored rawは未網羅で、未発見は新規性の完全証明ではない。URL別発見時刻は保存されておらずnullとした。取得時刻を発見時刻に代用しない。初回選定保存後に検索・取得した順序と、詳細な時刻記録不足を区別する。

## 仮統合と検証

[locations.json](../../data/national/location-batch2/north-kanto/locations.json)の2行をmanifestで明示し、[location-lifecycle.json](../../data/national/location-batch2/north-kanto/location-lifecycle.json)でidentity/adoption/hashを結び付けた。対象は日立`facility:kanto-north-2e945c5e9faf1a16c8d7`と羽生`facility:kanto-north-c73669beeeb24f667599`だけ。元施設の座標はnull、台帳差分はcoordinate/evidence/locationReviewのみ。元台帳の旧値/hashは`old-values.json`、生成後の旧値hashと生成差分は[generated-check.json](../../data/evidence/location-batch2/north-kanto/generated-check.json)。

採用差分テストはmanifest追加前に3failure、追加後に成功。`test_location_batch2_north_kanto.py`は実manifestの2施設・bindingと6非採用、全関係/他施設不変を検査する。共有`test_assemble.py`はmain側の`batch1_manifest`ヘルパーへ統一し、現mainに対する差分はない。3履歴テストで第2弾を除外する意味を保持し、844等の期待値/digestは不変。北海道・近畿西の採用/binding/地域テストも保持。各地域テストは各自のprefixだけを除いたmanifestと比較する。

`vector-scan.py`のキャッシュ再実行失敗を再現後、保存provenanceの復元・hash検査・版混在拒否へ修正。`check-cache.py`でネットワークなしの再利用成功、provenance欠落とhash改竄の拒否を確認した。

実施結果は[validation.json](../../data/evidence/location-batch2/north-kanto/validation.json)。統合後Python全96テスト、Go `-count=1` が成功（終了コードを直接確認）。`verify.py --with-work`は159原本/Range/タイル参照、母集団、旧保留の許可再開、旧台帳と正確な差分を検証。builddataは保存一覧20261021・review-list20261105・as-of2026-11-05で前後生成し全国監査も成功。full/details/pinsとmanifest/世代hashが一致、全カード/関係/既存ピンが不変。

[Maps検査](../../data/evidence/location-batch2/north-kanto/maps-check.json)は生成detailsの2施設・実関係をUIの`facilityMapLink`へ渡して確定座標リンクを確認した。外部Maps遷移・ブラウザー操作・現地ナビは未検証。UIコード変更/サーバー起動はない。フックは省略しない。

## 時間・独立レビュー

初回345.762秒は選定保存から初回結果JSON作成までの地域共有壁時計時間で、事前資料読み・レビュー・PRを含まない。今回の修正調査/検証は`outcomes.json.revisionMeasurement`へ別記した。施設別に重複計上せず、全国所要時間へ外挿しない。

Gemini利用枠超過の失敗は[review.json](../../data/national/location-batch2/north-kanto/review.json)に初回履歴として保持。ユーザーによるClaude Opus代替許可と旧Opus重大指摘・対応は[review-response.json](../../data/national/location-batch2/north-kanto/review-response.json)へ別記。旧レビュー時点の全件保留は`initial-outcomes.json`の履歴に限定する。新規Opus独立再レビューが完了するまでDraft/マージ保留。マージとCI監視は親担当。

## 文書とコードの不一致

旧Issue5北関東READMEの正確な記述は「今回読んだ範囲では発見していない」で、初回の「不一致なし」という引用を訂正した。旧assemble.pyはEvidenceにfetchedAtを追加するが、現Go Evidenceは7項目。旧コード/文書は保持し、今回の取得時刻は調査メタデータへ分離した。

初回文書の3棟・道路未照合・全件保留・manifest不変、および既往URLを新規とする説明は今回の照合結果へ訂正。履歴ファイルの値は当時の記録で、現成果に適用しない。現地/在庫、未選定83件、一般原本の再配布許諾、鹿沼/深谷の数値外形は未確認。

### 再レビュー起動結果

統合済みhead `496689ee9941d0fd47f1037b1593eff730bef5f6`をClaude Opus 5.5へ新規独立再レビュー依頼したが、`Claude API rate limit reached. Try again later.` で失敗した。レビュー結果・採用承認は得られていない。`review-response.json.reReviewAttempt`へGemini失敗とは別に記録。2件は仮統合、6件は保留を維持し、Draft解除・マージは行わない。今回の追記は失敗履歴と文書の整合のみで、座標・manifest・binding・コードに変更はない。

最新main65e7b2f7統合後、ユーザー許可によりAntigravityのClaude Opus 5.5へ新規再レビューを依頼する。旧Claude失敗は終了済みで、実行中レビューとの重複はない。初回608・統合基準605・北関東効果2件（仮統合後603）を区別する。

head `dbbdd141e59b2aad4383924b58fd1c91341c7f22`に対するAntigravity Claude Opus 5.5の新規再レビューも利用枠超過（`You have reached your Antigravity quota for this period.`）で失敗した。`review-response.json.antigravityOpusAttempt`へ別記。実行中レビューはなく、独立再レビュー未完・2候補未承認・Draft/マージ保留を維持する。
