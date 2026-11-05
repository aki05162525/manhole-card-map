# Issue7 audit 独立レビュー

2026-11-05。対象は `tools/national/issue7_audit.py`、`tools/national/test_issue7_audit.py`、`docs/issue7-audit.md`。比較対象として assemble の座標・hash・path処理、coverage の生成契約、および Go の座標処理を読んだ。

P0/P1なし。P2を1件、非阻害の文書差異を1件確認した。原調査810被覆、明示採用、followup、生成座標、pin、原残件と現残件の分離について、過大な「全確定」「全Web深掘り済み」を出す経路は今回の負例では認めなかった。レビューは採用証拠の真偽や各地域の調査の十分性を認証するものではない。

## P2: 数値表現だけでledger一致数を過少集計する

対象: `tools/national/issue7_audit.py:178`（`assemble.exact` の呼び出し）。

採用updateが `{"lat":35,"lng":139}`、ledgerが `{"lat":35.0,"lng":139.0}` の場合、両方とも座標検証を通過するが `ledgerAdoptedMatches=0`、施設の `ledger.matchesAdopted=false` となる。同じfullは `currentIntegrated=1` になる。原因はledgerだけJSON文字列比較を行い、full側172行の数値比較とは異なること。

実害は、同じ地点を保持した有効なledgerの数値表現が再シリアライズ等で変わった際に、未反映・不一致と誤認させること。全件確定の過大表示を作る不具合ではない。現行assembleがupdateの値をそのまま引き継いだ出力で発生しているとの証拠はなく、通常経路への影響は限定される。

再現: 証拠の `reproduce.py` を実行し、`negative-results.json` の `OBSERVATION equal numeric int float ledger mismatch` を参照。採用hashは正しく、full/ledgerとも同じ地点である。期待値はfull同様、数値が等しければ1。実測値は `currentIntegrated=1, ledgerAdoptedMatches=0`。

修正案: 両座標は既にboolを拒否しているので、ledgerもlat/lngの数値比較を行う。採用hashの正規化・照合はそのまま保つ。int/float混在の一致例と実座標が異なる不一致例をテストに加える。

文書との差異: `docs/issue7-audit.md:50` は「座標が採用座標と一致」とするが、実装は数値表現まで一致させる。上記評価では実装を正として扱った。

## 非阻害: fullの不正座標拒否範囲が文書より狭い

`docs/issue7-audit.md:62` は任意full / ledgerの「不正座標を拒否」とする。実際の `issue7_audit.py:147-151` はfullの座標がdictであることを確認した後、statusがconfirmedの場合だけlat/lngを検証する。`status=candidate, lat=999, lng=139` は受理される。reference pinもフィルタ対象外なので座標検証されない。一方ledgerはcoordinateがあれば検証する。

証拠: `OBSERVATION invalid nonconfirmed full coordinate accepted`。結果は `currentIntegrated=0, targetConfirmedLocations=0, targetPins=0`。この差異から確定数を過大計上することはないため、機能阻害とは扱わない。「fullのconfirmed座標と非reference place pin、およびledgerの座標」と文書の範囲を明記するのが小さい修正となる。

確認した文書・コード差異は上記2件。他の読んだ仕様記述との食い違いは見つからなかった。

## 負例と責務の確認

既存11テストは成功。独立に追加した23ケースも、拒否・集計結果・既知の問題の再現をすべて確認した。23ケース成功はP2が解消済みという意味ではなく、不具合の観測値も再現できたという意味である。

