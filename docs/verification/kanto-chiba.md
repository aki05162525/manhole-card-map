# 千葉県位置調査・初回Draft（Refs #63 / #60）

基準は `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は2026-11-05。共有manifest未変更、採用未承認。これは県内全件完了報告ではなく、全17IDの引継ぎと習志野1件の比較を切り出した初回Draftである。

## 対象と進捗

現assembleの全国未位置588件に対し、Issue63の17IDはすべて未位置。千葉カード（12-）に紐づく未位置集合と一致し、千葉県を明記する未位置住所に追加漏れはなかった。柏と八千代2現窓口は保存配布原本の住所・施設と[県公式市町村一覧](https://www.pref.chiba.lg.jp/kouhou/ichiran.html)で県所属を補った。全588原本を再読して県外配布例を排除した検査ではない。

[scope.json](../../data/national/kanto-prefecture/chiba/scope.json)に全旧place/relations・配布状態・次作業を保存。[history.json](../../data/evidence/kanto-prefecture/chiba/history.json)で130履歴pointerとhashを解決し、Issue16/20/25〜27・batch1/2を含む索引の履歴カタログを保持した。地域レビューを全国承認へ拡張していない。索引・最新停止条件を読解したが、全過去レビュー本文・全原本の独立再読を完了した意味ではない。

- 新しい数値外形比較：習志野1/17。仮点1、採用0/17、独立レビュー0/17。
- 他16ID：今回の新規外形比較は未着手。既往試行・停止理由はそのまま参照し、新たな「資料不足」「取得失敗」には分類しない。
- 白井2窓口・習志野は人手回答を継承し再質問しない。八千代旧サービスは既にended、旧給排水相談課はunknownであり、どちらも現庁舎点で埋めない。

| ID末尾 | 施設 | 台帳内配布状態（在庫再確認ではない） | 今回の次作業 |
| --- | --- | --- | --- |
| 34abbed67b76aca3d2d2 | 市川市観賞植物園 | suspended | 公式窓口説明と園内配置図でカード受付棟を確認し、市CSVの園代表点とは別に外形比較する。 |
| 38d7a5c180ebcf42c381 | 袖ケ浦市役所 下水道課 | active | 保存33055.pdfの管理棟配置を使い、中袖4番地の処理場周辺タイルを取得して管理棟・脱水機棟・正門を比較する。 |
| 46630cd19483230497e8 | 旧井上家住宅 | active | 9棟のうちカード受付棟を公式案内で絞る。施設中心/母屋を無条件に使わない。 |
| 5724e90e3e451f22eeef | 白井市役所 本庁舎1階守衛室 | active | Issue57訂正済み図1/4頁と保存4タイルで本庁舎側部分の境界を独立確認。既存仮点を再質問で置き換えない。 |
| 668322fd5a7c4bbcbf55 | “渚の駅”たてやま | active | 渚の駅の館内案内でカード受付が渚の博物館・マルシェ等のどの棟かを確認。 |
| 7a134ba2f20e70f69407 | 佐倉ふるさと広場管理棟「佐蘭花(さらんか)(売店内)」 | active | 佐蘭花管理棟の写真/広場配置図と風車・道路の配置をGSI外形へ照合する。 |
| 7e3c5c2330870eee7f79 | 八街市役所受付(第一庁舎一階) | suspended | 保存庁舎アクセス図の第一庁舎と周辺外形を比較する。P05市役所代表点の無条件共有はしない。 |
| b3c83a3795c4697c100b | 習志野市企業局工務部下水道課 | active | 2013図・現配布HTML・BldA361候補を独立レビューし、製品CRS適用を解決後に親が選択する。 |
| caac2827c5303ba03047 | 白井市役所 都市建設部 上下水道課業務係 | active | Issue57訂正済み図4頁と一体外形BldA112の東庁舎側部分を独立確認。 |
| cb5698330ef87617cf42 | 柏市上下水道局3階総務課 | suspended | 保存上下水道局案内図と千代田1-2-32新庁舎の外形を比較する。休止状態の変更は別途根拠が必要。 |
| d4aaa6f664279d04fc85 | 袖ケ浦市役所 守衛室 | active | 保存実施設計4頁/2026案内図と4タイルを再比較し、南庁舎2期棟/既存7階棟/連絡部分を分ける。 |
| f4a2060d8b43f0ac3acb | 道の駅みのりの郷東金 | suspended | 配布案内と施設フロア案内でマルシェ等の配布棟を確認し、道の駅代表点と区別。 |
| integration-01 | 八千代市上下水道局1階 お客様センター（工事） | active | 保存2023資料03の上下水道局庁舎を新市庁舎と区別し、周辺隣接タイルを含めて再比較。 |
| integration-02 | 八千代市水道サービス（宿直対応） | active | 現配布案内の庁舎内宿直をintegration-01と照合し、同棟採用時も個別bindingを作る。 |
| integration-05 | 袖ケ浦市観光協会 | active | 守衛室と同じ南庁舎を比較するが、個別施設/配布条件とbindingは維持する。 |
| integration-legacy-yachiyo-0 | 八千代市上下水道局1階給排水相談課窓口 | unknown | 給排水相談課という旧窓口名称/時点と現お客様センターの対応を独立確認。unknownを終了と推測しない。 |
| integration-legacy-yachiyo-1 | 株式会社八千代市水道サービス | ended | 終了済み旧萱田町596-19の歴史外形資料を探す。現大和田新田局庁舎の座標で埋めない。 |

## 習志野の比較

[比較記録](../../data/evidence/kanto-prefecture/chiba/narashino-comparison.json)、[全取得範囲SVG](../../data/evidence/kanto-prefecture/chiba/narashino-all.svg)、[拡大SVG](../../data/evidence/kanto-prefecture/chiba/narashino-focus.svg)、[計算](../../data/evidence/kanto-prefecture/chiba/narashino-calculation.json)を保存した。一般HTML/PDF原本はignored `data/work/kanto-prefecture/chiba/` のみ。取得URL・日時・hashは[retrievals.json](../../data/evidence/kanto-prefecture/chiba/retrievals.json)にある。

人手回答の2013年12月15日あじさい156号を独立取得し、全12頁を500px/頁で概観、8頁を1800pxで読解した。8頁以外の細字全読は未実施。現配布HTMLは旧デザインの窓口を藤崎1-1-13新館3階と指定する。2013年の部署表を現部署の証拠にはしない。在庫なくなり次第一時中止という条件から、現在中止とは判定しない。

図の本館→新館→配水池の並び、背後の別館、前面道路の反対側の第2給水場を比較し、新館候補を `58259-25805-BldA-361` とした。本館346、別館365、配水池側556/東隣片、第2給水場372/東隣片と対応する。配置模式図自身に北記号・寸法はなく、左の広域図の北記号と道路対応から約29度回転した配置と読む。模式図の上をそのまま北にしていない。

新館候補の近似地上面積は401.09m²。公式図に面積がないため面積一致の主張はしない。数値外形の重心から仮点 `35.6869668, 140.0313095` を計算し、小数7桁丸め前後で内包を確認した。新館外形は取得9タイルの外端にも内部境界にも接していない。比較に使う東側の外形片は隣接タイルも描画済み。

GSI原本9タイルとRange取得記録のETag/Last-Modifiedを保持。同じ版の応答だけを組み合わせた。既存README・利用規約・一般タイル仕様はhash照合して原取得日を継承した。国土地理院最適化ベクトルタイルを加工、利用条件はPDL1.0。READMEの2026-07-01は製品版であり、各棟の測量年月ではない。一般仕様のJGD2011を本製品へ適用する根拠の独立承認は未了。これは棟同定/CRSレビュー待ちの候補である。

[locations案](../../data/national/kanto-prefecture/chiba/locations-proposed.json)と[lifecycle案](../../data/national/kanto-prefecture/chiba/location-lifecycle-proposed.json)は現schemaで保存。[選択案](../../data/national/kanto-prefecture/chiba/selection-proposed.json)の通常approvedは空で、承認後に限るfragmentを別に置いた。親が採用する際は独立レビュー後にhashを再確認し、共有manifestへ順番に統合する。配布関係修正案はない。

## 人手質問・時間・限界

[親への質問候補](../../data/national/kanto-prefecture/chiba/human-questions-proposed.json)は旧井上家住宅・渚の駅たてやま・みのりの郷東金の受付棟について各一問、公式URLと施設ID付き。未送信。既往停止理由から抽出したもので、今回それら3施設の新規原本調査を済ませたとの主張ではない。親が追加回答と重複を排除してから利用者へ提示する。自治体へ連絡していない。

[timing.json](../../data/evidence/kanto-prefecture/chiba/timing.json)は習志野の取得・読解・計算の開始/終了をその場で記録。施設別履歴hash照合はmachine-onlyと明示した。開始前の共通読解・報告作成・検証時間は施設へ後付け配賦していない。県全体の総工数・短縮率ではない。

独立Codexレビューは親が新規担当へ依頼する。この担当は再委任していない。初回Draftでは他16IDの現棟と数値外形の新規照合、製品CRS承認、採用、全受入条件は未完了。Closes #63 は付けない。

## 検証

[検証記録と入力hash](../../data/evidence/kanto-prefecture/chiba/validation.json)、[ログ](../../data/evidence/kanto-prefecture/chiba/validation.log)、[再現コマンド](../../data/evidence/kanto-prefecture/chiba/reproduction.txt)を保存。現manifestによる全台帳/全関係は不変。メモリ内の仮選択では習志野1IDの位置/evidence/locationReviewのみ変化し、全関係と他IDは不変。候補hash改ざんを既存assembleが拒否すること、binding hashと旧値も確認した。仮選択成功を採用承認にはしない。

新規製品コード・共通コード変更なし。通常コミットフックの非cache Go（内部で全国Pythonを実行）は下記へ記録する。手動全suiteは重ねない。UI/ブラウザーは研究資料のみのため未実施。

## 文書とコードの不一致

今回新たに確認した共有文書/コード不一致はない。既知の歴史hash/現manifest混同、Issue24のsource説明、絶対snapshotPath、旧Evidence fetchedAt、再利用日時nullの訂正は[Issue57の記録](issue57-workflow.md#文書整理と既知の記録差)を継承するが、今回すべてを再監査したとは扱わない。製品CRSの地域間判断差は上記の未承認事項として残す。
