# Issue57 位置調査の再開手順と検証記録

開始データは `11b7e4ee271a3622f794e09e33d3fd6730be3e2b`、集計日は2026-11-05。台帳1,586施設のうち位置未確定588、座標あり998。生成全体や在庫の件数ではない。第2弾の最終集計は[別記録](location-batch2.md)を参照する。共有文書の訂正を含む `523d3011` を取り込んだ。

## 残件索引

[残件索引](../../data/national/issue57/remaining-index.json)は施設IDを一度ずつ列挙し、現在の採用済み施設を除外する。原調査、Issue16・20・25〜27、第1弾、第2弾の結果・レビューに参照と入力hashを付ける。地域のレビューはその地域に限定し、選定や初回成果を最新結果に上書きしない。同名・同住所は共同調査の候補として列挙するが、同棟認定やID統合は行わない。

`latestResultRef` が最新の原記録、`stopCondition` と `resumeCondition` が原文の停止・再開条件。`classificationCandidates` は原文検索の候補であり、確定した停止理由ではない。照合未実施、取得失敗、資料不足、外形未収録、棟対応未確定、座標系・利用条件未確認、現配布先未確認を分けて検索する。試行の明示分類は `recordedStopCategories` に保持する。原記録の追加分類待ちを「未実施」や「不足」と読み替えない。`recordedStage`・`attemptsRef`・計画と実施の記録も残し、旧判断は変更しない。

[人間確認キュー](issue57-human-queue.md)は現配布先・棟名などを一問で確認できる施設に絞った。回答と原本取得は別記録にし、確認日と情報元を保持する。未回答の間も独立作業を進める。こちらから自治体へ自動連絡しない。

再生成先には未使用のパスを指定する。基準コミットはデータの集計基準であり、現manifestの入力hashも必ず確認する。

```sh
python3 -B tools/national/research_index.py --baseline 11b7e4ee --as-of 2026-11-05 \
  --followup data/national/issue57/pilot-outcomes.json \
  --followup data/national/issue57/pilot-review-corrections.json \
  --human-queue data/national/issue57/human-confirmation-queue.json \
  --out /tmp/issue57-remaining-index.json
```

試行選定時の索引は[初版](../../data/evidence/issue57/remaining-index-initial.json)に保持した。レビューで参照範囲と分類を訂正したが、選定時のhash・588ID・採否を遡及変更していない。

## 共通化した処理

| 処理 | 既存処理の確認範囲 | 新しい共通処理 |
| --- | --- | --- |
| 取得・再利用 | 近畿西 `fetch-footprints.py`、北関東 `vector-scan.py` / `check-cache.py` | `research_common.fetch_cached`。URL・版・要求headerをキーにrawとhash、原取得日時、ETag等を保持。再利用日時を分け、失敗応答も保存する。 |
| 隣接・全外形描画 | 南関東 `inspect-vector.py`、近畿東 `render-vector.py` | `adjacent_tiles` / `combine_tiles` / `render_svg`。全featureを座標整列し、穴とbuffer外形も描く。外端とタイル継ぎ目を区別する。 |
| 派生点・丸め | 四国 `derive.py`、北陸 `compare-vector.py` | `rounded_coordinate`。元点と丸め後の点を別々に内包検査する。計算成功は棟同定やCRSの承認にしない。 |
| 調査記録 | 地域ごとのoutcomes・retrievals | `new_observation` / `validate_observation`。計画・実施、取得状況、全頁、方位、描画範囲、周辺道路、棟、製品CRS、利用条件、独立レビューを分ける。 |
| 基準と地域差分 | 南関東・中国・東海の採用なし検証 | `research_baseline.check_research_only`。歴史manifest・台帳hashを維持し、現在のinputs・patches・locations・locationLifecycleの地域寄与を別に比較する。 |

共通処理は標準ライブラリを使う。実タイルdecodeのみ既存調査と同じ `mapbox-vector-tile==2.2.0` が必要。タイル結合はfragmentの座標整列であり、同じ棟の幾何unionではない。内包検査は有効なPolygonを前提とし、自己交差修復や測量精度の保証は行わない。旧raw・旧調査スクリプトを一括変換せず、新しい試行で共通APIを使用した。

## 原本読解と採用判断

全頁を見た範囲、未読頁、方位の根拠、タイルの取得・描画範囲、境界切断、周辺の道路・棟との対応を記録する。検索で見つけた資料、取得できた原本、内容を読んだ原本は別に数える。予定した手法を実施済みにしない。

一般の地理院タイル仕様とoptbv製品への適用根拠は別に扱う。東海等の旧記録にはJGD2011とする説明があり、北陸は一般仕様の製品への適用を未確定としている。過去の判断差を消さず、今回の計算式だけで製品CRSを承認しない。PDL1.0等の座標加工条件と自治体PDF・画像全文の再配布条件も分ける。原本はブラウザー配信資産へ混ぜない。

2026-11-06の利用者指定により、採用基準を次のとおり更新した。配布先の建物を特定でき、根拠に基づく位置の不確かさを考慮しても、その建物への案内として支障がなければ採用する。座標系の名称だけが未確定であることを、一律の保留理由にしない。

共通検証の `positionSuitability` に `uncertaintyBasis`（不確かさの根拠）、`buildingAssessment`（対象建物への案内に及ぼす影響）、証拠参照 `evidence` を記録する。独立レビューで支障なしと判断した場合だけ `status: acceptable` とする。原典精度・加工・独立位置照合等を根拠とし、建物境界・隣棟・道路を考慮する。固定のメートル閾値は設けず、根拠のない微差扱いや丸め後内包だけでの承認はしない。

