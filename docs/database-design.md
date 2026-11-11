# 台帳データベースの設計

配布施設の台帳を SQLite の表で持つ。正本は2つで、スキーマ `tools/db/schema.sql` と、表ごとの行ファイル `data/db/<表>.jsonl` である。SQLite ファイルはこの2つから作る生成物で、Git に入れない。

`tools/build-real-data.py` は表から書き出した台帳を `cmd/builddata` に渡し、公開データを作る。原本のファイルは読まない。表の検査は `tools/db/test_ledgerdb.py` にあり、CI の backend ジョブが `go test ./...` から呼ぶ。

行の `source_ref`・`legacy_snapshot_path`・根拠の文には、削除したファイル（`data/national`・`data/evidence` の下）のパスが残る。行は書き換えない。ファイルは Git の履歴で読める。原本の置き場と、Git に残すものは [データ保守](data-maintenance.md#原本の置き場) にある。

## 道具

| ファイル | 役割 |
| --- | --- |
| `tools/db/schema.sql` | 表の定義。外部キー・NOT NULL・CHECK・UNIQUE で不変条件を表す。すべて STRICT 表 |
| `tools/db/ledgerdb.py build` | 行ファイルを検査して SQLite ファイルを作る。既定の出力先は `data/work/ledger.sqlite3`。`--check` を付けるとメモリ上で検査だけする |
| `tools/db/ledgerdb.py dump` | SQLite ファイルを検査し直してから、行ファイルを正規形で書く |
| `tools/db/ledgerdb.py export-ledger` | PlaceLedger schema 1 の JSON を書く。`--db` を省くと行ファイルからメモリ上で組み立てる。`tools/build-real-data.py` はこの出力を使う |
| `tools/db/ledgerdb.py summary --as-of 日付` | 表だけを入力に件数と再確認の一覧を JSON で書く（[集計](#集計)） |
| `tools/db/ledgerdb.py fingerprint 施設ID` | 施設の位置の判断ごとの指紋と、次の判断の行の雛形を JSON で書く（[位置の判断を足す](#位置の判断を足す)）。検査を通らない途中の行ファイルからも計算する |
| `tools/db/ledgerdb.py import-card-ids` | `data/card-ids.json` の内容で `card`・`card_alias`・`card_excluded` を置き換え、検査してから行ファイルを書く |

SQLite を直接開くときは、接続ごとに `PRAGMA foreign_keys = ON` を実行する。SQLite は既定で外部キーを検査しない。

## 表

### card、card_alias、card_excluded

`data/card-ids.json` と同じ内容を持つ。

- `card.id` は公開したことのあるカード番号。番号は消さずに残す。
- `card_alias` は旧番号 `old_id` から現番号 `target_id` への対応。どちらも `card` に存在すること、自分自身を指さないことを要求する。
- `card_excluded` は除外した番号と、空でない理由。

別名の連鎖と、別名かつ除外の重複は、組み立てのときに検査する。別名の先が今のカードにあるかどうかは、生成したカードと突き合わせる `cmd/builddata` が検査する。

### evidence

出典の記録。施設・配布関係・位置の判断が `evidence_id` で参照する。

| 列 | 意味 |
| --- | --- |
| `id` | `evidence:` と、内容の hash の先頭24桁 |
| `source_url` | 出典 URL。http か https |
| `snapshot_sha256` | 原本の sha256。どの行でも必須 |
| `legacy_snapshot_path` | 削除した原本が Git の履歴でどこにあったか（`data/evidence` の下）。値を持つのは既存の行だけで、新しく足す行では NULL にする。空文字は拒否する |
| `source_locator` | 原本の中の該当箇所 |
| `fetched_at` | 原本を取得した日時。時差付きの時刻で、`tools/national/acquisition.py fetch` の取得記録の `fetchedAt` を写す。既存の行は NULL |
| `checked_at` | 確認日。元の記録が時刻を持つ場合は、時差を付けた時刻をそのまま持つ |
| `actor_type` | 確認した主体。`ai` か `human` |
| `verification_method` | 確認の方法 |

内容が完全に同じ根拠は1行にまとめる。`id` は `source_url`・`snapshot_sha256`・`source_locator`・`checked_at`・`actor_type`・`verification_method` の6列を、この順の JSON 配列（区切りに空白を入れない、非 ASCII をそのまま書く）にして sha256 を取り、先頭24桁を使う。`fetched_at` が値を持つ行では、配列の末尾に足してから計算する。どの sha256 をいつ取得したかも根拠の内容だからである。NULL の行の `id` は6列だけから計算するので、列を足す前と同じ値になる。原本の場所は内容ではないので `id` に入れない。6列の組には UNIQUE をかけ、取得日時だけが違う行は置かない。組み立ては `id` が内容と合っているかを検査する。内容を直すときは、新しい `id` の行を作って参照を付け替える。

`legacy_snapshot_path` は台帳の根拠の `snapshotPath` として書き出され、`adoption_sha256` と `previous_state_sha256` の計算に入る。既存の行の値は書き換えない。NULL の行では `snapshotPath` のキーを書き出さず、指紋の計算にも含めない。原本が要るときは `source_url` から取り直し、`snapshot_sha256` と照合する。

`fetched_at` も同じ扱いで、値を持つ行は台帳の根拠に `fetchedAt`（時刻のまま）として書き出され、2つの指紋の計算に入る。NULL の行では書き出さず、指紋の計算にも含めない。`cmd/builddata` は `fetchedAt` を読み、時差付きの時刻であることと、その時差での日付が `checkedAt` より後でないことを検査する。公開データには出さない。

取得の後に確認するので、組み立ては取得日時が確認日より後の行を拒否する。`checked_at` が日付なら `fetched_at` の時差での日付と比べ、時刻なら時刻どうしで比べる。

### facility、facility_legacy_id

- `facility` は施設の ID・名称・住所・電話番号と、施設の同定に使った根拠 `identity_evidence_id`。電話番号がない施設は空文字にする。
- 同定の根拠は位置の根拠で置き換えない。位置の根拠は `location_decision` に置く。
- 根拠の URL にはホスト名が要り、利用者名を含めない。この検査は組み立てで行う。
- `facility_legacy_id` は元の抽出 ID。`legacy_id` は全施設を通じて一意で、`position` は台帳の `legacyIds` の並び順（0から連番）。

### relation

カードと施設の配布関係。

- `id` は関係そのものの ID で、カードや施設を直しても変えない。既存の行の `id` は、カード・施設・適用期間から決定的に作ってある。新しく足す行は重複しない任意の文字列にしてよい。
- `card_id` は `card`、`facility_id` は `facility` への外部キー。
- `valid_from`・`valid_to` は適用期間。開始は終了以前とする。同じカードと施設でも、期間が重ならなければ別の行として持てる（[期間の違う配布関係](#期間の違う配布関係)）。NULL の端は開いているとみなすので、期間を持たない行は同じカードと施設のほかの行とかならず重なる。重なりは組み立てで検査する。
- `status` は `active`・`upcoming`・`suspended`・`ended`・`unknown` のいずれか。
- `condition` は、NULL のとき台帳に `condition` キーを出さない。空文字のときは空文字を出す。`cmd/builddata` はこの2つを区別する。
- `hours` は配布時間の文の並び。`maintenance_notes` は保守の注記の並びで、NULL ならキーを出さない。
- `review_until` は原典を見直す期限。
- `change_*` の4列は公式に記載された別窓口を足したときの記録（台帳の `change`）。4列はそろって値を持つか、そろって NULL にする。`change_previous_place_ids` は元の抽出 ID の並びで、施設の表にない ID も含むため外部キーにしない。
- `source_hash` は原典の配布案内の指紋。`evidence_id` は関係の根拠。

### location_decision

施設位置の判断を追記していく履歴。主キーは施設と連番 `seq` で、`seq` が最大の行が今の状態を表す。

| 列 | 意味 |
| --- | --- |
| `previous_state_sha256` | 直前の判断の後の状態の指紋。`seq = 1` では NULL、それ以外では必須 |
| `action` | `adopt`（採用）、`reaffirm`（再確認）、`correct`（訂正）、`withdraw`（撤回）。`adopt` は `seq = 1` だけに置ける |
| `lat`・`lng` | その判断の後の位置。撤回では NULL、それ以外では必須 |
| `scope` | 採用した点の種類（建物代表点、施設代表点、入口、利用者指定）。分かっているときだけ |
| `evidence_id` | 位置の根拠 |
| `adoption_source` | 採用の由来。採用の行では必須で、それ以外の行では NULL。`approved-location` はレビューした位置の行を `adoption_sha256` で固定した採用で、新しい採用はすべてこれにする。`input-ledger` は、位置を承認した記録がなく、施設の同定の根拠のもとで持っていた座標 |
| `adoption_sha256` | 承認した位置の行の指紋。`approved-location` の採用では必須で、それ以外の行では NULL |
| `adoption_extra` | 採用した位置の行のうち、施設 ID・位置・根拠・`scope` 以外の項目 |
| `decision_id`・`reason_type`・`prepared_by`・`reviewed_by` | 採用の後の判断に必須。作成者とレビュー者は別にする |
| `reviewed_at`・`reason`・`address_status`・`identity_name`・`identity_address` | 位置のレビューの記録。5列はそろって値を持つか、そろって NULL にする。以下、`reason` を持つ判断を「レビュー済みの判断」と呼ぶ |
| `source_version`・`review_due` | 位置の元資料の版と、再確認の予定日 |

組み立てでは次も検査する。

- 連番に抜けがない。
- 採用の後の判断の日付は、直前の判断の日付より前にしない。直前がレビューの記録を持たない採用なら、その根拠の確認日（時刻付きなら日付の部分）より前にしない。
- 判断の日付はその根拠の確認日（時刻付きなら日付にしたもの）より前にしない。
- 再確認は位置を変えない。訂正は位置を変える。
- レビュー済みの採用では、`reason` は `scope` と承認の種類から決まる文（`ledgerdb.py` の `ADOPTION_REASONS` と `BUILDING_REASON`）、`reviewed_at` は根拠の確認日、`address_status` は `valid` にする。

### 指紋の連鎖

指紋は2種類あり、どちらも `ledgerdb.digest` で作る。値を JSON にし（キーを並べ替え、非 ASCII をそのまま書く）、その sha256 を取る。組み立てのたびに、行の内容から計算し直して照合する。`ledgerdb.py fingerprint` が施設ごとに出す。

- `adoption_sha256` は、採用した位置の行の指紋である。その行は `facilityId`・`coordinate`・`evidence`（確認日時は元のまま）・`scope` に `adoption_extra` の項目を足したもので、`ledgerdb.adoption_record` が組み立てる。
- `previous_state_sha256` は、直前の判断の後の状態の指紋である。状態は `identity`・`coordinate`・`evidence`（確認日は日付）・`status`・`addressStatus`・`reason`・`decisionId`・`reviewedAt`・`sourceVersion`・`reviewDue` の10項目で、`ledgerdb.decision_state` が組み立てる。レビューの記録を持たない採用（`reason` が NULL）では、`identity` の名称・住所、`addressStatus`、`reason`、`reviewedAt` が null、`decisionId`・`sourceVersion`・`reviewDue` が空文字になり、`coordinate`・`evidence`・`status` が採用の内容を表す。

指紋が守る範囲は次のとおり。

- `adoption_sha256` が守るのは、`approved-location` の採用の施設 ID・緯度経度・根拠・`scope`・`adoption_extra` である。
- 後続の判断がある行は、次の行の `previous_state_sha256` が状態の10項目を守る。
- 後続の判断がない採用では、`identity_name`・`identity_address`・`source_version`・`review_due` を変えても検出できない。
- `input-ledger` の採用は `adoption_sha256` で固定していない。位置を承認した記録がないためである。後続の判断を足すまでは、変更をPRの差分のレビューで確かめる。足した後は、次の行の `previous_state_sha256` が採用の座標と根拠を守る。`input-ledger` の採用は施設の同定の根拠を位置の根拠に使う。組み立てはこの決まりを検査するので、位置の根拠を別に持つ採用を `input-ledger` にはできない。

台帳への書き出しは次のとおり。

- 施設の `evidence` は今の判断の根拠にする。判断がない施設では同定の根拠にする。
- `coordinate` は今の判断の位置にする。
- `reason` を持つ判断がある施設には `locationReview` を出す。
- 施設の名称・住所が `identity_name`・`identity_address` と違えば保留とみなし、位置を出さずに `needs-review` を出す。
- 保留の施設と同じ建物グループの施設も保留にする。理由の文は `A reviewed building group member changed identity` にする。

### building_group、building_group_member

同じ建物にある施設の組。

- `building_group` はグループの ID と、同じ建物だと裏付ける根拠 `evidence_id`。
- `building_group_member` は所属する施設と、原本の `facilityIds` の並び順 `position`。主キーが施設なので、1つの施設は1つのグループにしか入らない。
- グループには施設が2つ以上要る。所属する施設はレビュー済みの採用を持つ。どちらも組み立てで検査する。

### location_research

位置を持たない施設について、過去の作業単位が何を調べ、なぜ保留したかの記録。同じ施設を一から調べ直さないために残す。主キーは施設と `source_ref`。

| 列 | 意味 |
| --- | --- |
| `source_ref` | 元の記録。既存の行では `data/national/<ファイル>#<JSON ポインタ>` で、d5402e11 の時点のファイルを指す |
| `work_unit` | 元の作業単位の名前。既存の行では `data/national` の直下のディレクトリ名（`issue7`、`location-batch2` など） |
| `researched_at` | 作業単位が記録した日付か時刻。記録の項目（`checkedAt`、`endedAt`）を優先し、なければファイルの終了時刻、最後に基準日を使う。どれもなければ NULL |
| `status`・`stage` | 作業単位が付けた状態と段階。値は作業単位ごとに違い、共通の語彙にそろえていない |
| `blockers` | 阻害要因の並び（JSON 配列） |
| `finding` | 調べて分かったこと |
| `stop_condition`・`resume_condition`・`next_action` | 停止条件・再開条件・次の行動 |
| `next_source`、`next_source_*` | `issue7` の `nextSource` を元の項目名のまま写したもの（下を参照） |

- 既存の行の文は、元の記録から書き換えずに写したものである。要約・言い換え・推測での補完はしていない。元が文字列の並びなら、改行でつないで1つの文字列にした。
- AI の調査を人の確認として記録しない。この表には利用者の回答や電話・現地の確認を入れていない。利用者の回答は `user_answer` に置く。
- 位置を採用した施設には行を持たせない。今の判断が採用・再確認・訂正の施設に行があると、組み立ては止まる。位置を採用するときは、同じ変更でその施設の行を消す。撤回した施設には行を持たせてよい。
- 少なくとも1つの列が値を持つ。`next_source` と `next_source_*` も数えるので、次の出典だけを記録した行も置ける。

既存の行は、各作業単位の最終の成果ファイルのうち、位置を持たない施設を含むものから作った。作業単位ごとの項目の対応は [PR #241](https://github.com/aki05162525/manhole-card-map/pull/241) にある。`issue7` の地域別ファイルは `investigationStatus` を状態、`reasonCategory` を阻害要因、`reason` を分かったことにした。`nextSource` は次の行動にも再開条件にも読み替えず、元の項目名に対応する列へ写した。文字列なら `next_source` に入れた。オブジェクトなら、`url` を `next_source_url`、`urls` を `next_source_urls`（JSON 配列）、`required`・`needed`・`task`・`notRequired` を `next_source_required`・`next_source_needed`・`next_source_task`・`next_source_not_required` に入れた。

### location_research_attempt

調査記録が試した取得の一覧。同じ取得を繰り返さないために残す。主キーは調査記録（施設と `source_ref`）と、記録の中の順序 `position`（0から連番）。

- `issue7` の調査記録の行は、`attempts` を並び順のまま写したものである。
- それ以外の作業単位の行は、調査記録が持つ取得記録の並び（`sources`、`sourceRecords`、`evidence`）と、取得記録を `<ファイル>#<JSON ポインタ>` で1件ずつ指す項目（`newEvidenceRefs`、`evidenceRefs`、`newSourceRefs`、`sourceRefs`、`factRefs`、`observation.acquisition.records[].ref`）から写したものである。`position` は、この項目の順に並べたときの順序。
- 指す先がファイル全体のもの、URL を持たないもの（建物の比較など）、取得記録を別のファイルのキーで指すもの（`sourceIds`、`retrievalKeys`、`evidenceIds`）は、どの記録を指すかが一意に決まらないので行にしていない。

| 列 | `issue7` の元の項目 | それ以外の作業単位の元の項目 |
| --- | --- | --- |
| `kind` | `kind` か `type` | なし（NULL） |
| `source_url` | `sourceUrl` か `url`。URL を持たない記録（保存済みの資料を読み直したものなど）は NULL | `url`・`sourceURL`・`sourceUrl` のどれか |
| `http_status` | `status`（数値） | `httpStatus`、なければ `status`（数値のとき） |
| `result` | `result` か `outcome` | `result`・`outcome`、または `status`（文字列のとき） |
| `error` | `error` | `error` |
| `attempted_at` | `fetchedAt` か `checkedAt` | `fetchedAt`・`retrievedAt`・`attemptedAt`・`startedAt` の順で最初にあるもの。取得の開始時刻より終了時刻を選ぶ |
| `snapshot_sha256` | `snapshotSHA256` | `sha256` か `snapshotSHA256` |

- `issue7` では、1つの記録が同じ列に当たる項目を2つ持つことはない。それ以外の作業単位で2つ持つのは `attempted_at` だけで、上の順で選んだ。
- 該当箇所（`locator`）、事実の文（`fact`）、原本のパス（`snapshotPath`、`rawPath`、`path` など）は持たない。
- `source_url`・`result`・`error` のどれか1つは値を持つ。

### location_candidate

位置を持たない施設の、採用しなかった位置の候補。採用の行と混ざらないよう、`location_decision` とは別の表にした。主キーは施設と `source_ref`。

- 既存の行は、位置の追補ファイルと `issue7` の地域別ファイルの `updates` のうち、採用に選ばれなかった行である。施設と行の内容が同じものは1行にまとめた。
- 緯度経度、`scope`、根拠の出典 URL・該当箇所・確認日は、候補の行の値をそのまま写した。
- `review_ref`・`review_status`・`review_reason` は、その候補を読んだレビューの判断。レビューのファイルが読んだ候補のファイルを `input.path` で示し、同じ施設の判断（`decision` か `status`）を持つ記録がある場合だけ、その記録の判断と理由（`reason` か `finding`）を写した。読んだ候補のファイルを示すレビューがない行では NULL になる。
- `location_research` と同じく、位置を採用した施設には行を持たせない。位置を採用する変更で、その施設の行を消す。

### location_recheck

位置は採用済みだが、元の調査が移転や座標の競合を挙げていた施設。案内先が誤っている危険が比較的高いので、再確認の候補として残す。主キーは施設と `source_ref`。

- 既存の行は、`issue7` の地域別ファイルの `unresolved` のうち、今の位置を持つ施設で、`reasonCategory` が移転か座標の競合を示すものである。
- `kind` は `reasonCategory`、`text` は `reason` の文をそのまま写した。
- 「再確認が済んだ」という状態は持たない。再確認したら `location_decision` に判断の行を足し、この表の行を消す。今の位置を持たない施設には行を持たせない。

### user_answer、user_answer_facility

利用者が答えた内容。人の確認は取り直せないので、位置を採用した後も残す。

| 列 | 意味 |
| --- | --- |
| `source_ref` | 元の記録（主キー） |
| `work_unit` | 元の作業単位。既存の行では、元の記録があった `data/national` か `data/evidence` の直下のディレクトリ名で、`data/evidence/national` の下では、その下のディレクトリ名 |
| `actor_type` | 回答者の種別。`human` だけを置ける |
| `answered_at` | 記録の日付か時刻（`checkedAt`、`receivedAt`）。なければファイルの日付（`receivedAt`、`reportedConfirmationDate`） |
| `question` | 記録にある質問の文（`receivedQuestionSummary`、`question`）。なければ NULL |
| `answer` | 回答の文 |
| `answer_field` | 回答の文があった項目の名前（`answer`、`responseVerbatim`、`report`、`reportedNarrative`）。項目のない Markdown の原文から写した行では NULL |

- `user_answer_facility` は回答が対象とする施設と、元の並び順 `position`。回答には施設が1つ以上要る。
- 回答の文は元の記録から書き換えずに写す。AI の調査や推論はこの表に入れない。
- 回答の原文と、この表に入らない回答（施設 ID がないもの、利用者が示した座標など）は `data/user-answers/` に残す（[データ保守](data-maintenance.md#原本の置き場)）。

### source_review、source_review_evidence、source_review_target

位置の出典の利用条件の点検。既存の行は d5402e11 の `data/national/source-review/registry.json`（以下 registry）から作った。利用条件の写しは `data/terms/` に残す。

- `source_review` は点検の ID、出典の名前・版・加工方法、状態、確認日、確認主体、条件、注記と、点検対象を訂正した経緯 `selection_review`（registry の `selectionReview` をそのまま写した JSON オブジェクト）。状態は `unreviewed`・`needs-review`・`conditional`・`usable`・`prohibited` のいずれか。`conditional` と `usable` も記載した用途と加工の条件での点検の結果であり、位置の採用の承認ではない。
- `source_review_evidence` は点検の根拠の URL・該当箇所・確認日で、`position` は registry の並び順。根拠は1件以上要り、確認日は点検の確認日より後にしない。
- `source_review_target` は点検が読んだ位置の判断。主キーは施設と `seq` で、`location_decision` を指す。1つの判断を2つの点検が読むことはない。
- `record_sha256` は点検が読んだ行の指紋で、registry の `recordSHA256` の値である。採用の行（`adoption_sha256` を持つ判断）では `adoption_sha256` と同じ値にする。それ以外の判断を点検の対象にできるのは、その判断が今の判断であるあいだだけで、`record_sha256` は書き出した台帳の施設の行の指紋（`ledgerdb.digest`）と同じ値にする。施設の名称・住所・電話番号を直すとこの指紋が変わり、組み立てが止まる。そのときは点検し直して `record_sha256` を更新する。

registry の `previousAssessment`（旧調査の要約のパスと hash）は持たない。指す先のファイルを消したためである。

### 表で検査しないこと

- 原本の sha256 をファイルと照合すること。原本は採用とレビューの後に持たない。`cmd/builddata` も原本のファイルを開かず、`snapshotSHA256` が64桁の16進小文字であることだけを検査する。
- 利用者が指定した位置を、決定の原本と採用前の施設に照らすこと。採用した行は `adoption_extra` に残り、`adoption_sha256` で固定される。
- 作成者とレビュー者の独立性と、根拠の中身。表が検査するのは2人の名前が違うことだけなので、原本と建物の対応の独立レビューは省かない。

`groupImpacts` と `reviewQueue` は表の行から導けるので、`ledgerdb.py summary` が出す。

## JSON の列

JSON の列は8つある。SQLite の中では空白を入れない JSON 文字列として持つ。

- 文字列の並びは6列：`relation.hours`、`relation.maintenance_notes`、`relation.change_previous_place_ids`、`relation.change_raw`、`location_research.blockers`、`location_research.next_source_urls`。どれも順序に意味があり、要素は他の表を参照しない。並びを子の表に分けると、順序の列が増えるだけで検査できることは増えない。スキーマは `json_valid` と配列型を CHECK で検査し、組み立ては要素が文字列であることを検査する。
- `source_review.selection_review` は、registry の `selectionReview` を形を変えずに写したオブジェクト。
- オブジェクトにはもう1列、`location_decision.adoption_extra` がある。採用した位置の行の項目は、出典ごとに違う。補助の取得記録の並び、データセットの説明、同定の確認、利用者承認の項目などで、入れ子の形も行ごとに違う。どの採用にも共通する施設 ID・位置・根拠・`scope` は列に分け、残りをこの列に入れる。組み立てでは `adoption_sha256` と照合するので、中身を変えれば検出できる。中の取得記録は、削除した原本のパスを含む。

これ以外の入れ子のオブジェクト（根拠、位置、`change`、`locationReview`、建物グループ）は、すべて列か別の表に分けた。

## 集計

`ledgerdb.py summary --as-of 日付` は、表だけを入力に次の値を JSON で書く。`--db` を省くと行ファイルからメモリ上で組み立てる。定義は `ledgerdb.py` の `SUMMARY_VIEWS`（一時ビュー）と `SUMMARY_QUERIES`（問い合わせ）にあり、`:as_of` が基準日である。

```sh
python3 -B tools/db/ledgerdb.py summary --as-of 2026-11-06
```

| 出力 | 内容 |
| --- | --- |
| `facilities` | 施設の総数と、今の位置の状態別の数。`located` は位置あり、`held` は名称・住所の変更で保留中、`withdrawn` は撤回、`none` は判断なし |
| `locationDecisions` | 判断の種類別の行数、今の判断の種類別の数、採用の由来別の数 |
| `relations` | 配布関係の状態別の数と、`review_until` が基準日より前の関係 |
| `locationReview` | 再確認の予定日を持つ今の判断の一覧（`reviewQueue`）と、そのうち予定日が基準日より前の数。名称・住所の変更か後続の判断がある施設を含む建物グループ（`groupImpacts`） |
| `research` | 調査記録の作業単位別・状態別の行数と、位置を持たない施設のうち調査記録がある数・ない数。試した取得の数と、`nextSource` を持つ調査記録の数 |
| `locationCandidates` | 位置の候補の行数・施設数と、レビューの判断を持つ行数 |
| `locationRechecks` | 再確認の候補の施設数と、`kind` 別の数 |
| `userAnswers` | 利用者の回答の数、回答がある施設の数、そのうち位置を持たない施設の数 |
| `sourceReviews` | 点検の状態別の数、点検が読んだ判断の状態別の数、位置がある施設のうち今の判断を点検が読んでいない数 |

- 公開データとの突き合わせ（表示の有無、生成された確認状態）は `tools/national/coverage.py` が受け持つ（[監査](audits.md)）。この集計では数えない。
- 基準日を過ぎても位置や配布関係は失効させない。期限を過ぎた行を並べるだけである。
- `review_until` と `review_due` が基準日と同じ日なら、過ぎたとは数えない。

## 行ファイルの正規形

- 1行に1レコードを書く。行の順は主キーの順（SQLite の BINARY 照合）とする。
- キーは表の列の定義順に並べ、値が NULL の列も `null` で書く。
- JSON の列は文字列ではなく、配列やオブジェクトのまま書く。
- `json.dumps(行, ensure_ascii=False)` の出力に改行を足す。区切りは `, ` と `: `。行がない表は空のファイルにする。

`build` は列の順と行の順を問わずに読む。値は列の型どおりに書く。SQLite は STRICT の表でも、真偽値を整数に、数字の文字列や `1.0` を整数に、数値を文字列に、NaN を NULL に変えて受け付けるので、組み立てはこうした値を SQLite に入れる前に拒否する。拒否するのは、文字列の列の文字列以外、整数の列の整数以外（真偽値を含む）、実数の列の有限の数以外、JSON の列の NaN と Infinity、1つの行で繰り返したキーである。

正規形にそろえるのは `dump` である。`test_ledgerdb.py` は、リポジトリの行ファイルが「組み立て → 書き戻し」で1バイトも変わらないことを検査する。

## 行を直す手順

表を直接直し、最後に書き戻しが検査を通って、行ファイルの差分をレビューできる状態にする。直し方は2通りある。

SQL で直して書き戻す。`sqlite3` コマンドがなくても、Python 3.12 以降の標準の `python3 -m sqlite3` で開ける。

```sh
python3 -B tools/db/ledgerdb.py build
python3 -m sqlite3 data/work/ledger.sqlite3
python3 -B tools/db/ledgerdb.py dump
```

- 開いたら、最初に `PRAGMA foreign_keys = ON;` を実行する。`python3 -m sqlite3` は1行に1文を実行し、文ごとに確定する。`.quit` で終える。
- 1文だけなら `python3 -m sqlite3 data/work/ledger.sqlite3 "UPDATE …"` でも実行できる。この形は複数の文を受け付けないので、外部キーの検査は `dump` に任せる。
- `dump` は SQLite ファイルの行を新しい DB に入れ直して、すべての検査をしてから書く。違反があれば、表名と主キーを示して止まる。そのときは行ファイルを書かない。

行ファイルを直す。

```sh
python3 -B tools/db/ledgerdb.py build --check
python3 -B tools/db/ledgerdb.py build
python3 -B tools/db/ledgerdb.py dump
```

- 行ファイルを編集してから `build --check` で検査する。違反は表名と主キーを示して非ゼロで終わる。
- 通ったら `build` と `dump` で正規形にそろえる。

どちらでも、直したら `python3 -B tools/build-real-data.py` で公開データを作り直し、変わった施設と関係を確かめる。

### 根拠を足す

根拠の行を足すときは、`legacy_snapshot_path` を NULL にし、`snapshot_sha256` にレビューした原本の sha256、`fetched_at` にその原本の取得記録の `fetchedAt` を入れる。`id` に仮の値（`evidence:` で始まる文字列）を入れて `build --check` を実行する。違反の文に `expected` として正しい `id` が出るので、それを `id` と参照する列に入れる。根拠の内容を直すときも、既存の行は書き換えずに新しい行を足して参照を付け替える。

### 位置を採用する

位置を持たない施設（判断がないか、今の判断が撤回の施設）に採用の行を足す。判断がない施設では `seq = 1` の `adopt` にする。撤回した施設では、次の `seq` の `correct` で新しい位置を置く（[位置の判断を足す](#位置の判断を足す)）。

1. `python3 -B tools/db/ledgerdb.py fingerprint 施設ID` を実行し、`nextDecision` を雛形にする。判断がない施設の雛形は `seq = 1`・`adopt`・`approved-location` で、`identity_name`・`identity_address` に今の施設の名称・住所が入っている。
2. `lat`・`lng`・`scope`・`evidence_id`（位置の根拠）を入れる。根拠の行がまだなければ先に足す（[根拠を足す](#根拠を足す)）。採用の行の項目のうち、これら以外のもの（補助の取得記録、建物の同定、利用条件など）は `adoption_extra` に入れる。項目名は既存の行に合わせる（下の例）。
3. `reason` は `scope` から決まる文（`building` なら `Adopted building representative point`。ほかは `ledgerdb.py` の `ADOPTION_REASONS`）、`reviewed_at` は根拠の確認日（日付）、`address_status` は `valid` にする。
4. 同じ変更で、その施設の `location_research_attempt`・`location_research`・`location_candidate` の行を消す。`user_answer` は消さない。
5. `adoption_sha256` に64桁の仮の値を入れて、もう一度 `fingerprint` を実行する。`decisions[0].adoption_sha256` が行の内容から計算した値なので、それを入れる。
6. `build --check` を通す。判断の日付が `tools/build-real-data.py` の基準日 `AS_OF` より後だと、公開データを作り直すときに `cmd/builddata` が止まる（`location decision is after evaluatedAt`）。基準日は、新しい根拠を確かめてから更新する。

`adoption_extra` の例。公開データセットの点を採用し、座標系と加工方法を残す。

```json
{"datasetEvidence": {"publisher": "<提供者>", "dataset": "<データセット名と版>", "referenceDate": "<基準年月>", "originalCRS": "EPSG:6668 / JGD2011", "originalAxisOrder": "longitude, latitude", "processing": "<点の取り出し方と加工。座標変換の有無>"}}
```

- 座標系は `originalCRS`、軸の順は `originalAxisOrder`、加工方法は `processing` に書く。精度の項目を持つ既存の行はないので、分かった精度は `processing` の文に書く。
- 補助の取得記録は `supportingEvidence` の並びに入れる。既存の行で最も多い項目である。原本のパスは入れない。
- `facilityId`・`coordinate`・`evidence`・`scope` は列にあるので入れない。入れると組み立てが止まる。

出典の利用条件を点検したときは、`source_review` の行と `source_review_target`（その採用の `seq` と、`record_sha256` に `adoption_sha256` と同じ値）を足す。

### 位置の判断を足す

再確認（`reaffirm`）・訂正（`correct`）・撤回（`withdraw`）は、既存の行を書き換えず、次の `seq` の行を足す。

1. `fingerprint` を実行し、`nextDecision` を雛形にする。採用の行（`input-ledger` とレビューの記録を持たない採用を含む）は書き換えない。`seq`・`previous_state_sha256`・`identity_name`・`identity_address` が入っている。名称・住所は今の施設の値なので、判断のときに確かめた値と違えば直す。
2. `action`、`evidence_id`、`decision_id`（全体で一意）、`reason_type`（`spelling`・`relocation`・`source-withdrawal`・`evidence-update`）、`prepared_by` と `reviewed_by`（別の主体）、`reviewed_at`（直前の判断と根拠の確認日より前にしない）、`reason`、`address_status` を入れる。必要なら `source_version` と `review_due` も入れる。
3. 位置は、再確認では直前と同じ、訂正では直前と違う値にする。撤回では `lat`・`lng` を NULL にする。`relocation` と `source-withdrawal` を再確認の理由にはできない。
4. その施設の `location_recheck` の行を消す。撤回した施設には再確認の候補を残せない。
5. 直前の判断が採用の指紋（`adoption_sha256`）を持たないなら、その判断を読んだ `source_review_target` の行を消す。採用の指紋を持たない判断（`input-ledger` の採用を含む）を点検の対象にできるのは、それが今の判断であるあいだだけである。新しい判断を点検したときは、その `seq` の行を足し、`record_sha256` に `fingerprint` の `placeSHA256` を入れる。`placeSHA256` は点検の対象の指紋を除いた検査を通る行から計算するので、古い `record_sha256` が合わなくなった後も出る。
6. `build --check` を通す。判断の日付が `tools/build-real-data.py` の基準日 `AS_OF` より後だと、公開データを作り直すときに `cmd/builddata` が止まる（`location decision is after evaluatedAt`）。基準日は、新しい根拠を確かめてから更新する。

`review_due` は再確認の予定日で、過ぎても位置は失効しない。`ledgerdb.py summary` の `reviewQueue` に並ぶ。

### 施設の名称・住所を直す

`facility` の名称・住所を直すと、レビュー済みの判断と食い違う施設は、位置が保留になる（`needs-review`）。同じ建物グループの施設も保留になる。保留を解くには、確かめた名称・住所で再確認か訂正の判断を足す。電話番号の変更は保留にしないが、採用でない判断を読んだ `source_review_target` の `record_sha256` が合わなくなる。点検し直して `fingerprint` の `placeSHA256` に更新する。

元の抽出 ID が変わったときは `facility_legacy_id` に行を足す。`position` は0からの連番にする。

### 建物グループを作る

`building_group` に ID と、同じ建物だと裏付ける根拠を足し、`building_group_member` に施設を2つ以上足す。施設はどれもレビュー済みの採用を持ち、1つのグループにしか入れない。`position` は0からの連番にする。住所や座標が同じだけでは、グループにしない。

### 配布関係を直す

`relation` の行は判断の履歴ではないので、状態・時間・条件・期限・根拠・`source_hash` を直接直す。`source_hash` は `cmd/builddata` が `data/work/internal-data/quality.json` に出す原典の指紋で、原文と公式情報を確かめてから入れる。公式に記載された別窓口を足すときは、[施設と配布関係を足す](#施設と配布関係を足す)。

### 施設と配布関係を足す

施設は `facility`、配布関係は `relation` に行を足す。先に根拠の行を足しておく（[根拠を足す](#根拠を足す)）。

足す施設が一覧から抽出されているかを、`python3 -B tools/build-real-data.py` の出力 `data/work/internal-data/full.json` で確かめる。台帳にない抽出の施設は `places` に `place:` で始まる ID のまま残り、そのカードの `relations` が同じ ID を指す。

| 場合 | `facility.id` | `facility_legacy_id` | `relation.change_*` |
| --- | --- | --- | --- |
| 一覧から抽出された施設 | `facility:<地方>-<place: の後の20桁>` | その `place:` の ID を `position` 0 で足す | 4列とも NULL |
| 公式に記載があり、抽出されていない別窓口 | `facility:<地方>-<窓口を表す英小文字の名前>` | 足さない | 4列をそろえて入れる |

- `<地方>` は既存の ID の接頭辞（`north`・`kanto-north`・`kanto-south`・`chubu-east`・`chubu-west`・`kinki`・`kyushu` など）に合わせる。ID は重複しなければよい。
- `identity_evidence_id` は、その窓口がそこにあることを示す根拠にする。位置の根拠は流用しない。
- `cmd/builddata` は、抽出の ID を持つ施設には、そのどれかが今の一覧から抽出されていることを求める。抽出の ID を持たない施設には、`change_*` を持つ配布関係を1つ以上求める。
- `source_hash` には `data/work/internal-data/quality.json` の `sourceHashes` から、そのカード番号の値を入れる。原文と公式情報を確かめてから入れる。値が合わない関係は、公開データで `needs-review` になる。
- 一覧にない関係では、`change_kind` を `addition`、`change_reason` を足した理由、`change_raw` を公式の記載の文の並びにする。`change_previous_place_ids` には、並べて残す同じカードの抽出の関係を `place:` の ID で入れる。指す関係を決めないときは空の配列でよい。`cmd/builddata` は、並べた ID がそのカードの抽出の関係にあることを検査する。
- 一覧にある関係に `change_*` を入れると、`cmd/builddata` が拒否する。

例。`< >` の値は形を示す仮のものである。

`facility.jsonl` に足す行は次のとおり。

```json
{"id": "facility:kyushu-<place: の後の20桁>", "name": "<施設名と窓口>", "address": "<住所>", "phone": "", "identity_evidence_id": "evidence:<24桁>"}
{"id": "facility:kyushu-<窓口の名前>", "name": "<施設名と窓口>", "address": "<住所>", "phone": "", "identity_evidence_id": "evidence:<24桁>"}
```

`facility_legacy_id.jsonl` に足す行は次のとおり。

```json
{"legacy_id": "place:<20桁>", "facility_id": "facility:kyushu-<place: の後の20桁>", "position": 0}
```

`relation.jsonl` に足す行は次のとおり。

```json
{"id": "relation:<重複しない文字列>", "card_id": "<カード番号>", "facility_id": "facility:kyushu-<place: の後の20桁>", "valid_from": null, "valid_to": null, "status": "active", "condition": "", "hours": ["<配布時間>"], "review_until": null, "maintenance_notes": null, "change_kind": null, "change_reason": null, "change_previous_place_ids": null, "change_raw": null, "source_hash": "<sourceHashes のカード番号の値>", "evidence_id": "evidence:<24桁>"}
{"id": "relation:<重複しない文字列>", "card_id": "<カード番号>", "facility_id": "facility:kyushu-<窓口の名前>", "valid_from": null, "valid_to": null, "status": "active", "condition": "<条件>", "hours": ["<配布時間>"], "review_until": null, "maintenance_notes": null, "change_kind": "addition", "change_reason": "<足した理由>", "change_previous_place_ids": [], "change_raw": ["<公式の記載の文>"], "source_hash": "<sourceHashes のカード番号の値>", "evidence_id": "evidence:<24桁>"}
```

足したら `build --check` を通し、`python3 -B tools/build-real-data.py` で作り直す。`data/work/internal-data/full.json` で、足した関係の `review` が `verified` になっていることを確かめる。施設の位置は別に採用の行を足すまで出ない（[位置を採用する](#位置を採用する)）。

### 期間の違う配布関係

時期によって時間や条件が変わる配布は、期間ごとに `relation` の行を分ける（例：4〜5月と9〜10月）。それぞれ `valid_from`・`valid_to` を持ち、期間は重ねない。新しい行の `id` は重複しない文字列にする。

- `cmd/builddata` は、生成の基準日（`-as-of`）に当てはまる行を1つ選ぶ。期間に基準日を含む行があればその行、なければ次に始まる行、それもなければ最後に終わった行である。
- 選んだ行の状態・時間・条件・期間・期限・根拠が、そのカードと施設の関係として公開データに出る。期間の外では、1行だけの関係と同じく、開始前は `upcoming`、終了後は `ended` になる。選ばれなかった行は公開データに出ない。
- 期間が重なる行と、期間を持たない行をほかの行と並べることは、組み立て（`build --check`）と `cmd/builddata` のどちらも拒否する。
- 別窓口を足した関係（`change_*`）を期間で分けるときは、すべての行に同じ `change_*` を入れる。違えば `cmd/builddata` が拒否する。


### カード番号を足す・直す

`data/card-ids.json` を直すか `python3 -B tools/build-real-data.py --update-card-ids` で番号を足したら、表に写す。

```sh
python3 -B tools/db/ledgerdb.py import-card-ids
```

配布関係が使う番号を `ids` から消すと、外部キーの検査で止まる。

### 調査記録を足す

位置を持たない施設を調べたら、`location_research` に行を足す。`source_ref` は施設ごとに一意な文字列で、調査を記録した Issue や PR を指す。試した取得は `location_research_attempt` に `position` の順で足す。取得した原本は Git に入れない（[データ保守](data-maintenance.md#原本の置き場)）。

### 利用者の回答を記録する

1. 回答の原文と受領の記録（受け取った日時と経路）を、`data/user-answers/<Issue など>/` のファイルに置く。置いた後は書き換えない。
2. `user_answer` に1回答1行を足す。`source_ref` は置いたファイルのリポジトリのルートからのパスに、回答の位置を付けたものにする。位置は、JSON なら `#` と JSON ポインタ、Markdown なら `#L<開始行>-L<終了行>` で書く。
3. `user_answer_facility` に、回答が対象とする施設を `position` 0 から足す。

`data/user-answers/issue<番号>/answers.json` の `answers` の0番目の回答を記録する例を示す。

```json
{"source_ref": "data/user-answers/issue<番号>/answers.json#/answers/0", "work_unit": "issue<番号>", "actor_type": "human", "answered_at": "<受領の記録の日付か時刻>", "question": "<質問の文>", "answer": "<回答の文を書き換えずに>", "answer_field": "answer"}
```

```json
{"source_ref": "data/user-answers/issue<番号>/answers.json#/answers/0", "facility_id": "<施設 ID>", "position": 0}
```

- `work_unit` は、ファイルを置いたディレクトリの名前にする。
- `answer_field` は回答の文があった項目の名前で、Markdown から写したときは NULL にする。質問の文がなければ `question` も NULL にする。
