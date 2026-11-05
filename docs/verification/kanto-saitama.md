# 埼玉県 全39施設の実調査（#64 / 親 #60、Draft PR #74）

開始main `4f5253b8973cb388deecff0bc051f36770e77579`、確認基準日2026-11-05、全国位置未確定588施設を基準とする。全39IDで現配布案内・既往根拠・公式棟資料と数値外形の実調査を行った。位置候補20件、対応未解消19件、未着手0、採用0。共有manifest・共通コード・他県は変更していない。原本同定の独立Codexレビューと採用統合は未完了のため、Refs #64 / #60とする。

## 現在のレビュー入口

- [全39件結果・旧値・ID別実施証拠](../../data/national/kanto-prefecture/saitama/full-outcomes.json)
- [20件の位置候補](../../data/national/kanto-prefecture/saitama/full-locations.json)、[binding/lifecycle案](../../data/national/kanto-prefecture/saitama/full-location-lifecycle.json)、[明示選択案](../../data/national/kanto-prefecture/saitama/full-selection-proposal.json)
- [5群の重複なし割当](../../data/national/kanto-prefecture/saitama/parallel-assignment.json)、[利用者回答追補](../../data/national/kanto-prefecture/saitama/human-followup.json)
- [全履歴](../../data/evidence/kanto-prefecture/saitama/history.json)、[初期対象固定監査](../../data/evidence/kanto-prefecture/saitama/scope-audit.json)

明示選択案の`approved`はassemble入力schemaのキーであり、承認実績ではない。全体は`adoptionApproved:false`。原本・製品CRS・棟同定を親が独立レビューした後に共有manifestへ順番に統合する。全suiteの成功で原本読解を代替しない。

## 全件の実施結果

各群の成果は `data/{national,evidence}/kanto-prefecture/saitama/groups/` 以下。waterworks10、civic8、west6、tourism8、north7で39ID。3子を同時実行し、西部終了後に観光8件を投入、県親が北部7件と統合を担当した。

|施設|ID末尾|結果|
|---|---|---|
|公益財団法人埼玉県下水道公社 荒川左岸南部支社|`north-1a5c86a3e21c20b9dcc2`|building-correspondence-unconfirmed|
|荒川水循環センター(守衛室)|`north-80e64df38987c39b7386`|building-correspondence-unconfirmed|
|公益財団法人埼玉県下水道公社 荒川右岸支社|`north-6193af412ca73d91d288`|building-correspondence-unconfirmed|
|公益財団法人埼玉県下水道公社 荒川左岸北部支社|`north-9366bd29aeba766aae7f`|位置候補・未承認|
|公益財団法人埼玉県下水道公社 古利根川支社|`north-e1e48bd4fbf356515d0f`|位置候補・未承認|
|公益財団法人埼玉県下水道公社 中川支社|`north-c8b6772285e4ba7b42be`|位置候補・未承認|
|埼玉県市野川水循環センター|`north-6777261cc63db7a86bfb`|位置候補・未承認|
|埼玉県荒川上流水循環センター|`north-8a61ac8c818d5fd1fa6e`|位置候補・未承認|
|埼玉県小山川水循環センター|`north-9dce5a0d82eb96d95e6c`|位置候補・未承認|
|日本下水道事業団研修センター管理課|`south-c5f3c43a0c2bf2667f5d`|位置候補・未承認|
|伊奈町上下水道庁舎|`north-2bef1ef8fe90f960751c`|held-building-identity|
|加須市上下水道部下水道課(加須市環境浄化センター内)|`north-365e6c6bea1d082fb583`|held-building-identity|
|一般社団法人さまちか事務所|`north-4244d9dc97ba1a68e1de`|位置候補・未承認|
|石井水処理センター|`north-9c30c84d390ac7961fee`|held-orientation-correspondence|
|上尾市役所上下水道部 下水道施設課|`north-c296841d2a4b31ceb758`|held-shape-area-correspondence|
|宮代町上下水道事務所|`north-cb0d94bb8b91f48a986f`|held-building-identity|
|加須市物産観光協会(加須市役所本庁舎2階 観光振興課内)|`north-e9b95c73682cd106b4e8`|held-relocation-distribution-binding|
|白岡市役所仮設本庁舎 商工観光課|`north-shiraoka-temporary-shoko`|held-footprint-absent|
|埼玉県入間市役所守衛室|`north-4f8550974a31b7d62c39`|held-building-subdivision|
|ふじみ野市上下水道課|`north-afe67f47007d5e1f246c`|位置候補・未承認|
|所沢市役所別館 商業観光課|`north-b49337e3f4e3384f788a`|位置候補・未承認|
|ふじみ野市水道サービスセンター|`north-c5f25d696949a267388f`|位置候補・未承認|
|入間市役所上下水道部上下水道経営課|`north-e80f795026cf0f441105`|held-building-subdivision|
|富士見市役所下水道課|`north-e82f8bb306d214d3951f`|位置候補・未承認|
|伝統産業展示室『ぱりっせ』|`north-2dc5fe988e3e972a5140`|位置候補・未承認|
|野老澤町造商店|`north-338d33c309d5e44859e4`|building-correspondence-unresolved|
|日高市浄化センター|`north-3c2f7159dc235081f4f2`|位置候補・未承認|
|熊谷駅観光案内所内|`north-95b116c7383dbf61b3b4`|building-correspondence-unresolved|
|一般社団法人奥むさし飯能観光協会事務局|`north-c4b568ea60ecd6589c50`|位置候補・未承認|
|寄居駅南口駅前拠点施設Yotteco|`north-e199c890078d5d73c908`|current-footprint-not-matched-in-inspected-version|
|吉見百穴|`north-e2961b63ac4d4c596eb9`|building-correspondence-unresolved|
|越谷市観光協会|`north-ed37026123185dfcdd90`|位置候補・未承認|
|深谷テラスパーク管理棟事務所|`north-3f70fe18aa4d98644d5b`|compared-no-matching-footprint|
|道の駅かわもと 深谷市物産館|`north-f45d3f2e581350eedec5`|building-correspondence-unresolved|
|鴻巣市上下水道部下水道課|`north-a51582814cdc995742e5`|位置候補・未承認|
|鴻巣市上下水道部下水道課|`north-9f36b9d69d27a034f19c`|位置候補・未承認|
|無印良品 東武動物公園駅前|`north-d35c60a8c05e97e3a3a9`|位置候補・未承認|
|道の駅おかべ ふるさと物産センター|`north-f328a302882bae5abddd`|位置候補・未承認|
|コウノトリ野生復帰センター「天空の里」|`north-08db6f2252ed32919222`|building-correspondence-unresolved|

