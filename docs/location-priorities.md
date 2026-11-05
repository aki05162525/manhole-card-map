# 未位置施設の調査優先度

`location_priorities.py` は `national_audit.py` のレポートを入力に、再構築台帳に登録され位置未採用の施設を分類する。fullだけに存在する旧形式施設は母集団へ追加しない。位置採用、施設統合、初回対象の自動選定は行わない。件数は固定せず、監査の `assembledUnlocated` と対象IDの一意性を検査する。

```sh
python3 -B tools/national/location_priorities.py \
  --audit data/work/issue24/national-audit.json \
  --full data/work/issue24/generated/full.json \
  --hold-selection data/national/issue20/selection.json \
  --hold-outcomes data/national/issue20/north-outcomes.json \
  --hold-outcomes data/national/issue20/oyama-outcomes.json \
  --hold-outcomes data/national/issue20/fujioyama-outcomes.json \
  --out /tmp/location-priorities.json
```

監査/fullは別途生成する。[全国監査](national-audit.md)の手順を使い、現manifest・台帳・一覧取得日・評価日を揃える。CLIはネットワークへ接続しない。入力はroot相対で、root外参照を拒否する。出力は未使用パスに限定し、`data`配下は`data/work`以外と固定`issue7-baseline`への書き込みを拒否する。

直接読んだ入力のhashを `inputSHA256`、元監査が記録したhashを `auditInputSHA256`、取得日と評価日を `dates` に保持する。full指定時は監査が同じパスに記録したhashとの一致が必須。パス文字列も同一にする（`data/work/...` を `./data/work/...` に変えると同じファイルでも拒否する）。元監査そのものの改ざん認証や現在のmanifestとの自動照合ではないため、監査の再実行が前提となる。

## 分類と数え方

施設単位の `distribution.classification` は重複しない。

- `active` / `upcoming` / `suspended` / `ended-only`: 現関係と生成関係が一致し、全関係がverifiedで状態が単一。
- `mixed`: 同じ検査を満たすが、施設内に複数状態がある。全状態を保持する。
- `needs-review`: 世代差、未確認関係、unknown、空の関係集合など。配布関係の確認を次の作業にする。
- `not-evaluated`: full由来の評価がない。台帳の生statusで補完しない。

終了のみでも対象ID・原調査を残し、調査優先度を下げる理由だけを記録する。古いfullとの差を除外根拠にしない。`generatedRelations` は指定fullの全関係行で、期間別関係・完全一致行も削除しない。状態別関係件数は行数、初ピン候補カード数はIDのユニーク数である。full未指定なら関係行数はnull。

`firstPinCardIds` は、全国監査のverifiedかつactive/upcomingで非reference施設ピンがないカード候補を使う。施設の関係評価が未確定なら順位への使用を保留しnullとする。元監査の候補は `priority.firstPinCardIds` に保持する。総数が未評価を含む場合は `firstPinCandidateCardCount=null`、既知候補だけの数を `knownFirstPinCandidateCardCount` とする。これは成功予測・在庫・当日受取可能性ではない。

## 原調査・保留・優先順位

監査の `provenance`、`investigation`、レビューを保持する。`investigationStageCounts` は元監査の段階、`currentInvestigationStageCounts` は明示保留成果のstageがある場合に反映した段階。独自のstage名も原値のまま残す。北側group形式などstageがない記録を、資料取得済みだから建物照合完了と推定しない。`blockerCounts` は元監査の不足根拠を施設ごとに数え、複数理由があれば重複計上する。

保留成果は `outcomes` の施設形式と `groups` の複数施設形式を読む。原記録全体・JSON pointer・停止再開条件を保持する。selection指定時は成果のselection hashと全IDの被覆が必須で、同じIDの重複を拒否する。現在未位置集合から外れた保留IDも `holdsOutsideCurrentPopulation` に残す。#20の6施設を扱う際は上記4入力を省略しない。

誤誘導の疑いを示すrelocation/conflict等は、未位置施設でも先に評価する。続いて明示された利用者要望、地域の空白、既知の初ピンカード数で安定ソートする。要望や地域空白の未評価はnullを維持する。容易さや保留だけで対象集合から消さない。`automaticSelection=false` と `notSelectedReason` を全施設に出し、実際の初回選定は別記録で施設ID・根拠・次手段・停止条件を決める。

共同調査候補は対象集合の前後空白を除いた同住所・同名。表記ゆれの推測統合はせず、同棟の認定や施設ID/配布関係の統合はしない。

## 検証

```sh
python3 -B -m unittest discover -s tools/national -p test_location_priorities.py -v
python3 -B -m unittest discover -s tools/national -v
mise exec -- go test -count=1 ./...
```

人工入力で混在/unknown/世代差/入力不足、保留の両形式、全ID被覆、原レビュー保持、関係行とカード数、hash不一致、重複JSON/NaN、上書き拒否を確認する。個別資料の正確性や調査候補の採用可否は検査範囲外。
