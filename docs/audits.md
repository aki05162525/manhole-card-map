# 監査ツール

| 知りたいこと | ツール | 入力 | 主な出力 |
| --- | --- | --- | --- |
| 配布施設・カードの表示被覆 | `coverage.py` | full、生成元ledger | 表示・未表示、確認状態、地域別ID |
| 固定担当の調査と採用 | `issue7_audit.py` | baseline、原地域調査、manifest、任意full/ledger | 固定810施設の原分類・現在採用・生成一致 |
| 全国の未表示理由・再確認対象 | `national_audit.py` | manifest、任意full/ledger・追補・原本対応表 | 全国既知施設、再確認キュー、初ピン候補 |
| 位置情報の出典と利用条件 | `source_inventory.py` | manifest、候補、任意registry | 採用行・候補行、証拠、出典レビュー |
| 未位置施設の調査順 | `location_priorities.py` | 全国監査、任意full・保留selection/outcomes | 配布分類、保留、優先順位 |

## 共通の前提

監査には公開JSONではなく、`python3 -B tools/build-real-data.py` が生成する `data/work/internal-data/full.json` を使う。公開用は表示項目のみで、根拠・入力情報を省いている。

リポジトリルートで実行する。各CLIはオフラインで動作し、元データ・承認・配信資産を書き換えない。入力不足時にfixtureへ置き換えない。件数は対象集合と基準日を添えて実行結果から取得する。

coverageは `--out` 省略時に標準出力へ出し、それ以外は必須。coverage以外は入力をroot相対で指定し、root外参照、`data/work/`以外の`data/`内と固定`data/work/issue7-baseline/`内への出力を拒否する。

`issue7_audit.py` と `national_audit.py` は内部fullが既定値で、`--full ""` で生成結果を省略できる。Python関数の省略時は生成結果を含めない。各ツールの日時・nullの意味は各節に従う。

```sh
audit_out=$(mktemp -d)
python3 -B tools/build-real-data.py
python3 -B tools/national/assemble.py --out data/work/assembled-ledger.json
```

## coverage.py：表示被覆

```sh
python3 -B tools/national/coverage.py \
  --full data/work/internal-data/full.json \
  --ledger data/work/assembled-ledger.json \
  --out "$audit_out/current-coverage.json"
```

### 数え方

入力を検査し、不正なら失敗する。

全国カード数は `full.cards` の unique ID 数であり、蓋ピン数ではない。名称が似ていても推測で統合しない。原文解析由来の未確定 place ID と承認済み facility ID の両方を含むため、実在施設の確定総数とは異なる。

配布確認は関係単位の `review == verified` で判断し、状態は別軸の `active / suspended / ended / unknown / upcoming`。Go は `upcoming` も出すため、省略したり unknown に丸めたりしない。`verified` でも状態 unknown は存在する。raw 行、unique 組、verified 組、位置あり verified 組それぞれの状態内訳を出す。カード全体の `status` は `sourceCardStatus` として保存するだけで施設の配布確認に流用しない。

座標確認は full の `coordinate.status == confirmed` と有限・範囲内の lat/lng が必要で、同じ座標が ledger に承認済みとして存在することも照合する。candidate の数値座標だけでは確認済みにしない。承認は入力 ledger の作成工程の責任であり、監査自身が manifest を検査して承認を追加することはない。

`activeLocatedCards` と `activeLocatedPlaces` は確認済み active 関係と承認済み位置が揃う unique 数。受取可能件数ではない。営業時間、休日、条件、在庫の変動、施設代表点と実際の窓口位置の差、現地確認の有無を保証しない。

### 未表示一覧と配布未確認の区別

施設の `gapClass` は次の優先順で排他的に分類する。施設に複数カードがある場合、一件でも配布未確認なら配布未確認側に入れる。