## 利用者回答・配布関係の別判断

伊奈町は「この資料では判断できない」と回答済みで、棟未確定を維持。荒川守衛室は「正門脇の独立小棟」と回答済みだが、近接小棟の数値対応は未確定。日高は管理本館、元荒川・古利根川・中川・市野川・荒川上流・小山川は管理棟（中川は管理本館）という2026-11-06利用者報告を保存した。吉見百穴は入口券売場/管理事務所という回答を受け、用途の疑問は解消したが外形識別は残る。いずれも原本の直接記載・AI推論・利用者説明を分離し、座標を自動承認しない。既往の入間地下窓口回答も再質問していない。

加須市物産観光協会は現公式が加須商工会館1階への所在地変更を示す。カード案内は配布終了のままで、新所在地へのカード承継は未確認。旧庁舎の外形が照合できても現協会位置として採用しなかった。南部支社の休日守衛室関係、ふじみ野住所、吉見の施設営業時間とカード案内時間、熊谷の公式住所差は各群の関係修正候補に分離した。位置候補の仮適用では関係を変更しない。

## 数値原典・資料の限界

GSI最適化Vector PMTilesは固定READMEで2026-07-01版、HTTP更新2026-09-17。取得Rangeと原本hash、BldA feature索引、周辺タイル・描画範囲、丸め後内包を各群に保存した。一般原本のHTML/PDF/写真はignored `data/work/` 内のみでGit/ブラウザー配信へ混入させない。GitのPBFと比較図は国土地理院最適化ベクトルタイルを加工したもの。

[共通追補](../../data/evidence/kanto-prefecture/saitama/common-followup/source-interpretation.json)は製品属性とCRSの直接記載・推論を区別する。vt_lvorderは階数ではない。製品READMEは一般タイル仕様へリンクするがJGD2011の文字列を直接記載しない。JGD2024呼称更新で水平座標が変わらない公式説明も取得した。3次元基本図仕様書をoptbv仕様の代用にしていない。一般タイル仕様を製品へ適用する根拠と利用条件は独立レビューへ引き継ぐ。既定TLS失敗と証明書検証を維持した代替取得を別記し、失敗を成功に置換していない。既知Range不一致P3は今回再現なし。

おかべの公式図の上矢印は駅方面で、北ではない。国道と隣接棟を基準に回転して照合した。後続の白書2013基準の延床1440.99m²と採用外形約871m²は定義・階数差未確認として残し、面積一致とは主張しない。越谷はタイル境界の分割/重複を処理して丸め内包確認。深谷テラス、白岡仮設、Yottecoは取得版/取得範囲で整備後外形を確認できない限定結果で、全国的未収録とは断定しない。

西部の局所PIL描画は内孔を塗り潰すため、中庭の同定根拠には原geometryと全域SVGを用いた。県親の北部局所表示も同じ制約があり、候補muji/okabeの原Polygonに内孔がないことを確認した。

## 検証・時間記録

各子は原本hash・原feature・ID旧値binding・丸め内包の局所検証だけを実施。県親は全39件証拠網羅と全20候補の全台帳仮適用をRED→GREEN（5試験終了0）で検証した。全台帳のID/順序/配布関係は同一で、20施設のcoordinate/evidence/locationReview以外の差分なし。通常フック内の全国Python＋非cache Go全suiteを統合時に1回実行し、同一入力の手動全suiteを重ねない。詳細は全件版のverification/logを参照。UI/ブラウザー変更なしのため再検証なし。

初回3IDの未計測手動時間は依然不明で、後付け配賦しない。今回の各群には施設別の開始終了/取得計算時間を保存。northの親作業区間には調整・利用者回答待ちが混在し、純作業時間とは主張しない。鴻巣再確認区間は既往原本/hashの継承検証時間であり初回読解時間ではない。初回成果`inventory.json`/`outcomes.json`/`locations.json`等と初回検証ログは履歴として保持し、現在の全39件結果には`full-*`を用いる。

## 確認した記述差

- 既往north-kantoのsource-conditions.jsonは「最適化Vectorは地理院タイル仕様を採用」と断定するが、固定製品READMEにはJGD2011の直接記載がない。適用推論として分離し旧資料を変更しない。
- 鴻巣の旧広報は下水道課2階、現配布案内は1階24番。年代差として現在案内を優先。
- 吉見はカード案内8:30–17:00、施設変更案内は2026-04-01以降8:45–16:50。カード時間を自動変更しない。
- 加須協会の旧台帳は市役所内、現公式は商工会館内。配布承継未確認のため旧値と移転案を分離。
- 初回県文書の「36件未着手」は初回時点の記録で、今回全件版が置き換える。上記以外に新たなコード/手順文書の不一致は見つかっていない。
