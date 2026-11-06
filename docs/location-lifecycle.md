# 施設位置の再確認・訂正・取り下げ

`tools/national/location_lifecycle.py` は、位置の採用元を残したまま、その後の判断を履歴として重ねる。施設・カード・配布関係を削除しない。入口・室内窓口の精度を追加条件にしない。

## 適用範囲と状態

manifestの任意の `locationLifecycle` に列挙したファイルだけを扱う。未管理の既存位置は従来どおりで、既存全件に一律の新hashを要求しない。ただし未管理位置には、この仕組みによる施設名・住所変更検出は働かない。

| 状態 | 台帳/配信座標 | 通常ピン | Maps |
| --- | --- | --- | --- |
| confirmed | 現在の採用座標 | 確認済み配布関係がある場合のみ | 現座標 |
| needs-review | 座標なし | なし | 住所も要確認ならリンクなし |
| withdrawn | 座標なし | なし | 現住所確認済みなら施設名・住所検索のみ |

`reviewDue` は調査キューの日付であり、期限だけで位置を失効させない。住所・名称の実質変更は最後にレビューしたidentityとの不一致としてneeds-reviewにする。表記修正も自動同一視せず、証拠付きのreaffirmで承認する。原典の配布関係の指紋・`reviewUntil`は既存のまま、位置とは独立して働く。

位置の判断履歴に登録する主体名が異なることを検査するが、AIレビュアーの独立性や証拠の内容はコードだけでは保証できない。原本・建物対応の独立レビューを省略してはならない。

## manifestと採用時binding

```json
{
  "locationLifecycle": [
    {"path": "data/national/location-lifecycle/example.json", "sha256": "ファイル全体のSHA256"}
  ]
}
```

既存manifestの他のキーはそのまま残す。ファイル全体のhashで選択し、未レビュー追記を自動適用しない。各ファイルは`schema: 1`と`bindings`、`events`、`groups`の配列を必須とする。

bindingは `facilityId`、採用時の `identity: {name,address}`、採用元の行全体 `adoption`、その正規化JSONの `adoptionSHA256` を持つ。`adoption`にはfacilityId/coordinate/evidenceを含め、元のscope等も保持する。任意の`sourceVersion`と`reviewDue`を付けられる。hash方式はmanifestの位置行と同じ `sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode())`。

今後この運用で新規採用する位置は、独立レビュー時にbindingを同時作成してmanifestへ明示選択する。未管理既存採用と混同しないよう、PRの採用ID一覧にbindingの参照を付ける。既存位置を管理対象へ移すときは原座標の正当性まで再承認したとは扱わず、保持している採用元を固定したことを記録する。この運用規則を破った未管理の新規採用を自動検出する機構はまだない。

## 履歴event

eventの項目は次のとおり。

- `id`、`facilityId`、`action`（reaffirm / correct / withdraw）。decision IDは選択ファイル全体で一意。
- `previousSHA256`。一つ前のstate全体の正規化JSON hash。旧値が違えば失敗する。
- `identity`。判断時点で確認したname/address。最終stateと現台帳のidentityを比較する。
- `reason`、`reasonType`（spelling / relocation / source-withdrawal / evidence-update）。
- `evidence`。既存Evidence形式の保存原本・hash・該当箇所等。
- `preparedBy`、`reviewedBy`。空値および同じ主体は拒否する。
- `reviewedAt`。YYYY-MM-DDで、前の判断・証拠の確認日より前にはできない。
- `addressStatus`（valid / needs-review）。現住所を検索に使えるかを独立に確認する。
- `coordinate`。reaffirm/correctのみ必須。withdrawでは禁止。
- 任意の`sourceVersion`、`reviewDue`。

reaffirmは前座標を保持し、correctは前座標を変更する。relocation/source-withdrawalをreaffirmの理由にすることは禁止する。withdraw後の再開は、座標がないstateからcorrectで新しく採用する。取り下げ理由と旧値は消さない。各eventの前後state・hash・判断原文は統合監査に残る。

初期stateはbindingsから生成され、統合の`--audit-out`内の`locationLifecycle.facilities[].state`と`stateSHA256`で確認できる。追補はこのhashを使って作る。ファイルの配列順・manifest選択順が履歴順であり、前state hashが一致しない並べ替えや飛び越しは拒否する。

通常は元のlocation採用をmanifestに残し、最後にwithdrawを適用する。毎回元採用を再読込しても最終結果に座標は復活しない。元採用の選択を外す場合もbindingと撤回履歴を保持する。bindingがあるのに元座標だけが消え、最後の判断がwithdrawでなければ失敗する。

**履歴を選択するmanifest項目自体を削除すると検査対象から外れる。** Git管理でmanifest・binding・履歴を同時レビューし、履歴選択の削除で取り下げを迂回しないことをPRレビューで確認する。外部DBに改ざん不能の履歴を保存する仕組みではない。

## 同棟と再確認キュー

`groups`の行は `id`、`facilityIds`（2件以上・重複なし）、同棟を裏付ける`evidence`を持つ。全メンバーに明示bindingが必要。一施設が複数groupへ所属することは拒否し、同じ建物のグループは入力側で一つに統合する。住所や座標が同じだけでは自動グループ化しない。

メンバーのidentityが変わって未解決なら、同棟メンバー全員をneeds-reviewにする。訂正/取り下げの履歴があるgroupは、影響する全IDを`groupImpacts`に出す。住所変更と関係しない単独出典の撤回では、他の出典の点まで自動撤回しない。

`reviewQueue`は明示されたreviewDueとsourceVersionを保持する。古い一覧のままならidentity不一致も起きないため、監査担当者がこのキューを指定基準日で点検する。自治体サイトの常時監視や自動取得は行わない。

## 生成・監査との接続

履歴適用後の座標と `locationReview` をGo台帳へ渡す。判断日が生成の `-as-of` より未来なら拒否する。過去基準日では当時のmanifest・履歴選択を用いる。非confirmedには座標・ピンを出さない。旧座標・identity履歴はブラウザー資産へ出さず統合監査に保持する。

全国監査は`locationReview`と`lifecycleWithheldIds`を出し、manifest選択履歴と現在の有効位置を区別する。固定810の採用数は従来どおりmanifest選択の集計で、履歴適用後の有効位置数ではない。出典inventoryの`adoption`は元の採用経路を保持し、`currentlyAdoptedRecord`と`summary.adoptedRecords`は履歴適用後の現在の座標・証拠で判定する。訂正で原値が変わった場合は別の現在行を追加する。

## 検証と限界

```sh
python3 -B -m unittest discover -s tools/national -v
```

実データの既存採用を移行したことは意味しない。

出典条件に伴う撤回では配信資産、CI成果物、手元の旧生成物を別々に確認する。HTTP キャッシュに旧資産が残る可能性も確認する。Git履歴や既存成果物の破壊的削除はこの処理では行わない。