- `evidence_backed_distribution_unconfirmed`: 公式確認の台帳・生成物に evidence があるが、未検証関係または状態 unknown が残る（関係なしも含む）。位置が確認済みでも該当する。
- `distribution_unconfirmed`: 同じ配布未確認で、根拠 evidence がない。
- `location_only_unconfirmed`: 全関係が verified かつ既知の状態で、位置だけ未確認。休止・終了・開始前も含むため、active 件数には読み替えない。
- `none`: 上記の不足なし。終了済みでもこれに入る。

URL の政府ドメイン判定で公式性を推測せず、保存原本の内容・hash・公式性は既存 assemble/builddata の検証とレビューを前提とする。座標の evidence は配布の根拠とは限らない。`evidenceBacked` 単独では配布確認にしない。期限切れや sourceHash 変化で失効した関係はledger の昔の active に戻さず、full の needs-review/unknown を採用する。

全関係 verified、少なくとも一関係 verified、unknown が一つでも残るかも独立して出す。

### 地域担当の ID 集合

地域は施設 ID の接頭辞・名称・住所ではなく cardId 先頭の県コードで決める。地理上の所在地を推定した分類ではない。

`regions.<地域>.unlocatedPlaceIds` は raw 未確定施設も含む未位置集合。位置追補の対象となる既存 ledger 施設に絞る場合は `unlocatedLedgerPlaceIds` を使う。地域をまたぐ施設は重複するため単純合算しない。

## issue7_audit.py：固定担当の調査・採用

`tools/national/issue7_audit.py` は固定担当810施設の原調査、現在のmanifestの明示採用、任意の生成結果を独立に集計する。ネットワーク、レビューJSON、Go生成処理は実行しない。全地域のレビューが揃う前でも、現在のmanifestだけで採用状況を集計できる。

```sh
python3 -B tools/national/issue7_audit.py --full "" --out "$audit_out/issue7-audit.json"
```

生成結果も照合する場合の例（ファイルは別途生成済みであること）：

```sh
python3 -B tools/national/issue7_audit.py \
  --full data/work/internal-data/full.json \
  --ledger data/work/assembled-ledger.json \
  --out "$audit_out/issue7-audit-generated.json"
```

Python関数でfullを省略した場合やledgerを指定しなかった場合、その側の情報は `null` とし、0件とは扱わない。生成日時が古くても拒否せず、そのファイルに含まれる座標と現在採用した座標の一致を報告する。fullにあるpinは生成データの状態であり、デプロイ済み画面の実測ではない。

### 出力の読み方

キーの定義は出力の `definitions` を参照する。入力を検査し、不正なら失敗する。