`crs.status: insufficient` は不明点をそのまま残し、上記評価で案内に支障がない場合は採用審査を通せる。`not_checked` / `failed` は承認不可。棟同定・利用条件の確認、機械検査成功、独立レビューは引き続き必要。座標系が確認済みでも位置の適合性評価は省略しない。旧記録に新項目がなくても未承認記録として読めるが、新たに承認する際には評価を追加する。既存の採用・保留・manifestは自動変更しない。この共通検証は調査記録の検査であり、assembleが全地域の採否を自動審査するものではない。

調査成果を先に保存し、原本・棟対応・数値・条件をCodexが独立レビューする。レビュー利用枠や実行失敗は「未完了」と残す。テスト成功や別モデルの断定を原本確認の代わりにしない。採用する場合だけ、承認済みIDをmanifestとbindingへまとめて明示し、旧値・hash・全台帳差分・生成・Mapsを検証する。モデル変更は利用者の許可範囲に従う。

## 5施設の試行と残る作業

白井市役所2窓口、熱海市役所2窓口、中津川市ひと・まちテラスの計5施設を選定し、全件保留・採用0とした。[選定と583IDの除外理由](../../data/national/issue57/pilot-selection.json)、[結果](../../data/national/issue57/pilot-outcomes.json)、[原本読解](../../data/evidence/issue57/pilot/inspection.json)を保持する。白井の北記号の記載頁は独立レビューで訂正し、[追補](../../data/national/issue57/pilot-review-corrections.json)を最新索引に反映する。

白井は旧4タイルをhash照合して再利用し、熱海と中津川は各9タイルを取得した。全外形と道路のSVGを3地域分描画し、4仮点で丸め前後の内包を検査した。白井は本庁舎・東庁舎と接続外形の区分、熱海は模式図と現外形の対応、中津川は周辺図から現建物を一つに絞る作業が残る。計算成功から位置を採用していない。

[実時間](../../data/evidence/issue57/pilot/timing.json)は選定保存後から調査記録・検証まで843.108秒。取得・描画は資料を共用する地域群ごと、仮点計算はIDごとに計測した。手動比較137.001秒は共有区間であり、施設別には分離計測できていない。独立レビューは[別記録](../../data/evidence/issue57/codex-final-review.json)を参照する。時間短縮の比較測定はないため、短縮率は主張しない。取得・hash・Range・描画・丸め検査の処理は共有できたが、図面の時点差・棟境界・製品CRS適用の判断は手作業として残った。

Issue57全体の完了には588件の分類候補の実査と具体的次作業の確定、施設ごとの手動時間の計測が残る。このPRを区切りとし、全国の追加採用調査を広げない。次は関東1都6県を優先し、県ごとに機械確認・人手質問・資料待ちを分けて小分けPRで進める。今回の34回答グループを再質問せず、回答受領と課題解決を分けて引き継ぐ。

## 文書整理と既知の記録差

Issue24と第2弾集計の長い再現コードを `export_priorities.py` と `check_batch2_summary.py` へ移し、文書はCLIと前提条件に短縮した。旧処理との同等性を対象テストで確認した。Issue24の入力work原本がないため、当時の実612行の再生成は今回未確認。第2弾CLIは固定2コミットで実行した。

原本・採否・検証結果を含む文書は削除しなかった。地域検証文書、旧提案、独立レビュー文書は索引または後続履歴から参照されるため保持した。現在の手順と当時の記録が混在する箇所は追記で区別する。文書の短縮についてyomiyasuのlint・差分・最終稿照合を実行し、[記録](../../data/evidence/issue57/yomiyasu-verification.json)を保存した。

現在確認した不一致は以下のとおり。過去レビューのその他の指摘は[履歴一覧](../../data/evidence/issue57/historical-discrepancies.json)に参照付きで残すが、今回すべてを再検証したとは扱わない。

- 南関東・東海は現manifestを歴史hashと比較し、中国は現全国件数を当時の608に固定していた。歴史基準と現在差分へ分離した。
- Issue24の説明では出力先を替えると `source` が変わるとしていた。実際には分類入力のパスが記録され、`--out`だけでは変わらないため訂正した。
- 旧中国四国READMEの「形式の食い違いなし」と、絶対snapshotPathを拒否する現assembleの差は第2弾集計に記録済み。旧101行を直接統合せず、manifestが選ぶ相対パス化済みコピーを使う。
- 旧Issue5西南・北関東READMEの記述と、旧スクリプトが付けるEvidenceの `fetchedAt` は現Goの7項目契約に適合しない。原調査を保持し、新しい取得日時は別の調査メタデータへ記録する。
- 近畿西の「既存取得日時を継承」という説明に対し、汎用再利用処理は仕様書の日時をnullにしていた。同じ原本hashの `.source.json` に日時があることを再確認し、[訂正追補](../../data/evidence/issue57/provenance-corrections.json)へ旧値・原値・参照hashを残した。旧ファイルを書き換えていない。

## 検証の重複を避ける手順

新規機能・修正は対象テストのRED→GREENで確認する。最終のデータ・コード差分では既存コミットフックが `go test -count=1 ./...` を実行する。`TestNationalAssemblyFailureGuards` が内部で `python3 -B -m unittest discover -s tools/national -v` を実行するので、手動で同じ全試験を重ねない。フックは省略しない。

検証記録は対象commit・変更ファイルhash・コマンド・終了コード・ログを対応させる。後続のログ・文書だけの追記では、対象コードが同一かを確認して既存結果を参照する。差分・入力・環境の変化や未検証の懸念が出た場合だけ必要な試験を追加する。レビュー担当にも既実行の証跡を渡し、意味・原本・独立計算・未確認箇所を優先する。
