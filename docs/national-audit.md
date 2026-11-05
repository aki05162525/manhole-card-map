# 全国の未表示理由と再確認対象の監査

`tools/national/national_audit.py` は、現在のmanifestから台帳をオフライン再構築し、固定Issue7対象と全国の既知施設を別々に監査する。新しい位置や配布関係を承認する処理ではない。原本・原調査・manifest・生成物を書き換えない。

## 実行

リポジトリルートから実行する。出力は未使用のパスを指定する。

```sh
python3 -B tools/national/national_audit.py --out /tmp/national-audit.json
```

実データの生成後に照合する例：

```sh
python3 -B tools/national/national_audit.py \
  --full data/work/issue14-15-validation/generated/full.json \
  --ledger data/work/issue14-15-validation/ledger.json \
  --as-of 2026-11-05 \
  --out /tmp/national-audit-generated.json
```

上記のfull/ledgerは別途生成する。存在しないときにfixtureへ置き換えない。`--full` はGoのfull JSON、`--ledger` は比較用の統合台帳であり、どちらも任意。台帳の真実は常にmanifestから再構築する。`--as-of` は任意だが、fullと併用した場合はその`evaluatedAt`と一致しなければ失敗する。指定した日付へ生成物を再評価するコマンドではない。

`--root` 以外の入力パスはroot相対。root外参照、既存出力への上書き、`data/work`以外の`data`配下への出力、固定`data/work/issue7-baseline`配下への出力は拒否する。実行時のネットワークアクセスはない。

## 母集団と主な出力

- `fixedAssignment`: 固定810施設。`remainingIds`は固定集合から現manifestの位置採用IDを引いた集合。終了した施設も消さない。`baselineNoLongerSelectedIds`は固定642採用IDのうち現在の選択から外れたIDであり、取消理由までは推測しない。
- `national`: 再構築台帳、任意full、固定担当、明示的に読み込んだproposalファイルに登場する施設IDの和集合。全国すべての施設が収録済みという意味ではない。`generatedUnlocated`と`assembledUnlocated`は別の集合。新たな固定対象外採用は`outsideFixedSelectedIds`へ出す。
- `facilities`: IDごとの位置採用、配布関係、生成状態、原記録、レビュー、調査段階、次の手段、優先順位。原文は`provenance.original`、レビューは`investigation.reviews`にJSON pointer付きで残す。
- `proposals`: proposalの施設/関係ごとに未登録・現行一致・現行差分を記録する。施設の比較は位置追補で置き換わるcoordinate/evidenceを除外する。関係はevidenceも比較する。差があるだけで承認待ち・誤り・適用必要とは断定しない。
- `reconfirmationQueue`: 採用済み出典の条件未点検、明示された移転/競合、出典の古さ、再確認期限、生成座標/配布関係の不一致を列挙する。候補抽出であり取り下げ決定ではない。位置未採用でも現関係と生成関係の差があればこのキューに入る。
- `sharedInvestigationCandidates`: 同住所・同座標のグループ。同棟という判定や施設IDの統合は行わない。
- `cards`: 任意原本対応表との欠落比較、full内の関係なしカード。原本対応表なしの未収録件数は`null`。

`--full`未指定なら、生成未位置件数、配布関係のeffective状態、初ピンカード数などは`null`。`--ledger`未指定なら比較結果は`null`。入力不足を0件・確認済みとして扱わない。レポートには入力JSONのSHA256、一覧取得日、生成評価日、原本対応表の取得情報を残す。assembleが採用証拠のbytes/hashも検査するが、`inputSHA256`は参照された全証拠ファイルのhash一覧ではない。

### 生成物との世代差

施設の確定座標が現台帳と一致するか、配布関係が現在の証拠・条件・期間・カードの原典指紋に対応するかを別々に比較する。古いfullは読めるが、不一致を明示する。現在の関係と一致しない古い`ended`だけを理由に実作業から除外しない。台帳の生statusと、fullのeffective statusも別出力にする。期限・原典変更で失効したfullの関係を、台帳のactive値で復活させない。

full内部の施設/カードID重複、参照欠落、pinと施設座標の不一致、pinカード集合と当該施設のverified関係の不一致は拒否する。一方、現実のGo生成fullには同じカード/施設の期間別関係と完全一致関係が存在するため、関係行を上書きせず保持する。完全一致は`coverage.duplicateGeneratedRelations`に元の行番号を残す。台帳/proposalのカード・施設ペア重複は拒否する。

生成済み座標が一致していても、verified関係があるのにpinがなければ`generated.missingExpectedPin`と`national.missingGeneratedPinIds`に出す。施設に現在の関係があるのにfullで欠けている場合は`missingCurrentRelationCardIds`に出す。これは画面のフィルタ適用後の表示件数の監査ではない。

## 調査段階と追補

原調査の理由ラベルはコード内の小さい対応表でsource/identity/building/relocation/conflict/conditionsにまとめる。未知のラベルは`not-evaluated`。理由と調査段階は独立であり、「new-investigation」などから建物照合完了を推測しない。従来のattempts・nextSource・investigationStatusは原値を残す。定型nextSourceが存在しても、具体的な次の調査を決定済みとは扱わない。

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

例のID/参照先は説明用。実在するIDと調査記録に置き換える。参照ファイル・JSON pointerの解決とhash記録、IDの存在/重複、stage/条件状態の列挙値、優先フラグの型を検査する。stageの値は `not-evaluated`、`not-attempted`、`retrieval-failed`、`retrieved`、`numeric-search`、`building-comparison`、`conflict-investigation`、`conditions-review`。条件状態は `not-evaluated`、`review-required`、`checked`。`checked`は追補の判定であり、このCLIによる規約検証ではない。

優先順位は誤誘導/生成位置の不一致の疑い→利用者要望→地域の空白→初ピン候補カード数の順。利用者要望・地域の空白は未評価なら`null`。自動判定しない。施設IDで安定ソートし、明示された例外理由を残す。初ピン候補カード数は指定fullのverifiedかつactive/upcoming関係を持ち、非reference施設ピンがまだないカード数。調査すれば必ずピンが立つという予測ではない。`estimatedMinutes`は任意の作業見積りで、施設件数とは別。

出典の古さは、追補で基準日を明示した場合のみ730日超を再確認候補にする。証拠確認日を出典基準日に代用しない。期限到来で座標を失効させない。終了のみの施設は生成関係が現在の関係と一致した場合だけ`excluded-ended`にできるが、固定残件には保持し、原典更新/配布再開の確認後に再評価する。

## 未収録カードとの比較

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

## 検証

```sh
python3 -B -m unittest discover -s tools/national -v
mise exec -- go test -count=1 ./...
```

人工入力で、固定対象外追加・重複/参照不整合拒否・任意入力なし・終了除外・採用取消・保留レビュー・古い生成物・関係未生成・出典だけ変わるproposal・追補参照・原本hashを検査する。出典条件の内容審査、個別建物の同定、画面の目視はこの監査の対象外。
