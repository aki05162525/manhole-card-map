# 北海道72座標候補の独立レビュー

2026-11-05。採用可能27、要訂正4、保留41。既存unresolved19は全件保留を維持、昇格0。

出力: `data/national/reviews/north-hokkaido.json`。各行にfacilityId、判定、個別理由、原本URL/path/SHA256、元座標、訂正案を記録した。`acceptedFacilityIds`だけが今回の無修正採用対象。`coordinateAcceptableAfterCorrection`は訂正前の統合許可ではない。

## 主な指摘

- 北海道DB5件はP27-H25（札幌下水道科学館、天塩ファミリースポーツセンター）、P34-H26（常呂2窓口）、P05-H22（函館地域交流まちづくりセンター）。各旧原典は非商用・JGD2000。P28由来は今回の72件にはない。P05-22のCC BY/JGD2011を旧版に当てはめない。
- 役場CSV21件は原典年次・CRS不明。カタログ更新日を各地点の更新日としない。富良野・奈井江の2件も、一般公開ライセンスを確認しただけではCRS/建物点定義の不足を補えない。
- 北海道の利用規約第1条の一般CC BY・数値データ適用除外、第2条の第三者権利、第4条の他サイトとの関係を併読した。原典の再配布許諾が別途変更された証拠はない。違法性を断定せず、無条件の再配布承認を保留する。
- 登別は第2庁舎、苫小牧は北庁舎。市役所全体の点でconfirmedにしない。北斗本館/別館、富良野チーズ工房、副港市場など複合施設も個別理由を記載。保留は誤座標と断定する判断ではない。
- 釧路2窓口は公式配布案内→StpyysamtXeQvhMx9→釧路市上下水道部feature。るもいプラザのリンクではない。decide.pyの共通説明文だけの誤りと確定。verificationMethodの全文old/newをJSONに記録。留萌の説明も個別出典に書き分ける。千歳2階窓口は現行配布案内に合わせ経営管理課→総務課の名称訂正案。
- 木古内は同じ公式アクセス原本のPOI住所338と施設欄338-14が接続し、案内カウンターの配布記事も保存済み。台帳の338-14を維持して採用可能。天塩町役場は本文1464-113とフッター1466-113が不一致のため2窓口保留。

