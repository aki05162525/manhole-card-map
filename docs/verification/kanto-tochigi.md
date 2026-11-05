# 栃木県20施設の位置調査（Refs #66 / #60）

20IDすべてで配布原本・棟資料と数値外形を比較し、18IDの未承認候補を保存した。佐野TeaRoomと上三川ORIGAMIプラザは、照合したPMTiles版で対象棟の外形が未収録だった。未着手0、人手回答待ち0、採用0。**共有manifestは変更しておらず、実台帳の未位置数は588のまま**。候補18件をメモリ内だけで選択すると570になるが、これは検証上の仮統合である。製品固有CRS根拠と独立採用レビューが残るため、県全件の位置確定・Issue受入完了とはしない。

基準commitは `4f5253b8973cb388deecff0bc051f36770e77579`、台帳・既往確認日は2026-11-05を維持。思季彩館の利用者確認日2026-11-06だけを別の回答追補へ記録した。取得日時・原資料の掲載基準日・利用者確認日を混同していない。初回20ID固定と全履歴hashは[inventory.json](../../data/national/kanto-prefecture/tochigi/inventory.json)を継承する。

## 追加調査の結果

[全20IDの結果と個別証拠参照](../../data/national/kanto-prefecture/tochigi/batch2-outcomes.json)を現在の県内結果とする。初回 `outcomes.json` は22d1f325当時の履歴として保持。3子担当に5施設ずつを割り当て、県担当が残5施設と統合を担当した。南群完了後に鹿沼・久保の追加航空比較を移管した経緯は[割当記録](../../data/evidence/kanto-prefecture/tochigi/batch2/assignments.json)に残した。これらは実装・調査担当であり独立Codexレビューではない。

| 施設 | 結果・主な識別点 |
| --- | --- |
| 太平記館 | 候補。外形530、公式建築面積255.05㎡と数値約270.45㎡、外観・駐車場・道路比較 |
| 壬生町役場宿直室 | 候補。新庁舎主棟37、南附属棟36・北庇49を除外 |
| 佐野TeaRoom | 当該版外形未収録。2025市広報と2023航空を比較し東の別棟9を除外。年代差を保持 |
| 宇都宮城址公園清明館 | 候補288。公園東側、堀・櫓と分離。伊賀門跡との南北誤記は追補で訂正 |
| 日光自然博物館／奥日光IC | 候補7。同一1棟の主要部代表点。室単位の回転対応は未確定、利用者方位報告と独立観察を分離 |
| 新・鹿沼宿 | 候補193。公式図・現写真・2024年4～5月航空で本館/物産館/トイレを分離 |
| 矢板市観光協会 | 初回候補17を継承。親レビューで棟同定承認可能、位置はCRS保留 |
| 久保記念観光文化交流館 | 歴史配布棟候補175。観光協会事務局の久保記念館を2022航空と公式配置で同定。配布終了維持 |
| 日光市観光協会今市支部 | 候補186。現案内は日光観光情報館。旧仮説155は道路反対側の別棟と判明し棄却 |
| 栃木市観光協会 | 候補471。倭町小江戸ひろば南蔵。北蔵・コエド市場・万町の観光館と分離 |
| 小山市役所4階下水道施設課 | 候補65。新本庁舎、隣タイル17のbuffer重複を除外 |
| 足利まちなか遊学館 | 候補482。公式建築面積406.27㎡と数値約401.30㎡、外観・道路比較 |
| しもつけ風土記の丘資料館 | 候補91+38。本館/新館と道路東の聖武館を区別、跨タイルを結合 |
| 上三川ORIGAMIプラザ | 当該版外形未収録。設計・配布図・2025広報図を照合し、北のいきいきプラザを代用しない |
| 小山市役所1階中央管理室 | 候補65。同一本庁舎でもIDと配布関係は別のまま |
| 小山市まちの駅思季彩館 | 候補352。利用者確認の看板付き商家、開運館を除外。確認日11月6日を追補 |
| 壬生町役場下水道課 | 候補37。宿直室と同棟でも別IDを維持、再開予定を稼働中にしない |
| 那須与一の郷物産館 | 候補31北ローブ。公式図の加工・物産館、南ローブ情報館を除外 |
| 栃木県下水道管理事務所 | 候補108南側。県央浄化センター管理本館を処理施設群と区別 |
| 上三川町観光協会 | 候補190。公式ガイドの「商工会に南接」を独立確認、北の商工会館を除外 |

