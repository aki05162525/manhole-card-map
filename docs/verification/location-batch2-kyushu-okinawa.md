# 第2弾 九州・沖縄の位置調査（Issue #44）

2026-11-05、基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83`。初回Opusレビューの重大指摘を受けて原本と数値外形を再調査した。Gemini 3.8 Flashの独立最終レビューで5候補が承認され、**選定8施設、提案5施設・採用5施設（4建物）、保留3**となった。最新main `93904c720fc2b279db26ff3a9329fcf2855c2311` を取り込み、5IDだけをmanifestとlocationLifecycleへ明示選択した。全配布関係・既存ピンは不変。地域全件を解決したという意味ではない。

## 母集団・計画と実績

[selection.json](../../data/national/location-batch2/kyushu-okinawa/selection.json)の選定8IDは変更していない。`createdAt`は初回ファイルの記録時刻で、Web探索より前だったことを独立に示すログはなく、旧文書の断定を撤回する。選定理由は計画、実施結果は[outcomes.json](../../data/national/location-batch2/kyushu-okinawa/outcomes.json)・取得記録で区別する。

Issue24 snapshotの`originalRef`が地域原記録を指す66IDは、すべて第1弾baselineに含まれる。基準manifestをassembleすると既採用の大分市美術館1件を除いて地域未位置65件、全国台帳内未位置608件。これは開始時集合であり、採用後の推計ではない。統合基準mainの全国台帳内未位置595件から今回5ID採用で590件、地域は65→60件。開始時608件からの他地域効果13件と地域効果5件を分離する。生成全体の未位置744→739件は台帳の595→590件と別集合。

[coverage.json](../../data/national/location-batch2/kyushu-okinawa/coverage.json)は全66IDを分類する。選定8、既採用1、第1弾保留6、終了のみ1、今回見送り50。内訳を検証スクリプトで検査する。#20・#25・#26・#27の保留と選定8IDの重複はなく、第1弾熊本・大分6保留は再開しない。Issue16の地域4ID（徳之島2、北谷観光情報センター、未選定の北谷博物館）は参照と旧結果を継承した。未選定を重要性なしとは扱わない。

## 実照合の結果

同定の肯定・否定根拠は[facility-identification.json](../../data/evidence/location-batch2/kyushu-okinawa/facility-identification.json)、数値外形と周辺棟は[building-comparisons.json](../../data/evidence/location-batch2/kyushu-okinawa/building-comparisons.json)、代表点の計算結果は[derived-points.json](../../data/evidence/location-batch2/kyushu-okinawa/derived-points.json)。建物代表点が基準で、入口・室内窓口測量は要求しない。初回の不足した結論は`initial-outcomes.json`に履歴として保存し、現在の根拠には使用しない。

| 対象 | 原本と数値外形の照合 | 現判断 |
| --- | --- | --- |
| 徳之島町役場建設課・新庁舎1階宿直室（別ID） | Issue16の開庁案内p1を継承。海・道路の向きに合わせ、新庁舎が旧庁舎跡の南、消防署の北、海沿い道路の西にある配置と現外形を照合。旧P05点は連結外形から10.607m外。連結外形には普通無壁舎3111が含まれるため、候補は堅ろう建物3102の425.146㎡だけから算出。図に宿直室も明示される。模式図に北矢印・縮尺はなく面積比較には使わない。 | 同棟2IDを採用。既存の各配布関係は保持。同住所という理由で点を複製していない。 |
| 諫早物産ホール | P05 feature419は2256.242㎡外形内、518は5.808m外。商工会議所アクセス、観光協会イベントちらしの市役所北・本明川南・東側道路西という街区、商工会議所3F図の非対称な曲線側を照合。3F図の方位と階ごとの形の差は単独では証明できず、案内地図を併用。 | 採用。P05座標は採用せず、独立同定したGSI外形の穴を除いた重心を使用。 |
| 知名町役場上下水道課 | 北隣16/56174/27590を含む3×3タイルを再取得。2024パンフp3は1階08番、p6は庁舎1553.06・北車庫A193.09・西車庫B167.19・南車寄せ63.02㎡。Vectorは約1513.5・181.5・155.2・59.5㎡。四棟の方位、周回道路、南側駐車場を併せて照合。 | 採用。定義・軒・簡略化による面積差は残るが、面積だけの選択ではない。屋根形状を「中庭」とした推測は撤回。 |
| あまわりパーク観光ターミナル | 令和5年度管理仕様書p1-2の約230㎡小棟を、2タイル結合外形233.504㎡と照合。大型歴史文化施設の東、池の西、駐車場との間という配置と、空撮の周辺建物群も対応。大棟の建築面積とVectorの部品面積は厳密一致ではない。 | 採用。2013測量点・レビュー概算からの座標転用なし。 |
| 北谷町観光情報センター | 条例・施設ページに加えIssue16のBODIK AED経路を再取得403。別の町AED表PDFを取得したが座標なし、対象施設行なし。行の不在を未設置とは判断しない。 | 保留。対象行の位置原典、または固有の配置図と現外形の照合が必要。 |
| 名護市営市場 | 初回探索で得た指定管理資料・掲載先は404。原本を取得できておらず、PDF抽出・画像確認を実施したという共通文言は誤りだった。 | 保留。原本再公開・移転先資料を取得し、市場建物と数値資料を対応付ける。 |
| 第一牧志公設市場のまちぐゎー総合案内所 | 市の新築工事概要（2022年9月名PDF）を新取得。配置図で仮設市場は北西別区画、計画地は市場本通り沿い。現2タイル結合外形1378.136㎡は計画地と南東の欠けに概ね対応。ただし新築1545.21㎡との差約10.8%、新築図とVectorの角切り方向の違いを解消できない。 | 保留。新築後の外形かが未確定。公式qは探索のみ。新築外観・竣工配置等で形の差を説明するか別数値外形を得て再開。階別図復旧・窓口位置は条件にしない。 |

採用5IDの旧行・旧値・hash・承認時proposalは[candidates.json](../../data/national/location-batch2/kyushu-okinawa/candidates.json)、地域原行とhashは[prior-values.json](../../data/national/location-batch2/kyushu-okinawa/prior-values.json)。実選択は[locations.json](../../data/national/location-batch2/kyushu-okinawa/locations.json)と[location-lifecycle.json](../../data/national/location-batch2/kyushu-okinawa/location-lifecycle.json)。徳之島2IDは開庁配置図を根拠に同棟groupへ明示登録した。5施設IDと4建物を区別し、IDや配布関係は統合しない。

レビューhead `53e664dc` の座標・原本・採用証拠は無変更。`candidate-lifecycle.json`、evidenceの`derived-points.json`/`facility-identification.json`にあるproposal/pendingはレビュー前段階を固定した履歴フィールドで、現在の採否は`outcomes.json`/`review.json`とmanifestを参照する。証拠hashを変更して承認対象をすり替えない。

## 数値原典・加工・権利

初回の知名南タイル1枚は保存したまま、追加45タイル（5地点の周辺3×3）を同一PMTiles ETagで取得した。[recheck-vector-retrievals.json](../../data/evidence/location-batch2/kyushu-okinawa/recheck-vector-retrievals.json)は182 Range要求の開始・完了・206・長さ・hashを保存する。[recheck-tiles.json](../../data/evidence/location-batch2/kyushu-okinawa/recheck-tiles.json)は抽出tileのhash・版metadata・探索ヒントの由来を持つ。Google表示中心、P05旧位置、レビュー概算は範囲探索だけに使用し、同定や採用数値にはしない。

原典は国土地理院最適化ベクトルタイル。公式READMEを再取得し2026-07-01版、PMTiles metadataの26-07を確認。個別建物の整備時点・実測精度は未確認。試験Vectorは基本測量成果ではないという公式位置づけ、利用規約PDL1.0、出典・加工表示を確認し、ラスターから条件を推定しない。README・規約の再取得hashは第1弾保存原本と一致。一般HTML/PDF/画像の原本は許諾未確認のためworkだけに保持する。Gitには事実抽出・取得記録・許諾された必要範囲のVectorを置く。

MVTはextent4096、y-down、z16。各tileのバッファをtile矩形で切り、全体格子へ平行移動して断片を結合。逆Web Mercator後のJGD2011経度/緯度をEPSG:6668、GRS80の局所AEQDに変換し面積と重心を求める。重心が外・穴なら内代表点を使う処理だが今回の選択5外形は全て重心が内側。逆変換し小数7桁へ丸めた点も内包を検査。WGS84への測地系変換なし。7桁は計算再現用で測量精度ではない。レビュー本文のCRS断定を一次原典とは扱わず、保存された原典と加工前提・限界を維持する。EPSG:6668は地理座標系であり、局所AEQD自体のEPSG番号ではない。出典・加工表示は派生JSONにも収録した。

`compare-buildings.py`は周辺外形の探索用、`derive-points.py --check`は選択外形と文脈外形を原tileから再構成し、地物種別・hash・穴・導出結果を検査する。徳之島で無壁舎を含む連結外形と庁舎部分を分離した。`verify-p05.py`は保存済み全国P05原ZIPのhashと該当3地物を直接読み、内外と距離を再計算する。レビュアーの概算数値・一時画像を派生原典にはしない。

## 記録の訂正と時間

[review-responses.json](../../data/national/location-batch2/kyushu-okinawa/review-responses.json)に全指摘と対応を整理した。初回の不一致は、知名の探索範囲不足、徳之島/うるま/諫早の未実施照合、那覇の過大条件、Issue16継承不足、未取得計画の2021版断定、名護PDF確認済みの共通文言、知名中庭推測、Web探索前保存の断定、取得開始を取得完了と読める時刻表記、内訳検査不足、レビュー状態の古い記述。実施内容と今回の文書・JSONを揃えた。アプリコードと公開仕様の新しい不一致は見つかっていないが、これら調査記録内の不一致を「不一致なし」とは報告しない。

初回23要求の`fetchedAt`は要求開始で、完了時刻は未記録。追加17要求は`requestStartedAt`/`completedAt`と発見経路を区別（失敗要求は状態も記録）。誤って取得した商工会議所見出し画像と本当の平面図も区別し、誤取得原本を消さない。

初回385.605秒は初回だけの実測。追加は11:53:07.187615〜12:08:49.685616 UTC、942.498秒。[outcomes.json](../../data/national/location-batch2/kyushu-okinawa/outcomes.json)の`recheckTiming`は追加取得開始から原本読解・外形照合・数値候補作成・事実記録までの共同実測。事前レビュー読取、後続検証・PR・再レビュー・統合は含めない。施設別に重複配賦せず全国へ外挿しない。

## 検証とレビュー

```sh
mise exec -- python3 -B data/evidence/location-batch2/kyushu-okinawa/verify.py --with-work
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 --with pyproj==3.7.2 python data/evidence/location-batch2/kyushu-okinawa/derive-points.py --check
mise exec -- uv run --with shapely==2.2.0 --with pyproj==3.7.2 python data/evidence/location-batch2/kyushu-okinawa/verify-p05.py
mise exec -- python3 -B -m unittest discover -s tools/national -v
mise exec -- go test -count=1 ./...
```

統合後のPython全国117テスト成功、Go非キャッシュ全テスト終了コード0。地域固有テストは採用前に5ID差分が空で失敗（RED）、manifest選択・binding追加後に成功（GREEN）。元行hash・旧値・全証拠・ID・bindingを照合し、地域5IDのcoordinate/evidence/locationReviewだけが変わること、全関係・他地域採用・既存座標の不変、非採用3IDを検査した。共有履歴テストは最新mainで既にbatch2を除外しており、期待値・digest・共有テストの追加変更なし。`verify.py`は保存した開始時manifestで608の歴史的契約を保ち、実manifestへの地域差分は新テストへ分離した。

保存一覧20261021・review-list20261105・as-of2026-11-05で基準main/採用後をそれぞれGo builddata生成し全国監査を実行。カード1313・場所1735・関係1825不変、配布施設ピン991→996、蓋ピン1309不変。既存ピンは全フィールド一致し、full/detailsの場所・カード・関係とfull/pinsのピンが一致、manifestの3ファイルhashとpinsのdetailsSHA256も一致した。[generated-check.json](../../data/evidence/location-batch2/kyushu-okinawa/generated-check.json)に世代hash、[validation-integration.json](../../data/evidence/location-batch2/kyushu-okinawa/validation-integration.json)に監査・検証結果を記録。原本5ファイルは親rootから読み取りコピーし、新取得扱いせず旧hashを検査した（`build-inputs.json`）。

採用5IDの実生成detailsと本番`facilityMapLink`でMapsリンクが承認座標を渡すことを確認（`check-maps.ts`/`maps-check.json`）。UIコード変更なし。ブラウザー画面・Google Maps外部画面・現地確認は未実施。画面の視覚回帰を実施したという報告ではない。共有変更はmanifestの地域追加のみで、共有進捗文書・アプリコードを変更していない。フックは省略しない。

Gemini 4 Argon枠超過、Claude providerのrate limit、Antigravity Opus枠超過の履歴を別ファイルで保持。Gemini 3.8 Flashの独立最終レビュー全文は`review-gemini-flash.json`、採否は`review.json`。重大なし、5ID承認、3保留支持。任意指摘のpending表記とmain基準差を本更新で解消した。レビューの「5候補/4施設」は5施設ID/4建物と訂正して使用する。原本・座標・根拠不変の統合であり、ユーザー指定に従い追加再レビューは起動しない。CI監視とマージは親が担当する。
