# 台帳データベースの設計

配布施設の台帳を SQLite の表で持つ。正本は2つで、スキーマ `tools/db/schema.sql` と、表ごとの行ファイル `data/db/<表>.jsonl` である。SQLite ファイルはこの2つから作る生成物で、Git に入れない。移行の段階は [Issue #237](https://github.com/aki05162525/manhole-card-map/issues/237) で管理する。

`tools/build-real-data.py` は表から書き出した台帳を `cmd/builddata` に渡し、公開データを作る。assemble.py・manifest・`data/national`・`data/evidence` は読まない。

段階Cまでは、`tools/national/assemble.py` が manifest から組み立てる台帳を正とする。行ファイルはその写しで、表から書き出した台帳が assemble の出力と JSON として等しいことを `tools/db/test_ledgerdb.py` が検査する（CI の backend ジョブで、`go test ./...` から呼ぶ）。比べ方は assemble.py の `exact` と同じで、キーの順は問わず、`true` と `1` は区別する。

## 道具

| ファイル | 役割 |
| --- | --- |
| `tools/db/schema.sql` | 表の定義。外部キー・NOT NULL・CHECK・UNIQUE で不変条件を表す。すべて STRICT 表 |
| `tools/db/ledgerdb.py build` | 行ファイルを検査して SQLite ファイルを作る。既定の出力先は `data/work/ledger.sqlite3`。`--check` を付けるとメモリ上で検査だけする |
| `tools/db/ledgerdb.py dump` | SQLite ファイルを検査し直してから、行ファイルを正規形で書く |
| `tools/db/ledgerdb.py export-ledger` | PlaceLedger schema 1 の JSON を書く。`--db` を省くと行ファイルからメモリ上で組み立てる。`tools/build-real-data.py` はこの出力を使う |
| `tools/db/ledgerdb.py summary --as-of 日付` | 表だけを入力に件数と再確認の一覧を JSON で書く（[集計](#集計)） |
| `tools/db/migrate_from_assemble.py` | 行ファイルを作る移行用の道具。入力は assemble の台帳出力と監査出力、`data/card-ids.json`、manifest が選ぶ位置採用の行と位置ライフサイクルの原本。調査記録と出典の点検の表は作らず、既存の行を引き継ぐ。段階Cで assemble.py と一緒に消す |
| `tools/db/migrate_research.py` | 調査記録・位置の候補・再確認の候補・利用者の回答・出典の点検の9表を、`data/national` と `data/evidence` の記録から作る移行用の道具。`--report` で作業単位別の件数と、読めずに外した項目を出す。2回実行しても行ファイルは変わらない。段階C2で `data/national` と一緒に消す |

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
| `snapshot_sha256` | 保存した原本の sha256 |
| `legacy_snapshot_path` | 原本の保存先（`data/evidence` の中）。段階Dで原本と一緒に列ごと消す |
| `source_locator` | 原本の中の該当箇所 |
| `checked_at` | 確認日。元の記録が時刻を持つ場合は、時差を付けた時刻をそのまま持つ |
| `actor_type` | 確認した主体。`ai` か `human` |
| `verification_method` | 確認の方法 |

内容が完全に同じ根拠は1行にまとめる。`id` は `legacy_snapshot_path` を除く6列を、この順の JSON 配列（区切りに空白を入れない、非 ASCII をそのまま書く）にして sha256 を取り、先頭24桁を使う。`legacy_snapshot_path` を除くので、段階Dでこの列を消しても `id` は変わらない。6列の組には UNIQUE をかける。組み立ては `id` が内容と合っているかを検査する。内容を直すときは、新しい `id` の行を作って参照を付け替える。

### facility、facility_legacy_id

- `facility` は施設の ID・名称・住所・電話番号と、施設の同定に使った根拠 `identity_evidence_id`。電話番号がない施設は空文字にする。
- 同定の根拠は位置の根拠で置き換えない。位置の根拠は `location_decision` に置く。
- 根拠の URL にはホスト名が要り、利用者名を含めない。この検査は組み立てで行う。
- `facility_legacy_id` は元の抽出 ID。`legacy_id` は全施設を通じて一意で、`position` は台帳の `legacyIds` の並び順（0から連番）。

### relation

カードと施設の配布関係。

- `id` は関係そのものの ID で、カードや施設を直しても変えない。移行のときは、カード・施設・適用期間から決定的に作った。新しく足す行は重複しない任意の文字列にしてよい。
- `card_id` は `card`、`facility_id` は `facility` への外部キー。
- `valid_from`・`valid_to` は適用期間。開始は終了以前とする。カード・施設・適用期間の組には一意の索引をかけ、期間の NULL は同じ値として扱う。同じカードと施設でも、期間が違えば別の行として持てる。
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
| `adoption_source` | 採用の由来。採用の行では必須で、それ以外の行では NULL。`approved-location` は manifest の `locations[].approved` で承認した位置の採用。`input-ledger` は manifest の入力の台帳がもとから持っていた座標 |
| `adoption_sha256` | 承認した位置の行の指紋。`approved-location` の採用では必須で、それ以外の行では NULL |
| `adoption_extra` | 採用した位置の行のうち、施設 ID・位置・根拠・`scope` 以外の項目 |
| `decision_id`・`reason_type`・`prepared_by`・`reviewed_by` | 採用の後の判断に必須。作成者とレビュー者は別にする |
| `reviewed_at`・`reason`・`address_status`・`identity_name`・`identity_address` | 位置ライフサイクルの管理下にある判断の記録。5列はそろって値を持つか、そろって NULL にする |
| `source_version`・`review_due` | 位置の元資料の版と、再確認の予定日 |

組み立てでは次も検査する。

- 連番に抜けがない。
- 採用の後の判断の直前には、ライフサイクルの管理下にある判断がある。日付はその判断より前にしない。
- 判断の日付はその根拠の確認日（時刻付きなら日付にしたもの）より前にしない。
- 再確認は位置を変えない。訂正は位置を変える。
- ライフサイクルの管理下にある採用では、`reason` は `scope` と承認の種類から決まる文、`reviewed_at` は根拠の確認日、`address_status` は `valid` にする。位置ライフサイクルが採用時の状態をこう作るためである。

### 指紋の連鎖

指紋は2種類あり、どちらも `tools/national/location_lifecycle.py` と同じ計算で作る。値を JSON にし（キーを並べ替え、非 ASCII をそのまま書く）、その sha256 を取る。組み立てのたびに、行の内容から計算し直して照合する。

- `adoption_sha256` は、採用した位置の行の指紋である。その行は `facilityId`・`coordinate`・`evidence`（確認日時は元のまま）・`scope` に `adoption_extra` の項目を足したもので、`ledgerdb.adoption_record` が組み立てる。manifest の `locations[].approved[].sha256` と、位置ライフサイクルの `adoptionSHA256` の値を、そのまま引き継いだ。
- `previous_state_sha256` は、直前の判断の後の状態の指紋である。状態は `identity`・`coordinate`・`evidence`（確認日は日付）・`status`・`addressStatus`・`reason`・`decisionId`・`reviewedAt`・`sourceVersion`・`reviewDue` の10項目で、`ledgerdb.decision_state` が組み立てる。位置ライフサイクルの各判断の `previousSHA256` の値を、そのまま引き継いだ。

指紋が守る範囲は次のとおり。

- `adoption_sha256` が守るのは、`approved-location` の採用の施設 ID・緯度経度・根拠・`scope`・`adoption_extra` である。
- 後続の判断がある行は、次の行の `previous_state_sha256` が状態の10項目を守る。
- 後続の判断がない採用では、`identity_name`・`identity_address`・`source_version`・`review_due` を変えても検出できない。
- `input-ledger` の採用（移行時の134施設）は指紋で固定していない。その座標は manifest の入力の台帳にもとからあり、位置を承認した記録がない。変更はPRの差分のレビューで確かめる。`input-ledger` の採用は施設の同定の根拠を位置の根拠に使う。組み立てはこの決まりを検査するので、位置の根拠を別に持つ採用を `input-ledger` にはできない。

台帳への書き出しは次のとおり。

- 施設の `evidence` は今の判断の根拠にする。判断がない施設では同定の根拠にする。
- `coordinate` は今の判断の位置にする。
- `reason` を持つ判断がある施設には `locationReview` を出す。
- 施設の名称・住所が `identity_name`・`identity_address` と違えば保留とみなし、位置を出さずに `needs-review` を出す。
- 保留の施設と同じ建物グループの施設も保留にする。理由の文は `A reviewed building group member changed identity` にする。

### building_group、building_group_member

同じ建物にある施設の組。位置ライフサイクルの原本の `groups` を移した。

- `building_group` はグループの ID と、同じ建物だと裏付ける根拠 `evidence_id`。
- `building_group_member` は所属する施設と、原本の `facilityIds` の並び順 `position`。主キーが施設なので、1つの施設は1つのグループにしか入らない。
- グループには施設が2つ以上要る。所属する施設はライフサイクルの管理下にある採用を持つ。どちらも組み立てで検査する。

### location_research

位置を持たない施設について、過去の作業単位が何を調べ、なぜ保留したかの記録。同じ施設を一から調べ直さないために残す。主キーは施設と `source_ref`。

| 列 | 意味 |
| --- | --- |
| `source_ref` | 元の記録。取り込んだ行では `data/national/<ファイル>#<JSON ポインタ>` で、d5402e11 の時点のファイルを指す |
| `work_unit` | 元の作業単位の名前。取り込んだ行では `data/national` の直下のディレクトリ名（`issue7`、`location-batch2` など） |
| `researched_at` | 作業単位が記録した日付か時刻。記録の項目（`checkedAt`、`endedAt`）を優先し、なければファイルの終了時刻、最後に基準日を使う。どれもなければ NULL |
| `status`・`stage` | 作業単位が付けた状態と段階。値は作業単位ごとに違い、共通の語彙にそろえていない |
| `blockers` | 阻害要因の並び（JSON 配列） |
| `finding` | 調べて分かったこと |
| `stop_condition`・`resume_condition`・`next_action` | 停止条件・再開条件・次の行動 |
| `next_source`、`next_source_*` | `issue7` の `nextSource` を元の項目名のまま写したもの（下を参照） |

- 文は元の記録から書き換えずに写した。要約・言い換え・推測での補完はしていない。元が文字列の並びなら、改行でつないで1つの文字列にした（要素に改行を含むものはない）。
- AI の調査を人の確認として記録しない。この表には利用者の回答や電話・現地の確認を入れていない。利用者の回答は `user_answer` に置く。
- 位置を採用した施設には行を持たせない。今の判断が採用・再確認・訂正の施設に行があると、組み立ては止まる。位置を採用するときは、同じ変更でその施設の行を消す。撤回した施設には行を持たせてよい。
- 少なくとも1つの列が値を持つ。

取り込んだのは、各作業単位の最終の成果ファイルのうち、位置を持たない施設を含むものである。作業単位ごとの項目の対応は `migrate_research.py` の `SOURCES` と `GENERIC` にある。`issue7` の地域別ファイルは `investigationStatus` を状態、`reasonCategory` を阻害要因、`reason` を分かったことにした。`nextSource` は次の行動にも再開条件にも読み替えず、元の項目名に対応する列へ写した。文字列なら `next_source`（41行）に入れた。オブジェクトなら、`url` を `next_source_url`（327行）、`urls` を `next_source_urls`（57行、JSON 配列）、`required`・`needed`・`task`・`notRequired` を `next_source_required`（151行）・`next_source_needed`（94行）・`next_source_task`（139行）・`next_source_not_required`（32行）に入れた。オブジェクトの384行はすべてこれらの項目だけでできている。

### location_research_attempt

調査記録が試した取得の一覧。同じ取得を繰り返さないために残す。`issue7` の `attempts` の1801件を移した。主キーは調査記録（施設と `source_ref`）と、`attempts` の中の順序 `position`（0から連番）。

| 列 | 元の項目 |
| --- | --- |
| `kind` | `kind` か `type` |
| `source_url` | `sourceUrl` か `url`。URL を持たない記録（保存済みの資料を読み直したものなど）は NULL |
| `http_status` | `status`（数値） |
| `result` | `result` か `outcome` |
| `error` | `error` |
| `attempted_at` | `fetchedAt` か `checkedAt` |
| `snapshot_sha256` | `snapshotSHA256` |

- 1つの記録が同じ列に当たる項目を2つ持つことはない。
- `data/evidence` のパス（`snapshotPath`、`sourcePath` など）は移していない。
- `source_url`・`result`・`error` のどれか1つは値を持つ。

### location_candidate

位置を持たない施設の、採用しなかった位置の候補。採用の行と混ざらないよう、`location_decision` とは別の表にした。主キーは施設と `source_ref`。

- 移行では、`tools/national/source_inventory.py` が候補として数える行を移した。manifest の位置の選択が指すファイルと `issue7` の地域別ファイルの `updates` のうち、選ばれていない行である。施設と行の内容が同じものは1行にまとめた。46行、45施設。
- 緯度経度、`scope`、根拠の出典 URL・該当箇所・確認日は、候補の行の値をそのまま写した。
- `review_ref`・`review_status`・`review_reason` は、その候補を読んだレビューの判断。レビューのファイルが読んだ候補のファイルを `input.path` で示し、同じ施設の判断（`decision` か `status`）を持つ記録がある場合だけ、その記録の判断と理由（`reason` か `finding`）を写した。移行では19行にある。27行は、読んだ候補のファイルを示すレビューがない。
- `location_research` と同じく、位置を採用した施設には行を持たせない。位置を採用する変更で、その施設の行を消す。

### location_recheck

位置は採用済みだが、元の調査が移転や座標の競合を挙げていた施設。案内先が誤っている危険が比較的高いので、再確認の候補として残す。主キーは施設と `source_ref`。

- 移行では `issue7` の地域別ファイルの `unresolved` のうち、今の位置を持つ施設で、`reasonCategory` が `tools/national/national_audit.py` の移転・競合の分類に入る行を移した。58施設で、監査の `identity-or-coordinate-conflict` と同じ集合である。
- `kind` は `reasonCategory`、`text` は `reason` の文をそのまま写した。
- 「再確認が済んだ」という状態は持たない。再確認したら `location_decision` に判断の行を足し、この表の行を消す。今の位置を持たない施設には行を持たせない。

### user_answer、user_answer_facility

利用者が答えた内容。人の確認は取り直せないので、位置を採用した後も残す。

| 列 | 意味 |
| --- | --- |
| `source_ref` | 元の記録（主キー） |
| `work_unit` | 元の作業単位。`data/national` か `data/evidence` の直下のディレクトリ名で、`data/evidence/national` の下では、その下のディレクトリ名 |
| `actor_type` | 回答者の種別。`human` だけを置ける |
| `answered_at` | 記録の日付か時刻（`checkedAt`、`receivedAt`）。なければファイルの日付（`receivedAt`、`reportedConfirmationDate`） |
| `question` | 記録にある質問の文（`receivedQuestionSummary`、`question`）。なければ NULL |
| `answer` | 回答の文 |
| `answer_field` | 回答の文があった項目の名前（`answer`、`responseVerbatim`、`report`、`reportedNarrative`） |

- `user_answer_facility` は回答が対象とする施設と、元の並び順 `position`。回答には施設が1つ以上要る。
- 文は元の記録から書き換えずに写した。AI の調査や推論はこの表に入れない。
- 移行では59件を移した。`issue57/human-responses.json` の34件、`kanto-prefecture/gunma/round2-human-responses.json` の4件、`data/evidence/issue60/manual-user-additional/inputs/issue60-recheck-chiba-nov6/human-report.json` の5件、`data/evidence/national/shizuoka-human-followup*-20261106/human-answers.json` の16件である。静岡の1件は台帳にない ID（`place:9a87f499507373493a47`）を指すので移していない。

### source_review、source_review_evidence、source_review_target

位置の出典の利用条件の点検。`data/national/source-review/registry.json` を移した。

- `source_review` は点検の ID、出典の名前・版・加工方法、状態、確認日、確認主体、条件、注記と、点検対象を訂正した経緯 `selection_review`（registry の `selectionReview` をそのまま写した JSON オブジェクト）。状態は `unreviewed`・`needs-review`・`conditional`・`usable`・`prohibited` のいずれか。`conditional` と `usable` も記載した用途と加工の条件での点検の結果であり、位置の採用の承認ではない。
- `source_review_evidence` は点検の根拠の URL・該当箇所・確認日で、`position` は registry の並び順。根拠は1件以上要り、確認日は点検の確認日より後にしない。
- `source_review_target` は点検が読んだ位置の判断。主キーは施設と `seq` で、`location_decision` を指す。1つの判断を2つの点検が読むことはない。
- `record_sha256` は点検が読んだ行の指紋で、`tools/national/source_inventory.py` が `recordSHA256` として照合した値である。採用の行（`adoption_sha256` を持つ判断）では `adoption_sha256` と同じ値にする。それ以外の判断を点検の対象にできるのは、その判断が今の判断であるあいだだけで、`record_sha256` は書き出した台帳の施設の行の指紋（`ledgerdb.digest`）と同じ値にする。施設の名称・住所・電話番号を直すとこの指紋が変わり、組み立てが止まる。そのときは点検し直して `record_sha256` を更新する。
- 移行の時点で、18件のうち5件は採用の `adoption_sha256` と一致した。残る13件は位置の訂正（`seq = 2`）を読んだもので、書き出した施設の行の指紋と一致した。

registry の `previousAssessment`（旧調査の要約のパスと hash）は移していない。指す先を段階C2と段階Dで消すためである。

### 位置ライフサイクルから移さないもの

[施設位置の再確認・訂正・取り下げ](location-lifecycle.md) の検査のうち、次の3つは表に移さない。

- 保存原本の sha256 を、`data/evidence` のファイルと照合する検査。原本は段階Dで消す。段階Cで assemble.py を消すまでは、assemble.py がこの検査をする。`cmd/builddata` は原本のファイルを開かず、`snapshotSHA256` が64桁の16進小文字であることだけを検査する。
- 「今の採用」と「紐付けた採用」、「今の座標」と「紐付けたときの座標」が一致するかの検査と、紐付けた採用が撤回なしに消えていないかの検査。位置の採用と位置ライフサイクルが別のファイルにあるときの食い違いを防ぐもので、表では1つの行にまとまるため起きない。
- `groupImpacts` と `reviewQueue`。表の行から導けるので、`ledgerdb.py summary` が出す。

`tools/national/manual_user_approval.py` の検査（利用者が指定した位置を、決定の原本と採用前の施設の指紋に照らす）も移さない。採用前の施設と決定の原本は `data/national` と `data/evidence` にあり、段階Cと段階Dで消すためである。採用した行は `adoption_extra` に残り、`adoption_sha256` で固定される。

## JSON の列

JSON の列は8つある。SQLite の中では空白を入れない JSON 文字列として持つ。

- 文字列の並びは6列：`relation.hours`、`relation.maintenance_notes`、`relation.change_previous_place_ids`、`relation.change_raw`、`location_research.blockers`、`location_research.next_source_urls`。どれも順序に意味があり、要素は他の表を参照しない。並びを子の表に分けると、順序の列が増えるだけで検査できることは増えない。スキーマは `json_valid` と配列型を CHECK で検査し、組み立ては要素が文字列であることを検査する。
- `source_review.selection_review` は、registry の `selectionReview` を形を変えずに写したオブジェクト。
- オブジェクトにはもう1列、`location_decision.adoption_extra` がある。採用した位置の行の項目は、出典ごとに違う。補助の取得記録の並び、データセットの説明、同定の確認、利用者承認の項目などで、入れ子の形も行ごとに違う。どの採用にも共通する施設 ID・位置・根拠・`scope` は列に分け、残りをこの列に入れる。組み立てでは `adoption_sha256` と照合するので、中身を変えれば検出できる。中の取得記録は `data/evidence` のパスを含む。

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

- 公開データとの突き合わせ（表示の有無、生成された確認状態）は `tools/national/coverage.py` が受け持つ。この集計では数えない。
- 基準日を過ぎても位置や配布関係は失効させない。期限を過ぎた行を並べるだけである。
- `review_until` と `review_due` が基準日と同じ日なら、過ぎたとは数えない。

## 行ファイルの正規形

- 1行に1レコードを書く。行の順は主キーの順（SQLite の BINARY 照合）とする。
- キーは表の列の定義順に並べ、値が NULL の列も `null` で書く。
- JSON の列は文字列ではなく、配列やオブジェクトのまま書く。
- `json.dumps(行, ensure_ascii=False)` の出力に改行を足す。区切りは `, ` と `: `。行がない表は空のファイルにする。

`build` は列の順と行の順を問わずに読む。正規形にそろえるのは `dump` である。`test_ledgerdb.py` は、リポジトリの行ファイルが「組み立て → 書き戻し」で1バイトも変わらないことを検査する。

## 行を直す手順

段階Cまでは、台帳の内容を `data/national` と manifest で直し、行ファイルを作り直す。行ファイルだけを直すと、assemble の出力との一致の検査で落ちる。

```sh
python3 -B tools/db/migrate_from_assemble.py
```

`data/card-ids.json` を更新したときも、同じコマンドで作り直す。

`migrate_research.py` が作る9表は assemble の出力に含まれない。`migrate_from_assemble.py` は既存の行を引き継ぐので、段階Cの前でもこの9表は直接直す。manifest で位置を採用した施設に調査記録か位置の候補が残っていると、作り直しは止まる。その施設の行を消してから作り直す。位置を撤回した施設に再確認の候補が残っているときも止まる。`migrate_research.py` は最初の取り込みにだけ使う。表を直した後に実行すると、直した行が `data/national` の記録で上書きされる。

段階C以降は、表を直接直す。どちらの方法でも、最後に書き戻しが検査を通り、行ファイルの差分をレビューできる状態にする。

SQL で直して書き戻す。

```sh
python3 -B tools/db/ledgerdb.py build
sqlite3 data/work/ledger.sqlite3
python3 -B tools/db/ledgerdb.py dump
```

- `sqlite3` の中では、最初に `PRAGMA foreign_keys = ON;` を実行する。
- 位置を新しく採用するときは、その施設の `location_research`（と、その `location_research_attempt`）と `location_candidate` の行を消す。`adoption_source` を `approved-location` にし、`adoption_sha256` に `ledgerdb.digest(ledgerdb.adoption_record(行, 根拠の行))` で計算した値を入れる。
- 位置を撤回・訂正するときは、既存の行を書き換えず、次の `seq` の行を足す。その行の `previous_state_sha256` には直前の行から `ledgerdb.digest(ledgerdb.decision_state(行, 根拠の行))` で計算した値を入れる。
- 根拠の内容を直すときは、新しい行を足して参照を付け替える。`id` は `ledgerdb.evidence_id` で計算する。
- `dump` は SQLite ファイルの行を新しい DB に入れ直して、すべての検査をしてから書く。違反があれば、表名と主キーを示して止まる。そのときは行ファイルを書かない。

行ファイルを直す。

```sh
python3 -B tools/db/ledgerdb.py build --check
python3 -B tools/db/ledgerdb.py build
python3 -B tools/db/ledgerdb.py dump
```

- 行ファイルを編集してから `build --check` で検査する。違反は表名と主キーを示して非ゼロで終わる。
- 通ったら `build` と `dump` で正規形にそろえる。
