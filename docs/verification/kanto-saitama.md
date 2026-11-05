# 埼玉県位置調査 第1回 Draft（#64 / 親 #60）

基準は `4f5253b8973cb388deecff0bc051f36770e77579`、確認日は2026-11-05。現assembleの全国位置未確定588施設に対し、Issue #64の39IDを引き継いだ。今回の成果は調査途中のレビュー単位であり、県内完了ではない。共有manifest・既存台帳は変更していない。

## 対象と引継ぎ

[inventory.json](../../data/national/kanto-prefecture/saitama/inventory.json)に39ID・旧施設値・全配布関係・次作業を保存した。[scope-audit.json](../../data/evidence/kanto-prefecture/saitama/scope-audit.json)は原本hash、現台帳の県住所、カード11系との漏れ照合を記録する。県名省略の鴻巣中央1-1は市役所アクセス本文と同頁の県付き住所で照合。カード00系の日本下水道事業団も含む。カード11系の未位置施設で対象外となったIDは0。ただし、全39件の最新移転を再調査し終えたという意味ではない。

[history.json](../../data/evidence/kanto-prefecture/saitama/history.json)は残件索引の全参照を解決し、同じ原記録を重複させず保持する。Issue16/20/25〜27、第1・2弾の索引にある関連履歴を維持し、過去の不採用・レビューを今回の承認に読み替えない。入間守衛室の「本庁舎地下、AB棟のいずれか未特定」という人手回答を引き継いだ。今回の新規人手質問は0。窓口情報を回答済みの利用者に再質問していない。

## 今回比較した施設

鴻巣市下水道課の2ID（`a51582814cdc995742e5`、`9f36b9d69d27a034f19c`）は、市公式のパンジー柄・こうのとり柄の案内で、いずれも本庁舎1階24番窓口と独立に読解した。前者は水曜、後者は火曜の代替配布であり、IDと配布関係を統合しない。在庫ありは取得ページ上の表示に限り、リアルタイム在庫として更新しない。

2016年11月広報の物理全2頁（印刷12〜13頁）を読み、敷地図の本庁舎・新館、西駐車場、周辺道路をGSIの9タイルと比較した。敷地図の上向き矢印は「免許センター方面」であり北記号ではない。数値外形は北上で、西側道路、北道路、本庁舎と新館の相対配置を対応させた。本庁舎の西側外形（BldA feature 53、比較図2523）内から **36.0659298, 139.5221246** を候補化。約927m²はその部分外形の面積で、庁舎全体の延床面積ではない。丸め前後の内包とタイル境界非接触を確認した。

旧図では下水道課が2階、現配布案内では1階となるため、旧室内部署配置を現在の配布階の証拠にはしない。新案内図17417.pdfの取得は失敗した。旧敷地図と現外形の建物同一性、接続外形の扱い、製品CRSへの一般仕様適用は独立レビューが必要。**2候補とも採用未承認**である。

深谷テラスパーク管理棟（`3f70fe18aa4d98644d5b`）は、現掲載園内図全体と2022年3月24日プレス資料全4頁を読解した。園内図は北記号あり。管理棟は調整池の東、円形広場の南西で、北側ファームとは別棟。市の配布案内は管理棟事務所を指定する。周辺9タイル全3336featureを描画したが、整備後の管理棟・ファーム・調整池を対応できず候補なし。取得範囲・版に限る結論であり、全国の数値外形に未収録と断定しない。再開には整備後の数値外形または再利用可能な棟別施設点が必要。

詳しい読解範囲、画像版、取得失敗、面積・境界・周辺対応は[comparison.json](../../data/evidence/kanto-prefecture/saitama/comparison.json)。国土地理院最適化ベクトルタイルをmanhole-card-mapが加工した比較図を同じディレクトリに保存した。自治体・運営者のHTML/PDF/画像原本はignored work内のみ。

## 位置案と統合前の確認

[locations.json](../../data/national/kanto-prefecture/saitama/locations.json)、[location-lifecycle.json](../../data/national/kanto-prefecture/saitama/location-lifecycle.json)、[selection-proposal.json](../../data/national/kanto-prefecture/saitama/selection-proposal.json)は現schemaによる候補案。selectionの`approved`キーはassembleの入力契約上必要だが、ファイル全体の`adoptionApproved`はfalse。実manifestへコピーする承認ではない。

数値原本18タイルとhash、PMTiles Range応答・ETag・Last-Modifiedを保存した。版は固定README上2026-07-01、HTTP更新は2026-09-17。建物ごとの測量日は不明。一般仕様の国内JGD2011とXYZ逆投影計算の成立を、optbv製品への適用承認と混同しない。条件は[source-conditions.json](../../data/evidence/kanto-prefecture/saitama/source-conditions.json)に記録。利用規約の新規取得は失敗したが、旧原本のhashと元取得日時を照合して再利用した。自治体資料全文の再配布条件とは別扱い。

親レビューは、新規Codex担当による原本読解・棟対応・CRSの審査を優先し、承認後に共有manifestへ順次統合する。共通コードの変更提案はない。既知のRange不一致時メタデータ不足P3は今回再現していない。

## 検証と未完了

対象テストは候補ファイル不存在によるRED（終了1）から、候補・binding・明示選択案作成後のGREEN（3試験、終了0）を確認した。仮manifestで全施設・全関係を比較し、2施設のcoordinate/evidence/locationReview以外が変わらないことを確認。位置の正しさの承認をテストで代替しない。

通常コミットフック内の非cache Go全試験が全国Python全試験を実行する。実行対象・hash・ログは[verification.json](../../data/evidence/kanto-prefecture/saitama/verification.json)に保存する。同じ全suiteを手動で重ねない。UI・ブラウザーは変更なしのため未実行。

39件中、今回の新規外形比較は3ID、位置候補は2ID、採用0、残る36IDの新規比較は未着手。36IDは資料不足・今回保留に置き換えず、既往の停止理由と再開資料をそのまま保存した。現在の県内完了率・位置確定率を達成済みとして報告しない。

時間記録にも残件がある。取得・数値処理・ID別機械照合時間は保存したが、初期手動調査を施設別に計測できていない。鴻巣の記録区間にも共通仕様確認と2ID作業が混在する。[timing.json](../../data/evidence/kanto-prefecture/saitama/timing.json)に限界を記し、後付け配賦していない。県内全件比較、各IDの手動実時間、独立レビュー、採用統合は未完了のためRefs #64とする。

## 確認した記述差

既往north-kantoのsource-conditions.jsonは「最適化Vectorは地理院タイル仕様を採用」と断定するが、今回読んだ固定製品READMEはJGD2011を直接明示していない。一般ベクトル定義と一般タイル仕様からの適用推論として分離し、旧調査は変更しなかった。旧広報と現配布案内の下水道課の階数差は資料年代差であり、現コードの配布関係は変更不要。今回の作業範囲で新たな実装・手順文書の不一致は見つかっていない。
