# Issue7 調査・採用・生成状況の再現集計

`tools/national/issue7_audit.py` は、固定担当810施設の原調査、現在のmanifestの明示採用、任意の生成結果を独立に集計する。ネットワーク、レビューJSON、Go生成処理は実行しない。全地域のレビューが揃う前でも、現在のmanifestだけで採用状況を集計できる。

リポジトリのルートから実行する。

```sh
python3 -B tools/national/issue7_audit.py --out /tmp/issue7-audit.json
python3 -B -m unittest discover -s tools/national -p test_issue7_audit.py
```

`--out` は必須。既存ファイルは上書きしない。親ディレクトリは事前に用意する。出力先はカレントディレクトリ基準で、絶対パスも使用できる。`data/` 配下への出力は `data/work/` のみ許可するが、固定 `data/work/issue7-baseline/` への出力は禁止する。

入力の変更には `--root`、`--baseline`、`--manifest`、`--regions-dir` を指定する。後ろ3つ、および `--full` / `--ledger` はroot内の相対パスで、root外への参照は拒否する。

生成結果も照合する場合の例（ファイルは別途生成済みであること）：

```sh
python3 -B tools/national/issue7_audit.py \
  --full data/work/issue7-generated/full.json \
  --ledger data/work/issue7-generated/ledger.json \
  --out /tmp/issue7-audit-generated.json
```

fullとledgerはそれぞれ単独でも指定できる。指定しなかった側の情報は `null` とし、0件とは扱わない。fullはGoの `schema: 1` のfull JSON、ledgerはassembleの `schema: 1` の台帳を読む。生成日時が古くても拒否せず、そのファイルに含まれる座標と現在採用した座標の一致を報告する。fullにあるpinは生成データの状態であり、デプロイ済み画面の実測ではない。

## 入力と固定baseline

- `data/national/issue7/assignment-baseline.json`: 13地域の担当IDと既存location採用642 IDを収録。担当は固定 `data/work/issue7-baseline/assignments.json` の内容を保存し、元ファイルのSHA256を記録した。実行時・テスト時にworkの元ファイルは不要。
- `data/national/issue7/{region}.json`: `hokkaido,tohoku,north-kanto,south-kanto,hokuriku,koshin,tokai,kinki-east,kinki-west,chugoku,shikoku,kyushu-okinawa,sakuragicho` の原調査のみ。`updates` を候補、`unresolved` を原残件として扱う。`corrections` は分類や採用に加算しない。
- `tools/national/manifest.json`: `locations[].approved` のfacility IDとupdate hashだけを採用の真実とする。選択されたファイルの `updates` を読む。followup・reviewedなどの名前から採用を推測しない。manifestのinputs・patchesを組み立て直す処理ではない。`locationLifecycle`の訂正・撤回も適用しない。

642 IDはbaseline収録時点のmanifestで `data/national/issue7/` 外のlocation採用から抽出した。選択内容とその時点のmanifest hashをprovenanceに保存している。以後はパス名や総数の差ではなく、この固定ID集合との差分で追加を識別する。固定baseline台帳の座標776件は、元から座標を持つ施設も含む別の集合であり、642件とは一致しない。

## 出力の読み方

成果JSONには `inputSHA256`、`definitions`、固定810施設全体の `summary`、地域別 `regions`、ID集合 `locationSelection`、810施設の `facilities` を保存する。入力は各ファイルを一度だけ読み、解析した同じbytesのSHA256を記録する。同じ入力なら同じ出力になる。別ファイル間の同時更新をロックする仕組みではないため、集計を保存する際は入力が安定した時点で実行する。

|項目|意味|
|---|---|
|regionalCandidates|原地域updatesの件数。採用や生成件数ではない|
|originalUnresolved|原地域unresolvedの件数。後から採用しても原分類は保持|
|currentAdopted|担当810 IDのうち、現在のmanifestで明示採用された数|
|currentRemaining|担当810 IDから現在採用IDを引いた数。未採用候補も含む|
|candidateNotAdopted|原候補のうち、現在は採用されていない数|
|currentIntegrated|採用IDのうち、fullでconfirmed座標が採用座標と一致する数|
|adoptedLocationNotGenerated|採用IDのうち、fullに一致するconfirmed座標がない数。施設欠落・古い座標も含む|
|targetConfirmedLocations|対象810 IDのfull上のconfirmed座標数。採用との一致とは別|
|targetPins|対象810 IDの非referenceなplace pin数。座標があってもpinがない場合を区別|
|ledgerAdoptedMatches|採用IDのうち、任意ledgerの座標が採用座標と一致する数|

`locationSelection` には固定baseline ID、現在の全採用ID、Issue7追加ID、baselineから現在の採用集合に残っていないIDを保存する。Issue7追加は `(現在の全採用ID − baseline ID) ∩ 担当ID`。baseline外かつ担当外の新採用は、このCLIの対象外として拒否する。

このCLIの `currentAdopted` はmanifestの位置追補選択であり、履歴適用後の有効な位置数ではない。元の採用を保持したままlocationLifecycleでwithdrawした場合も選択数には残る。任意fullとの不一致だけから生成漏れとは断定できない。訂正・撤回・位置再確認待ちを含む現在の状態、固定対象外や配布関係待ちのIDは[全国監査](national-audit.md)で確認する。Issue7監査の固定集合・拒否契約は変更しない。

施設ごとに原分類、原行全体、現在の採用元パス・hash・update、生成施設の有無・座標一致・pin有無、ledger照合を残す。桜木町-followupの採用で桜木町原残件を消さず、甲信-reviewedの採用で甲信原候補を書き換えない。原残件の `reasonCategory` / `reason` / `nextSource` / `attempts` / `investigationStatus` をそのまま保存する。理由別・調査状態別の件数は原残件の集計であり、現在残件の集計とは異なる。現在残件は `currentStatus == "remaining"` の施設から参照できる。

空のattemptsは許容し、調査実施・全Web深掘り完了を意味しない。各原行の調査状態は記録値として提示するだけで、その真偽や調査の十分性は判定しない。承認hashはassembleと同じJSON正規化方式で照合するが、証拠原本の再検証や全レビューschemaの解釈は行わない。inputSHA256は実際に読んだJSONのみで、そこから参照される証拠原本まで検証したhash一覧ではない。

## 拒否する入力と検証

担当は13地域・810 ID、baselineは642 ID、両集合は重複不可。原調査は担当内で各IDが候補か原残件のどちらか一方に一度だけ現れる必要がある。担当外・重複・未分類、残件分類情報の欠落、不正座標、JSON重複キー・非有限数、採用ID欠落・hash不一致・採用重複を拒否する。

任意full / ledgerでは施設IDの重複を拒否する。不正座標の検査対象はfullのconfirmed座標と非reference place pin、およびledgerに記録された座標。未確定候補とreference pinの座標検査は対象外。採用座標との比較は数値で行い、35と35.0は一致として扱う。fullの非referenceなplace pinは施設のconfirmed座標と一致する必要がある。対象外の既存 `place:` IDも受け入れる。配布関係全体やpin生成条件全体の検証は既存coverageの役割であり、このCLIは置き換えない。

テストは人工入力による分類・採用・生成の分離、不正入力の拒否、出力上書き禁止、およびwork非依存の実入力被覆を検証する。現在のmanifestの採用件数・hashは固定しない。
