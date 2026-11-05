# Issue 7 中国地方 独立レビュー

座標候補10件 accepted、住所電話訂正5件 accepted。判定・採用ID・exact old/newは `data/national/issue7/reviews/chugoku.json`。旧柚木家の座標は同IDの住所・電話分離訂正と同時採用する条件付き。台帳・manifestへの反映は実施していない。

長船は旧ID・旧所在地・旧関係を維持し新庁舎へ移さない。新見協会点をJR新見駅へ転用しない。残47は保留維持であり、全件独立深掘り済みではない。

`verify.py` は入力を変更せず、原ZIPから4候補、HTMLから6候補の原数値・軸順を独立抽出し、原本hash、Go Evidenceの7フィールド、固定ledgerの訂正old値を検査する。`numeric-checks.json` に原feature・CRS・原数値・経路の施設名と表示中心を記録。`identity-excerpts.json` は同定の補助抜粋。下松管理者HTMLはCP932。PDF第1頁の諸元と管理者のアリーナ面積・空調説明を併用した。

ネットワーク再取得はしておらず、新しいfetchedAtを捏造しない。保存原本のhash検証と、独立の取得時刻の立証は異なる。相対snapshotPathのみを使用。原数値抽出と座標利用の判断は、原本全文の公開許諾の判断とは区別する。P05個別CC_BY_4.0と一般PDL1.0は上書き関係として扱わない。

Go検査は現行 `cmd/builddata/ledger.go` からEvidence構造体とvalidateEvidence関数を抽出した `evidence-probe.go` で15件を厳密デコード・検証し、結果を `go-evidence.txt` に保存。

文書コード相違は2件：旧中国四国READMEの統合可能という説明に対し101件の絶対snapshotPathをassemble.pyが拒否すること、旧west-south READMEの相違なしという記載に対し旧訂正EvidenceのfetchedAtを現行Goが未知フィールドとして拒否すること。今回成果はコードに従う。