公式条件: [北海道規約](https://www.harp.lg.jp/opendata/terms.html)、[国土数値情報利用条件](https://nlftp.mlit.go.jp/ksj/other/agreement_02.html)、[P27](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P27.html)、[P34](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P34.html)、[旧P05](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05.html)。取得原本とhashはこのディレクトリのmanifest.json。P28も保存した。

## 文書・コード・実データの不一致

- locations READMEは旧施設点を現在の名称住所に照合して採用と記すが、decide.pyは北海道DBのH25/H26/H22を出典制約・CRS未記録のまま出力する。official-facility-index READMEの原典ライセンス/測地系を確認し一律採用しない方針と整合していない。
- READMEの「建物内の複数窓口」及び生成された名称住所照合済みという説明は、登別第2庁舎/苫小牧北庁舎を市役所代表点へ対応させる根拠にはならない。実データは棟不明の施設点も含む。
- decide.pyの釧路・留萌用共通説明が釧路2窓口にもるもいプラザ由来と読める文を付与する。実provenanceは釧路市公式→釧路市上下水道部であり本文の説明のみ不一致。留萌も個別出典に書き分ける訂正案を付した。
- 千歳2階窓口は台帳及び旧施設案内の経営管理課と現行配布案内の総務課が不一致。「現施設の名称照合」済みという一律説明を維持できない。同建物であるため座標の誤りとは分類しない。

元verify.pyは意味的同定を保証しないとREADMEに明記されており、この点は文書コード不一致とは扱わない。verify.pyがvalidation.jsonを書き換えるため再実行せず、独立audit.pyで317原本・91施設根拠hash・26リンク接続・72数値対を検証した。

## 確定した採用facilityId一覧

- `facility:north-1b80feaf8e6924df20c4` — HUB HOKKAIDO SELECT SHOP
- `facility:north-226fa24434ce9b26d323` — たきかわ観光国際スクエア
- `facility:north-45c2fe1219e88b833457` — 道の駅みそぎの郷 きこない 観光案内所
- `facility:north-52202833e562b25efc5c` — とかち観光情報センター
- `facility:north-5933f197216885e6d064` — 道の駅おうむ
- `facility:north-62ad6ad3369746b37621` — 道の駅 うとろ・シリエトク
- `facility:north-6497f09097adeb769acf` — 情報発信基地 AKABIRAベース
- `facility:north-7539fb5b206d87a17ef5` — 江別市民活動センター・あい
- `facility:north-784f83101a1fba71ca5c` — 北欧の風 道の駅とうべつ
- `facility:north-81922f5137bfd85952f9` — EBRI内 江別アンテナショップGET'S
- `facility:north-95253bf986d2693881d7` — 千歳市水道局庁舎1F管理員室
- `facility:north-95977999d1143637e813` — エルフィンパーク市民サービスコーナー
- `facility:north-9a1bae888266745fcbc3` — 石狩市観光センター「ゆめぽーと」
- `facility:north-9ff5ca81c48605ed790a` — 豊富町観光情報センター
- `facility:north-a5487e1f89df95c0f69d` — 道の駅石狩 あいろーど厚田
- `facility:north-a5e747e17e489df9e8b0` — 道の駅「もち米の里☆なよろ」
- `facility:north-adf76c586ebea80020ba` — 札幌市環境プラザ
- `facility:north-b52f5b5eb1fe0a290167` — 道の駅上ノ国もんじゅ
- `facility:north-bf6e16a11cb13e5f9622` — 豊富町定住支援センター(ふらっと★きた)
- `facility:north-c8ab3d989862cda67eba` — 当麻町郷土資料館ここから
- `facility:north-d4f4c5138f1edd1b3b74` — 湯の杜ぽっけ
- `facility:north-d68cb955eb8fb28297a6` — 生涯学習センターあすぱる
- `facility:north-dc7b25bac2387c1d4172` — 小樽市水道局本庁舎
- `facility:north-e02254fac40d4417b6a8` — 道の駅ライスランドふかがわ 1階総合案内所
- `facility:north-f7c2ea84a43d097526df` — 道の駅「羊のまち 侍・しべつ」
- `facility:north-faff1c6ba07862131750` — 道の駅香りの里たきのうえ
- `facility:north-fb4350ebefff5d4630de` — 道と川の駅 花ロードえにわ

## 全72件の判定

| facilityId | 施設 | 判定 |
|---|---|---|
| `facility:north-03d0245a068dd82eaa37` | 登別市役所都市整備部 下水道グループ | 保留 |
| `facility:north-0c29dde3d5fc2a368725` | 和寒町役場 守衛室 | 保留 |
| `facility:north-12b6e6080ef6e1e816a7` | 美唄市役所 | 保留 |
| `facility:north-1b80feaf8e6924df20c4` | HUB HOKKAIDO SELECT SHOP | 採用可能 |
| `facility:north-20e8f811524b0ce7d3f5` | 別海町役場建設水道部上下水道課 | 保留 |
| `facility:north-226fa24434ce9b26d323` | たきかわ観光国際スクエア | 採用可能 |
| `facility:north-3060a04659dcedce64b9` | 北見市役所 常呂総合支所 当直室 | 保留 |
| `facility:north-3170be48b7ec799e21bb` | 和寒町役場 産業振興課 | 保留 |
| `facility:north-337a40d0c1a094f1643d` | 鹿追町役場商工観光課 | 保留 |
| `facility:north-33d210dca3f1918726f9` | 北見市上下水道局常呂上下水道課窓口(北見市役所常呂総合支所内) | 保留 |
| `facility:north-343aa74f33ff03c6fa0a` | 函館市地域交流まちづくりセンター | 保留 |
| `facility:north-3992dcf75c3cb9b680a4` | 上富良野町役場建設水道課 | 保留 |
| `facility:north-45c2fe1219e88b833457` | 道の駅みそぎの郷 きこない 観光案内所 | 採用可能 |
| `facility:north-4a3e61d50e9a48491365` | 苫小牧市役所上下水道部下水道課 | 保留 |
| `facility:north-4c87540ad5304f8a47b5` | 上士幌町役場建設課 | 保留 |
| `facility:north-5146ae8cc4fb697aa46b` | 富良野市役所1階 総合窓口 | 保留 |
| `facility:north-52202833e562b25efc5c` | とかち観光情報センター | 採用可能 |
| `facility:north-53b2b9df9a8da2705261` | 札幌市下水道科学館 | 保留 |
| `facility:north-5933f197216885e6d064` | 道の駅おうむ | 採用可能 |
| `facility:north-5e7ef2bf3873a0c566d6` | 留萌プラザ2F まちなか賑わい広場 | 要訂正 |
| `facility:north-6104f556e2024abcb15f` | 豊富町役場 建設課 上下水道係窓口 | 保留 |
| `facility:north-62ad6ad3369746b37621` | 道の駅 うとろ・シリエトク | 採用可能 |
| `facility:north-63f1d610c5add80db10e` | 利尻町役場建設課 | 保留 |
| `facility:north-6497f09097adeb769acf` | 情報発信基地 AKABIRAベース | 採用可能 |
| `facility:north-65717121aad1d7580861` | 道の駅いわない ガイドセンター たら丸館 | 保留 |
| `facility:north-7539fb5b206d87a17ef5` | 江別市民活動センター・あい | 採用可能 |
| `facility:north-76934d7112fde654b326` | 新得町役場警備員室 | 保留 |
| `facility:north-784f83101a1fba71ca5c` | 北欧の風 道の駅とうべつ | 採用可能 |
| `facility:north-7e52de8e6f50eeba0d74` | 別海町役場警備室 | 保留 |
| `facility:north-7fde83cc219f8104cc65` | 陸別町役場 警備室 | 保留 |
| `facility:north-80c28f27f6f95e930a9b` | 上富良野町役場警備室 | 保留 |
| `facility:north-81922f5137bfd85952f9` | EBRI内 江別アンテナショップGET'S | 採用可能 |
| `facility:north-8b10bcb76cb93263b696` | 北斗市観光交流センター内 北斗市観光案内所(1階) | 保留 |
| `facility:north-8b9eb37cc57d1790a6ab` | 旭川観光物産情報センター | 保留 |
| `facility:north-94e8fd249c24448254ec` | 豊富町役場宿直室(役場裏玄関) | 保留 |
| `facility:north-95253bf986d2693881d7` | 千歳市水道局庁舎1F管理員室 | 採用可能 |
| `facility:north-95977999d1143637e813` | エルフィンパーク市民サービスコーナー | 採用可能 |
| `facility:north-9a1bae888266745fcbc3` | 石狩市観光センター「ゆめぽーと」 | 採用可能 |
| `facility:north-9d5628a68e45a5cf6deb` | 足寄町役場2階建設課上下水道室 | 保留 |
| `facility:north-9f828ae51e79cb1346e4` | 当麻町役場まちづくり推進課 | 保留 |
| `facility:north-9ff5ca81c48605ed790a` | 豊富町観光情報センター | 採用可能 |
| `facility:north-a3a29a0bb04d24bdf7ac` | 稚内副港市場 1階 カフェPotto | 保留 |
| `facility:north-a44b8aa1c55ed7aae9ec` | 奈井江町交流プラザみなクル | 保留 |
| `facility:north-a5487e1f89df95c0f69d` | 道の駅石狩 あいろーど厚田 | 採用可能 |
| `facility:north-a5e747e17e489df9e8b0` | 道の駅「もち米の里☆なよろ」 | 採用可能 |
| `facility:north-adeda0700dac8487ca81` | 千歳市水道局庁舎2F経営管理課総務係窓口 | 要訂正 |
| `facility:north-adf76c586ebea80020ba` | 札幌市環境プラザ | 採用可能 |
| `facility:north-b3895bc1edbab7205d85` | 天塩町ファミリースポーツセンター | 保留 |
| `facility:north-b52f5b5eb1fe0a290167` | 道の駅上ノ国もんじゅ | 採用可能 |
| `facility:north-b59c391ec004d507bb86` | てしお温泉「夕映」 | 保留 |
| `facility:north-bf6e16a11cb13e5f9622` | 豊富町定住支援センター(ふらっと★きた) | 採用可能 |
| `facility:north-c2f6c2b5109a65d91a91` | 天塩町役場当直室(1F) | 保留 |
| `facility:north-c755555d3ee86913edcf` | 剣淵町役場 建設課窓口 | 保留 |
| `facility:north-c8ab3d989862cda67eba` | 当麻町郷土資料館ここから | 採用可能 |
| `facility:north-c9c5016d77e51377f615` | ガーデンスパ十勝川温泉 | 保留 |
| `facility:north-ca408ccc1bcbc950bdd6` | 新得町役場施設課窓口 | 保留 |
| `facility:north-cb479f7bbce2788c803e` | 富良野チーズ工房 | 保留 |
| `facility:north-cdee3e1ed7285d1301f2` | 足寄町役場裏警備員室 | 保留 |
| `facility:north-d4f4c5138f1edd1b3b74` | 湯の杜ぽっけ | 採用可能 |
| `facility:north-d68cb955eb8fb28297a6` | 生涯学習センターあすぱる | 採用可能 |
| `facility:north-da208a6abd2abdb93a0a` | 道の駅あびらD51ステーション | 保留 |
| `facility:north-da9719ed3ef3729f4673` | 釧路市上下水道部 南大通庁舎経営企画課 | 要訂正 |
| `facility:north-dc7b25bac2387c1d4172` | 小樽市水道局本庁舎 | 採用可能 |
| `facility:north-dddf18164e0a5e3df321` | 釧路市上下水道部 南大通庁舎守衛室 | 要訂正 |
| `facility:north-df2e2fa9738be3f1981a` | 陸別町役場 建設課 | 保留 |
| `facility:north-e02254fac40d4417b6a8` | 道の駅ライスランドふかがわ 1階総合案内所 | 採用可能 |
| `facility:north-ec1d5acd6800362be7ec` | 芦別市観光物産センター(道の駅スタープラザ芦別内) | 保留 |
| `facility:north-f51a0f3cd3ce0a372cb6` | 足寄町役場警備員室 | 保留 |
| `facility:north-f7c2ea84a43d097526df` | 道の駅「羊のまち 侍・しべつ」 | 採用可能 |
| `facility:north-faff1c6ba07862131750` | 道の駅香りの里たきのうえ | 採用可能 |
| `facility:north-fb4350ebefff5d4630de` | 道と川の駅 花ロードえにわ | 採用可能 |
| `facility:north-fc46386371945051a55a` | 天塩町役場建設課(2F) | 保留 |

## 証拠と再検証

- `inspection.json`: 原本のテキスト読解補助。抜粋の最初に共通ヘッダが現れることもあるため、意味的結論はレビューJSONと原本locatorを参照。
- `audit.json`: 319 URL中原本あり317件のhash、再利用bytes、全91施設根拠hash、72座標対、26公式リンク接続、CSV生行、342元入力ファイルのhash。
- `manifest.json`: 追加した公式規約/旧原典仕様6原本のURL、取得時刻、最終URL、hash。隣接txtは読解用派生テキスト。
- `validation.json`: 全72/19の被覆、分類、訂正old一致、追加原本hash、audit時点からの元入力342ファイル不変。

再検証: `python data/evidence/national/review-north-hokkaido/validate_review.py`。元成果物、親統合台帳、assembler、配布関係、commit/push/PRは変更・実行していない。子起動なし。