18候補の座標・原本hashは[locations案](../../data/national/kanto-prefecture/tochigi/batch2-locations-proposed.json)、旧名称/住所とのbindingは[lifecycle案](../../data/national/kanto-prefecture/tochigi/batch2-location-lifecycle-proposed.json)、明示選択は[selection案](../../data/national/kanto-prefecture/tochigi/batch2-selection-proposed.json)。すべて未承認。schema内の `approved` 配列名は選択案形式であり、外側の `adoptionApproval:false` を覆すものではない。

カード配布関係・施設稼働/休止/終了・在庫・棟同定・位置採用は別判断。上三川の住所1-3-5/1-3-8と、鹿沼の配布原本9～19時/現本館9～18時の差は[別審査候補](../../data/national/kanto-prefecture/tochigi/batch2-relation-review-candidates.json)へ保存し、台帳の原文を自動修正していない。

## 原本・CRS・残る限界

[export-index.json](../../data/evidence/kanto-prefecture/tochigi/batch2/export-index.json)は元workパス・保存先・hashの対応表。一般PDF・HTML・写真の原本はignored workに保持し、Gitやブラウザー配信へ混入させていない。数値原本は国土地理院最適化ベクトルタイル。JSON観察と取得記録は原記録のバイト列を維持したため、内部の相対パスは元workパスを基準に読む。子の初期提案は履歴であり、統合して検証した上記batch2案を選択対象とする。

[CRS追補](../../data/evidence/kanto-prefecture/tochigi/batch2/crs-followup.json)では公式README全文、PMTiles header/metadata、公式製品説明15頁のテキストを確認した。READMEのデータ版は2026-07-01、metadataには `26-07.mbtiles`、HTTP Last-Modifiedは2026-09-17。いずれにも当該製品版の測地系宣言を確認できなかった。一般地理院タイルのJGD2011説明を製品適用の一次根拠に置き換えない。XYZ逆投影・小数7桁丸めは加工方法であり、CRS承認や測量精度の保証ではない。

日光博物館の室ごとの向き、模式図の縮尺/年代、航空写真と配布案内の年代差、公式の棟別建築面積がない施設などの限界は各観察に残した。入口測量は要求せず、現在の配布先を含む建物代表点として評価した。資料を実比較したうえで、採用判断を親の独立レビューへ引き継ぐ。

## 今回の検証・記録差

既存 `verify.py` は親の修正対象のため変更・再実行していない。新しい読み取り専用[check.py](../../data/evidence/kanto-prefecture/tochigi/batch2/check.py)は既存の選択hashを照合し、不一致を修復せず失敗する。選択hash改変・未知ID・lifecycle必須配列欠落の拒否と入力不変を[4テスト](../../tools/national/test_kanto_tochigi.py)で確認した。RED→GREENのログは[検証記録](../../data/evidence/kanto-prefecture/tochigi/batch2/verification-record.json)から参照できる。

`python3 -B data/evidence/kanto-prefecture/tochigi/batch2/check.py` は終了0。[validation.json](../../data/evidence/kanto-prefecture/tochigi/batch2/validation.json)に入力hash・20ID旧値・全台帳差分・18件の仮新値を保存。全配布関係は不変で、選択した18ID以外に差分はない。全18候補をrawから再decodeして丸め後内包も確認した。子担当では全suiteを実行せず、県統合commitの通常フックで全国Python＋非cache Goを一回実行し、結果を後段へ追記する。UI/ブラウザー変更はなく再検証不要。

施設別の時刻は各timing/manual-logに逐次記録。複数施設や連絡処理が混在した区間、手動タイマーを分離できなかった区間は明記し、施設別へ後付け配賦していない。

発見した記録・コードの差は次のとおり。旧値は消さず追補した。

- 子のlifecycle案と県統合初版は `events` / `groups` を欠き、「現schemaに合う」という説明が不完全だった。現コードの必須配列を統合案に追加し、再assemble成功。読み取り検査にも拒否テストを追加した。
- 清明館の初期観察にある「伊賀門の南」は北矢印の読解誤り。正しくは北。候補288の点は変更なし。
- 今市の初期仮説155は航空照合で別棟と分かり186へ訂正。鹿沼の南側建物194との疑義も撮影期付き航空で解消した。
- 継承した旧Issue5北関東READMEの「食い違いなし」と、旧処理のEvidence `fetchedAt` は現Go7項目契約と不一致。今回の取得日時は別metadataとした。旧JGD2011適用判断とIssue57の未確定判断も区別して保持。

## 初回PRの履歴（22d1f325時点）

以下は初回調査・検証の記録であり、現在の件数・未着手・レビュー状態を示すものではない。