|確認対象|負例または境界例と結果|
|---|---|
|原調査810被覆|分類欠落、候補と原残件の二重分類、別地域ID、baseline担当重複を拒否|
|manifest採用hash|座標以外のmetadataだけ変更してもhash不一致で拒否。採用先update欠落、採用ID重複も拒否|
|入力の厳密性|JSON重複キー、NaN、root外のpath参照を拒否|
|候補とfollowup|未採用原候補を残件に含め、followup採用済み原残件の分類・attemptsを保存|
|全件採用の誤読|810件すべてhash付きで採用しても、originalUnresolved=810、attempts空、調査status=partialを保持。生成未指定の各値はnull|
|古い生成物|採用座標と異なるconfirmed full / ledgerはともに一致0。fullのconfirmed総数は1で区別|
|未採用施設のpin|未採用IDのconfirmedとpinが存在しても、採用座標の生成一致には加算しない|
|座標候補とreference|採用座標と同値のcandidateとreference pinでもconfirmed・integrated・pinに加算しない|
|pin契約の局所検証|placeと異なるpin座標、非reference pin重複、bool confirmed座標を拒否|
|ledger単独|ledger一致は1でも、full由来の生成一致・pinはnull。ledgerのID重複は拒否|
|coverageとの境界|verified配布関係・confirmed座標があるのにpinを欠くfullを作成。Issue7はintegrated=1 / pin=0を報告し、coverageはpin contract mismatchで拒否|

最後の境界は責務分離として妥当。`currentIntegrated` は定義どおり採用座標の反映を表す。配布status、関係の期限・承認、pin生成条件、カード全体の表示充足はcoverageで別途検証する必要がある。Issue7の成功終了だけでその保証を得たと扱うべきではないが、既存文書にも明記されているので指摘とはしていない。

また原調査の `investigationStatus` は記録値であり、証拠原本の検証や深掘りの十分性をCLIが判定しない点も、コード・文書で一致している。

## 実入力と並行作業の扱い

実入力を固定件数の期待値なしで読み、各入力のhashを出力に保存した。取得時点は候補202、原残件608、採用198、現残件612、未採用候補6。依頼時点の168との違いは、親側の統合作業が進んだ結果として扱い、合否条件にしていない。取得直後のhash照合で途中更新は見つからなかった。対象3ファイルと参照したPython実装についても、保存したレビュー時ソースと照合時のファイルは一致していた。

`repository-audit.json` は意図的に古い `data/work/issue7-baseline/full.json` と `ledger.json` を指定して取得した。そのため採用198に対し生成一致0、未反映198となった。これは新しい生成結果の欠陥を示すものではない。新しいfullを生成したとも、現在のデプロイを検証したとも主張しない。work非依存の既定監査は既存テストで別途通過している。

桜木町は原残件1・現採用1・現残件0を同時保持していた。南関東も原候補7・原残件57に対し現採用8・現残件56を保持。原残件と現残件が単なる別名になっていないことを実入力でも確認した。

親・対象ディレクトリを探索したがファイルとしてのAGENTS.mdは見つからず、依頼に添付された共通AGENTS指示を適用した。既存コード・テスト・manifest・入力JSONは変更していない。子起動、branch、commit、push、PR操作は行っていない。並行担当による変更は本レビューの成果に含めない。

## 証拠と再実行

成果は `data/evidence/issue7/review-audit/` に限定した。

- `source/`: 読んだ対象3ファイルとassemble/coverageの保存版。親側の後続編集に依存せず再現するための参照コピー。
- `reproduce.py`: 一時fixtureを/tmpに作る独立検証。実入力に固定採用件数を要求しない。
- `negative-results.json`: 23ケースの結果と保存版ソースのSHA256。
- `existing-tests.txt`: 元の11テストの成功出力。
- `repository-audit.json`: 実入力の全出力、読んだ入力のSHA256、810施設の個別状態。
- `repository-check.json`: 取得後のhash照合、レビュー時ソース一致確認、集計。

```sh
PYTHONDONTWRITEBYTECODE=1 python data/evidence/issue7/review-audit/reproduce.py
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tools/national -p test_issue7_audit.py
```

前者は保存版ソースを検証する。後者は実行時点のリポジトリコードを検証するため、後続修正があれば今回のレビュー時とは対象が異なる。
