# 位置情報の出典棚卸し

`tools/national/source_inventory.py` は、現在のmanifestから統合した台帳の座標と、明示した位置候補をオフラインで棚卸しする。出典URLだけから座標の取得元や利用許諾を推測しない。出典条件の調査は `data/national/source-review/registry.json` へ分離する。

## 実行

リポジトリルートで、未使用の出力先を指定する。

```sh
python3 -B tools/national/source_inventory.py \
  --as-of 2026-11-05 \
  --registry data/national/source-review/registry.json \
  --out /tmp/source-inventory.json
python3 -B -m unittest discover -s tools/national -p test_source_inventory.py -v
```

`--as-of` は点検結果を読む基準日であり、一覧原本の取得日や全施設を調べ直した日ではない。レポートの `listingAcquiredAt` は未入力のため `null`。生成JSONとの比較は全国監査が担当し、このCLIは行わない。`temporalMetadata` は元に明示された `checkedAt`、`fetchedAt`、`sourceAsOf` を別々に転記し、未記録の取得日・原典基準日は `null` とする。URLや確認日から原典の版・取得日を補完しない。追加調査の時点情報はregistryのレビューを参照する。

`--root` と `--manifest` で入力を変更できる。`--registry` を省略した場合は全行を未点検とする。追加の候補ファイルは `--candidates path/to/proposals.json` を繰り返し指定する。`--no-default-candidates` はIssue7の既定13地域を外すが、manifestが選択した位置ファイル内の全候補は引き続き読む。

出力は既存ファイルを上書きしない。原本を守るため `data/` 内は `data/work/` 以外へ出力できない。固定 `data/work/issue7-baseline/` 内への出力も拒否する。入力ファイルはすべてroot相対で、root外への参照を拒否する。

## 対象集合

- **採用経路**：パッチ適用後の台帳に元からある座標、およびmanifestが明示採用した位置追補。`adoption` は撤回後も元の経路を保持する。現在有効な採用行は `currentlyAdoptedRecord` で識別し、`summary.adoptedRecords` はその件数。施設数と採用行数を分ける。
- **候補**：manifestに選択された位置ファイルの全 `updates`、Issue7の原13地域の `updates`、追加指定ファイルの `updates`。明示採用と同一行は採用済みにまとめる。
- **行の同一性**：`facilityId` と行全体の正規化JSONのSHA256。同施設の旧候補と現在採用を残す。候補行数は未位置施設数ではない。
- **対象外**：座標提案のない `unresolved`、明示リスト外の候補ファイル、ブラウザー生成物。リポジトリ内の全候補を調査済みとは扱わず、`coverage.candidateFiles` と `allRepositoryCandidatesScanned: false` を出す。

元から台帳にある座標は、パッチ適用後の施設行をhash対象とする。`origins` は台帳ファイルを指し、適用したパッチのファイルhashも `inputSHA256` に含む。位置追補はmanifestの採用行と同じhash方式を使う。過去の不採用は独立した候補として残り、現在同じ施設が採用済みかは `currentlyAdoptedFacility` で識別する。

## 証拠と未確認

`records` は `evidence`・元の行全体・採用区分・参照ファイル・hashを残す。`snapshot.status=verified` は保存原本のbytesとhashが一致した意味であり、建物同定や抽出値の妥当性を新たにレビューした意味ではない。

採用済み入力には既存assembleの証拠検査・旧値照合・manifest承認hash検査を行う。候補に原本がない場合は `missing`、参照自体がない場合は `unrecorded` とする。存在する証拠のhash不一致は候補でもエラーにする。原本未検証候補へ `usable` や `conditional` の判定を適用できない。

出典の名前・版・加工方法を自動抽出して確定せず、点検がなければ `source` の各値は `null`、`termsStatus` は `unreviewed`。原文の `verificationMethod` と `sourceLocator` は保持する。Google等の単語が補助資料の説明に出現しても、それを座標の取得元だとは断定しない。

`sourceGroups` は点検済み行を出典＋版＋加工方法で逆引きする。未点検行は記録されたURL・該当箇所・手法の組合せで束ねるだけで、提供元を同定したグループではない。

## 出典レビューの適用契約

registryは `schema: 1` と `reviews` 配列を持つ。各reviewの必須項目は次のとおり。

- `id`：一意のレビューID。
- `source`：非空文字列の `name`、`version`、`derivation`。
- `status`：`unreviewed` / `needs-review` / `conditional` / `usable` / `prohibited`。
- `checkedAt`：確認日。基準日より未来は拒否する。根拠の確認日がレビュー日より未来の場合も拒否する。
- `evidence`：`url`、`locator`、`checkedAt` を持つ根拠配列。保存原本があれば `snapshotPath` と `snapshotSHA256` を対で指定する。
- `selectors`：`facilityId` と `recordSHA256` の完全一致だけ。ドメインやURL接頭辞での一括許諾は扱わない。

`recordSHA256` は `sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode())`。reviewの条件・留保等の追加項目は出力へ保持する。対象外・変更済みのselectorや複数reviewの重複適用はエラーにする。範囲を広げる際は新しい行の根拠を点検し、selectorを明示追加する。

レビューがない行は「利用禁止」とも「利用可能」とも判定しない。レビューの `conditional` も施設位置の採用承認ではなく、記載した用途・加工条件での限定的な点検結果である。原データ・manifest・配信資産はこのCLIでは変更しない。
