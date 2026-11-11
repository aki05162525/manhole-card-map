# 台帳データベースの設計

配布施設の台帳を SQLite の表で持つ。正本は2つで、スキーマ `tools/db/schema.sql` と、表ごとの行ファイル `data/db/<表>.jsonl` である。SQLite ファイルはこの2つから作る生成物で、Git に入れない。移行の段階は [Issue #237](https://github.com/aki05162525/manhole-card-map/issues/237) で管理する。

段階Cまでは、`tools/national/assemble.py` が manifest から組み立てる台帳を正とする。行ファイルはその写しで、表から書き出した台帳が assemble の出力とバイト単位で一致することを `tools/db/test_ledgerdb.py` が検査する（CI の backend ジョブで、`go test ./...` から呼ぶ）。

## 道具

| ファイル | 役割 |
| --- | --- |
| `tools/db/schema.sql` | 表の定義。外部キー・NOT NULL・CHECK・UNIQUE で不変条件を表す。すべて STRICT 表 |
| `tools/db/ledgerdb.py build` | 行ファイルを検査して SQLite ファイルを作る。既定の出力先は `data/work/ledger.sqlite3`。`--check` を付けるとメモリ上で検査だけする |
| `tools/db/ledgerdb.py dump` | SQLite ファイルを検査し直してから、行ファイルを正規形で書く |
| `tools/db/ledgerdb.py export-ledger` | PlaceLedger schema 1 の JSON を書く。`--db` を省くと行ファイルからメモリ上で組み立てる |
| `tools/db/migrate_from_assemble.py` | 行ファイルを作る移行用の道具。入力は assemble の台帳出力と監査出力、`data/card-ids.json`、manifest が選ぶ位置採用の行と位置ライフサイクルの原本。段階Cで assemble.py と一緒に消す |

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
| `adoption_sha256` | レビューして採用した位置の行の指紋。採用の行だけに置け、ライフサイクルの管理下にある採用では必須 |
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

指紋は2種類あり、どちらも `tools/national/location_lifecycle.py` と同じ計算で作る。値を JSON にし（キーを並べ替え、非 ASCII をそのまま書く）、その sha256 を取る。組み立てのたびに、行の内容から計算し直して照合する。過去の判断の行を書き換えると、その行の `adoption_sha256` か、次の行の `previous_state_sha256` が合わなくなって拒否される。

- `adoption_sha256` は、採用した位置の行の指紋である。その行は `facilityId`・`coordinate`・`evidence`（確認日時は元のまま）・`scope` に `adoption_extra` の項目を足したもので、`ledgerdb.adoption_record` が組み立てる。manifest の `locations[].approved[].sha256` と、位置ライフサイクルの `adoptionSHA256` の値を、そのまま引き継いだ。
- `previous_state_sha256` は、直前の判断の後の状態の指紋である。状態は `identity`・`coordinate`・`evidence`（確認日は日付）・`status`・`addressStatus`・`reason`・`decisionId`・`reviewedAt`・`sourceVersion`・`reviewDue` の10項目で、`ledgerdb.decision_state` が組み立てる。位置ライフサイクルの各判断の `previousSHA256` の値を、そのまま引き継いだ。

入力の台帳がもとから座標を持つ施設の採用には、`adoption_sha256` がない。その座標は manifest の入力の台帳にもとからあり、位置を採用した記録がないためである。

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

### 位置ライフサイクルから移さないもの

[施設位置の再確認・訂正・取り下げ](location-lifecycle.md) の検査のうち、次の3つは表に移さない。

- 保存原本の sha256 を、`data/evidence` のファイルと照合する検査。原本は段階Dで消す。段階Dまでは assemble.py と `cmd/builddata` がこの検査をする。
- 「今の採用」と「紐付けた採用」、「今の座標」と「紐付けたときの座標」が一致するかの検査と、紐付けた採用が撤回なしに消えていないかの検査。位置の採用と位置ライフサイクルが別のファイルにあるときの食い違いを防ぐもので、表では1つの行にまとまるため起きない。
- `groupImpacts` と `reviewQueue`。監査に出す集計で、表の行から導ける。

`tools/national/manual_user_approval.py` の検査（利用者が指定した位置を、決定の原本と採用前の施設の指紋に照らす）も移さない。採用前の施設と決定の原本は `data/national` と `data/evidence` にあり、段階Cと段階Dで消すためである。採用した行は `adoption_extra` に残り、`adoption_sha256` で固定される。

### assemble_key_order

assemble の出力と同じ並びで書き出すための、一時的な表。施設・配布関係・根拠のオブジェクトのキー順が既定の順と違う場合に、その順を持つ。既定の順は `ledgerdb.py` の `FACILITY_KEYS`・`RELATION_KEYS`・`EVIDENCE_KEYS` である。台帳を読む `cmd/builddata` はキー順を使わない。バイト単位の一致を検査しなくなる段階Cで、assemble.py と一緒に消す。

## JSON の列

JSON の列は7つある。SQLite の中では空白を入れない JSON 文字列として持つ。

- 文字列の並びは6列：`relation.hours`、`relation.maintenance_notes`、`relation.change_previous_place_ids`、`relation.change_raw`、`assemble_key_order.row_keys`、`assemble_key_order.evidence_keys`。どれも順序に意味があり、要素は他の表を参照しない。並びを子の表に分けると、順序の列が増えるだけで検査できることは増えない。スキーマは `json_valid` と配列型を CHECK で検査し、組み立ては要素が文字列であることを検査する。
- オブジェクトは `location_decision.adoption_extra` の1列。採用した位置の行の項目は、出典ごとに違う。補助の取得記録の並び、データセットの説明、同定の確認、利用者承認の項目などで、入れ子の形も行ごとに違う。どの採用にも共通する施設 ID・位置・根拠・`scope` は列に分け、残りをこの列に入れる。組み立てでは `adoption_sha256` と照合するので、中身を変えれば検出できる。中の取得記録は `data/evidence` のパスを含む。

これ以外の入れ子のオブジェクト（根拠、位置、`change`、`locationReview`、建物グループ）は、すべて列か別の表に分けた。

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

段階C以降は、表を直接直す。どちらの方法でも、最後に書き戻しが検査を通り、行ファイルの差分をレビューできる状態にする。

SQL で直して書き戻す。

```sh
python3 -B tools/db/ledgerdb.py build
sqlite3 data/work/ledger.sqlite3
python3 -B tools/db/ledgerdb.py dump
```

- `sqlite3` の中では、最初に `PRAGMA foreign_keys = ON;` を実行する。
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