基準は `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は2026-11-05。現manifestの実assembleで全国未位置588施設、Issue #66の20施設は全て座標なしだった。全588件の住所・名称を栃木県25市町名で検索し、カードID `09-` の関係も照合した結果、追加候補は0。原施設証拠のhashと20件の台帳旧値を照合した。住所の県名を含む20IDを今回の調査対象とするが、全施設の現配布先・移転を今回独立再確認したという意味ではない。

[対象・旧値・履歴参照](../../data/national/kanto-prefecture/tochigi/inventory.json)はIssue16/20/25〜27、batch1/2を含む索引の全参照を解決してhash固定した。参照解決と全資料の再読解は区別する。回答済みの鹿沼・矢板は再質問していない。共有manifest・索引・人手キュー・他県は変更していない。

## 今回の成果と未着手

新しい原本・外形照合は2件。矢板1件を未承認候補として保存し、鹿沼1件は棟対応未確定。残る18件は履歴と旧台帳の照合のみで、今回の外形照合は未着手。資料不足や人手待ちに分類しない。採用0、位置確定0であり、県調査の完了を主張しない。施設別の状態・継承する次作業は[outcomes.json](../../data/national/kanto-prefecture/tochigi/outcomes.json)を参照。

矢板市観光協会 `facility:kanto-north-1c3ab1ee8ca76b7c99e0` は[公式PDF](https://www.yaita-kankou.com/images/配布場所・駐車場のお知らせ.pdf)全5頁と館内図を新規取得して読んだ。3頁の10月23〜25日特設配布と、4〜5頁の10月26日以降の宿泊棟受付を区別した。利用者回答を追認しただけではない。1頁航空写真の川・横断橋・東岸駐車場・北側駐車場・南北2棟をGSI道路/水部/全建物と照合し、北側のBldA index17（旧flattened892）を候補とした。館内図の宿泊棟と2号館を含む一体外形で、南側浴場25（旧900）ではない。北記号はなく、方位は周辺配置から推論している。

候補は **36.7937641, 139.9177585**。外形重心・有効Polygon・丸め前後内包を確認した。9タイルを新規取得し、中央タイルは既往raw hashと一致、3比較外形も完全一致した。入口測量を条件にしない。一体外形を受付を含む建物単位として採用できるか、製品CRS適用、利用条件の原本確認は親の独立Codexレビューで判断する。

鹿沼宿 `facility:kanto-north-14336e747375e6550de3` は[阿見町の復命書](https://www.town.ami.lg.jp/cmsfiles/contents/0000005/5787/3.03_shiryo1-2_syuttyou-fukumei.pdf)全7頁を目視。4頁に北記号、東の例幣使街道、南の古峯原街道、本館・物産館・公衆トイレの配置がある。2011年整備計画であり、HTTP更新2021年を設計時点にしない。現市HTMLの本館指定は独立確認できたが、数値外形183/186・191/193等のどれと対応するかは今回確定できなかった。未収録とは断定しない。施設ページの `img/news/store_info.png` は取得前・未読で、次に読む資料として残す。旧マーカーは探索窓だけに用い、採用点に転用しない。

在庫・稼働状態と位置採用は分けた。台帳には太平記館・壬生役場等のsuspendedや久保記念館のendedがあるが、今回これらの状態を変更していない。矢板も案内の存在から在庫ありを推定していない。配布関係修正案は今回なし。

## 原本・条件とレビュー

[読解記録](../../data/evidence/kanto-prefecture/tochigi/inspection.json)、[HTTP取得](../../data/evidence/kanto-prefecture/tochigi/retrievals.json)、GSIのvector-inputs/各retrievals/geometry/boundary-checkを保存。一般PDF・HTML・写真はignored `data/work/kanto-prefecture/tochigi/` のみ。GitにはGSI数値18タイルと事実記録を含める。出典：国土地理院最適化ベクトルタイル。数値と外形検査はmanhole-card-mapによる加工で、国土地理院による施設位置の承認ではない。

固定READMEは2026-07-01時点のPMTiles、試験公開、基本測量成果ではないことを記載。一般タイル仕様の国内JGD2011と最適化製品への適用を区別した。計算はXYZ格子・extent4096・x東/y南から逆投影、測地系変換なし。小数7桁は測量精度ではない。国土地理院コンテンツ規約のurllib取得はTLSエラーで失敗し、web取得ではPDL1.0・出典/加工表示を確認した。raw hash取得成功とは扱わない。既知のRange不一致P3は今回発生していない。

採用候補は現schemaの `locations-proposed.json` と `location-lifecycle-proposed.json`、明示選択案は `selection-proposed.json`。**共有manifest未反映・採用未承認**。`approved` は現schemaが要求するキー名であり承認を意味せず、外側の `adoptionApproval:false` が今回の状態。親は独立レビュー前に統合しない。

## 検証と時間

`python3 -B data/evidence/kanto-prefecture/tochigi/verify.py` で現manifestとメモリ内の候補manifestをassembleした。候補を選んだ場合だけ矢板1施設の位置・証拠・locationReviewが変わり、全配布関係は不変。実台帳588未位置、仮統合587。旧値・新仮値・入力hash・コマンド・終了コードは[validation.json](../../data/evidence/kanto-prefecture/tochigi/validation.json)。この検証は採用承認ではない。既存assemble/schemaの使用で、アプリ機能・共通処理の変更はないため機能修正用RED→GREENは該当しない。

全国Pythonと非cache Goは通常commit hookの実行証跡を継承する。UI/ブラウザーは変更しておらず再検証していない。原本読解・位置同定をテスト成功で代替しない。独立Codexレビューは親へ引き渡す未完了項目。

施設別の取得・読解・照合は[timing.jsonl](../../data/evidence/kanto-prefecture/tochigi/timing.jsonl)の実測区間。事前の共有調査、成果物作成、最終検証・PR作業は施設に後付け配賦していない。inventoryの機械処理時間は手動読解時間ではない。

今回新たに確認した文書/コード不一致はなし。継承すべき既知差分として、旧Issue5北関東READMEの「食い違いなし」と旧Evidence生成処理の `fetchedAt` 追加は現Goの7項目契約に適合しない。今回は取得日時を調査メタデータへ分離した。北関東batch2のJGD2011適用判断とIssue57の未確定扱いは判断差として残し、今回自動承認しない。

## 実行済み検証証跡

対象研究commit: `2e0f3c8a10e3434ed2a1ff004c15e42022667806`。通常 `mise exec -- git commit` の終了コード0。フック原ログSHA256: `5f082db1959d84500e33ec2cd52a7e72962945c2b13ef111c48770109042e801`。入力hashはvalidation.json、commit後の変更は本節の文書追記のみ。

`TestNationalAssemblyFailureGuards` が全国Python unittestを内部実行するため、成功したGo結果を継承し手動全suiteは重ねていない。成功時のPython個別出力はGoが抑制する。以下はフックログ全文（ANSI色とgitのファイル列挙は除外）。

```text
╭──────────────────────────────────────╮
│ lefthook  v2.2.2   hook:  pre-commit │
╰──────────────────────────────────────╯
┃  frontend ❯

