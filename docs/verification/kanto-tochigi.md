# 栃木県位置調査・初回Draft（Refs #66 / #60）

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