このCLIの `currentAdopted` はmanifestの位置追補選択であり、履歴適用後の有効な位置数ではない。任意fullとの不一致だけから生成漏れとは断定できない。訂正・撤回・位置再確認待ちを含む現在の状態、固定対象外や配布関係待ちのIDは[全国監査](#全国監査)で確認する。Issue7監査の固定集合・拒否契約は変更しない。

空のattemptsは許容し、調査実施・全Web深掘り完了を意味しない。各原行の調査状態は記録値として提示するだけで、その真偽や調査の十分性は判定しない。承認hashはassembleと同じJSON正規化方式で照合するが、証拠原本の再検証や全レビューschemaの解釈は行わない。inputSHA256は実際に読んだJSONのみで、そこから参照される証拠原本まで検証したhash一覧ではない。

## 全国監査

`tools/national/national_audit.py` は現在のmanifestから台帳をオフライン再構築し、固定Issue7対象と全国の既知施設を別々に監査する。新しい位置や配布関係を承認する処理ではない。原本・原調査・manifest・生成物を書き換えない。

### 実行

```sh
python3 -B tools/national/national_audit.py --full "" --out "$audit_out/national-audit.json"
```

実データの生成後に照合する例：

```sh
python3 -B tools/national/national_audit.py \
  --full data/work/internal-data/full.json \
  --ledger data/work/assembled-ledger.json \
  --as-of 2026-11-06 \
  --out "$audit_out/national-audit-generated.json"
```

上記のfull/ledgerは別途生成する。存在しないときにfixtureへ置き換えない。台帳の真実は常にmanifestから再構築する。`--as-of` は任意だが、fullと併用した場合はその`evaluatedAt`と一致しなければ失敗する。指定した日付へ生成物を再評価するコマンドではない。

### 母集団と主な出力

- `fixedAssignment`: 固定810施設。`remainingIds`は固定集合から現manifestの位置採用IDを引いた集合。終了した施設も消さない。`baselineNoLongerSelectedIds`は固定642採用IDのうち現在の選択から外れたIDであり、取消理由までは推測しない。
- `national`: 再構築台帳、任意full、固定担当、明示的に読み込んだproposalファイルに登場する施設IDの和集合。全国すべての施設が収録済みという意味ではない。`generatedUnlocated`と`assembledUnlocated`は別の集合。新たな固定対象外採用は`outsideFixedSelectedIds`へ出す。
- `proposals`: proposalの施設/関係ごとに未登録・現行一致・現行差分を記録する。施設の比較は位置追補で置き換わるcoordinate/evidenceを除外する。関係はevidenceも比較する。差があるだけで承認待ち・誤り・適用必要とは断定しない。
- `reconfirmationQueue`: 採用済み出典の条件未点検、明示された移転/競合、出典の古さ、再確認期限、生成座標/配布関係の不一致を列挙する。候補抽出であり取り下げ決定ではない。位置未採用でも現関係と生成関係の差があればこのキューに入る。
- `cards`: 任意原本対応表との欠落比較、full内の関係なしカード。原本対応表なしの未収録件数は`null`。

`--full ""`なら、生成未位置件数、配布関係のeffective状態、初ピンカード数などは`null`。`--ledger`未指定なら比較結果は`null`。レポートには入力JSONのSHA256、一覧取得日、生成評価日、原本対応表の取得情報を残す。assembleが採用証拠のbytes/hashも検査するが、`inputSHA256`は参照された全証拠ファイルのhash一覧ではない。

#### 生成物との世代差

施設の確定座標が現台帳と一致するか、配布関係が現在の証拠・条件・期間・カードの原典指紋に対応するかを別々に比較する。古いfullは読めるが、不一致を明示する。現在の関係と一致しない古い`ended`だけを理由に実作業から除外しない。台帳の生statusと、fullのeffective statusも別出力にする。期限・原典変更で失効したfullの関係を、台帳のactive値で復活させない。

### 調査段階と追補

理由と調査段階は独立であり、「new-investigation」などから建物照合完了を推測しない。

追補は実際に調査・優先判定したIDだけに作る。全810/全国分の手書きコピーは不要。`--followups`に次の形式を渡す。

```json
{
  "schema": 1,
  "facilities": [{
    "facilityId": "facility:example",
    "stage": "building-comparison",
    "blockers": ["relocation"],
    "nextAction": "新版庁舎配置図と候補座標を照合する",
    "stopCondition": "同じ原本・手法で不足根拠が増えない",
    "resumeCondition": "新版配置図または利用者報告が得られる",
    "request": true,
    "regionalGap": false,
    "priorityException": "先に報告地点の誤誘導を確認する",
    "sourceConditions": "review-required",
    "sourceVintage": "2022-01-01",
    "reviewDue": "2026-11-01",
    "references": ["data/national/issue7/reviews/example.json#/reviews/0"]
  }]
}
```

条件状態は `not-evaluated`、`review-required`、`checked`。`checked`は追補の判定であり、このCLIによる規約検証ではない。

優先順位は誤誘導/生成位置の不一致の疑い→利用者要望→地域の空白→初ピン候補カード数の順。利用者要望・地域の空白は未評価なら`null`。自動判定しない。初ピン候補カード数は指定fullのverifiedかつactive/upcoming関係を持ち、非reference施設ピンがまだないカード数。調査すれば必ずピンが立つという予測ではない。`estimatedMinutes`は任意の作業見積りで、施設件数とは別。

出典の古さは追補で基準日を明示した場合のみ730日超を再確認候補にする。証拠確認日を出典基準日に代用しない。期限到来で座標を失効させない。終了のみの施設は生成関係が現在の関係と一致した場合だけ`excluded-ended`にできるが、固定残件には保持し、原典更新/配布再開の確認後に再評価する。

### 未収録カードとの比較

GKP一覧は画像URLをキーにするため、画像URLから印刷カードIDを推測しない。`--listing`は保存原本とレビュー済みID対応を持つJSONを読む。

```json
{
  "schema": 1,
  "source": {
    "path": "data/evidence/example/list.html",
    "sha256": "保存原本のSHA256",
    "acquired": "2026-11-05",
    "method": "印刷カード番号との照合方法・記録の説明"
  },
  "cards": [{"id": "00-101-A001"}]
}
```

原本hash・取得日・ID重複を検査する。ID対応そのものの正しさを自動保証する機能ではない。対応表未指定なら未収録数を推定しない。

## source_inventory.py：位置出典

`tools/national/source_inventory.py` は現在のmanifestから統合した台帳の座標と、明示した位置候補をオフラインで棚卸しする。出典URLだけから座標の取得元や利用許諾を推測しない。出典条件の調査は `data/national/source-review/registry.json` へ分離する。

### 実行

```sh
python3 -B tools/national/source_inventory.py \
  --as-of 2026-11-06 \
  --registry data/national/source-review/registry.json \
  --out "$audit_out/source-inventory.json"
```

`--as-of` は点検結果を読む基準日であり、一覧原本の取得日や全施設を調べ直した日ではない。レポートの `listingAcquiredAt` は未入力のため `null`。`temporalMetadata` は元に明示された `checkedAt`、`fetchedAt`、`sourceAsOf` を別々に転記し、未記録の取得日・原典基準日は `null` とする。URLや確認日から原典の版・取得日を補完しない。追加調査の時点情報はregistryのレビューを参照する。

### 対象集合

- **採用経路**：パッチ適用後の台帳に元からある座標、およびmanifestが明示採用した位置追補。`adoption` は撤回後も元の経路を保持する。現在有効な採用行は `currentlyAdoptedRecord` で識別し、`summary.adoptedRecords` はその件数。施設数と採用行数を分ける。
- **候補**：manifestに選択された位置ファイルの全 `updates`、Issue7の原13地域の `updates`、追加指定ファイルの `updates`。明示採用と同一行は採用済みにまとめる。
- **行の同一性**：`facilityId` と行全体の正規化JSONのSHA256。同施設の旧候補と現在採用を残す。候補行数は未位置施設数ではない。
- **対象外**：座標提案のない `unresolved`、明示リスト外の候補ファイル、ブラウザー生成物。リポジトリ内の全候補を調査済みとは扱わず、`coverage.candidateFiles` と `allRepositoryCandidatesScanned: false` を出す。

### 証拠と未確認

`snapshot.status=verified` は保存原本のbytesとhashが一致した意味であり、建物同定や抽出値の妥当性を新たにレビューした意味ではない。

採用済み入力には既存assembleの証拠検査・旧値照合・manifest承認hash検査を行う。候補に原本がない場合は `missing`、参照自体がない場合は `unrecorded` とする。存在する証拠のhash不一致は候補でもエラーにする。原本未検証候補へ `usable` や `conditional` の判定を適用できない。

出典の名前・版・加工方法を自動抽出して確定せず、点検がなければ `source` の各値は `null`、`termsStatus` は `unreviewed`。Google等の単語が補助資料の説明に出現しても、それを座標の取得元だとは断定しない。

### 出典レビューの適用契約

registryは `schema: 1` と `reviews` 配列を持つ。各reviewの必須項目は次のとおり。

- `id`：一意のレビューID。
- `source`：非空文字列の `name`、`version`、`derivation`。
- `status`：`unreviewed` / `needs-review` / `conditional` / `usable` / `prohibited`。
- `checkedAt`：確認日。基準日より未来は拒否する。根拠の確認日がレビュー日より未来の場合も拒否する。
- `evidence`：`url`、`locator`、`checkedAt` を持つ根拠配列。保存原本があれば `snapshotPath` と `snapshotSHA256` を対で指定する。
- `selectors`：`facilityId` と `recordSHA256` の完全一致だけ。ドメインやURL接頭辞での一括許諾は扱わない。

`recordSHA256` は `sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode())`。対象外・変更済みのselectorや複数reviewの重複適用はエラーにする。範囲を広げる際は新しい行の根拠を点検し、selectorを明示追加する。

レビューがない行は「利用禁止」とも「利用可能」とも判定しない。レビューの `conditional` も施設位置の採用承認ではなく、記載した用途・加工条件での限定的な点検結果である。原データ・manifest・配信資産はこのCLIでは変更しない。

## location_priorities.py：未位置施設の優先度

fullだけに存在する旧形式施設は母集団へ追加しない。件数は固定せず、監査の `assembledUnlocated` と対象IDの一意性を検査する。

```sh
python3 -B tools/national/national_audit.py \
  --full data/work/internal-data/full.json \
  --out data/work/current-national-audit.json
python3 -B tools/national/location_priorities.py \
  --audit data/work/current-national-audit.json \
  --full data/work/internal-data/full.json \
  --hold-selection data/national/issue20/selection.json \
  --hold-outcomes data/national/issue20/north-outcomes.json \
  --hold-outcomes data/national/issue20/oyama-outcomes.json \
  --hold-outcomes data/national/issue20/fujioyama-outcomes.json \
  --out "$audit_out/location-priorities.json"
```

監査/fullは別途生成する。[全国監査](#全国監査)の手順を使い、現manifest・台帳・一覧取得日・評価日を揃える。

### 分類と数え方

終了のみでも対象ID・原調査を残し、調査優先度を下げる理由だけを記録する。古いfullとの差を除外根拠にしない。`generatedRelations` は指定fullの全関係行で、期間別関係・完全一致行も削除しない。状態別関係件数は行数、初ピン候補カード数はIDのユニーク数である。full未指定なら関係行数はnull。

`firstPinCardIds` は全国監査のverifiedかつactive/upcomingで非reference施設ピンがないカード候補を使う。施設の関係評価が未確定なら順位への使用を保留しnullとする。総数が未評価を含む場合は `firstPinCandidateCardCount=null`、既知候補だけの数を `knownFirstPinCandidateCardCount` とする。これは成功予測・在庫・当日受取可能性ではない。

### 原調査・保留・優先順位

保留成果は `outcomes` の施設形式と `groups` の複数施設形式を読む。selection指定時は成果のselection hashと全IDの被覆が必須で、同じIDの重複を拒否する。現在未位置集合から外れた保留IDも `holdsOutsideCurrentPopulation` に残す。#20の6施設を扱う際は上記4入力を省略しない。

上の例は #20 の保留だけをCLIへ渡す。#25〜#27や地域別一括調査の結果まで自動で取り込むコマンドではない。次回対象を選ぶ際は[一括調査第1弾の作業割当](../data/national/location-batch1/coverage.json)、`data/national/location-batch2/` の地域別selection/outcomesと各調査の停止・再開条件も照合する。成果JSONは形式が異なるため、異なる形式をそのまま `--hold-outcomes` に渡して全保留を反映したと扱わない。

誤誘導の疑いを示すrelocation/conflict等は未位置施設でも先に評価する。要望や地域空白の未評価はnullを維持する。容易さや保留だけで対象集合から消さない。`automaticSelection=false` と `notSelectedReason` を全施設に出し、実際の初回選定は別記録で施設ID・根拠・次手段・停止条件を決める。