┃  go-test ❯
+ go test -count=1 ./...
?   	github.com/aki05162525/manhole-card-map/cmd/addresses	[no test files]
ok  	github.com/aki05162525/manhole-card-map/cmd/builddata	74.730s
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
ok  	github.com/aki05162525/manhole-card-map/internal/gkp	0.004s
ok  	github.com/aki05162525/manhole-card-map/internal/municipality	0.003s

  ────────────────────────────────────
summary: (done in 75.79 seconds)
✓ frontend (0.03 seconds)
✓ go-test (75.79 seconds)
```

同じcommitでrawを再decodeし、3外形のgeometry/重心/丸め前後内包を独立再計算した（uv + mapbox-vector-tile==2.2.0 + shapely、終了コード0）。index17の近似面積1714.02m²、index24は2.77m²、index25は1077.59m²。選定17/24/25にタイル境界接触なし。描画での同定と機械計算は別判断。

```sh
uv run --with mapbox-vector-tile==2.2.0 --with shapely python - <<'PY'
import sys, json
from pathlib import Path
sys.path.insert(0, "tools/national")
from research_common import decode_tile, rounded_coordinate
from shapely.geometry import shape
p = Path("data/evidence/kanto-prefecture/tochigi")
d = decode_tile((p / "yaita-tile-16-58239-25555.pbf.gz").read_bytes())
for c in json.loads((p / "yaita-geometry.json").read_text())["checks"]:
    g = d["BldA"]["features"][c["index"]]["geometry"]
    assert g == c["geometry"]
    s = shape(g)
    assert s.is_valid
    xy = [s.centroid.x, s.centroid.y]
    assert xy == c["centroidXY"]
    assert rounded_coordinate(g, dict(z=16, x=58239, y=25555), xy) == c["calculation"]
for f in json.loads((p / "yaita-boundary-check.json").read_text())["selectedFeatures"]:
    assert not f["tileBoundaryTouched"] and not f["outerBoundaryTouched"]
print("PASS")
PY
```
