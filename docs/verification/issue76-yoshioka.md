# 吉岡町コミュニティセンターの追加採用

利用者が旧「役場の東隣」回答を撤回し、南西側へ訂正した。現配布本文と2019公式ガイドH-4を独立照合したCodexレビューは、吉岡町上下水道課1件の実採用を承認した。対象IDは `facility:kanto-north-c0a593ee1ebbefef4ded`、座標は **36.4471275, 139.0095542**。休日の文化センターや配布状態は変更しない。

採用レビューは `/root/yoshioka_adoption_review`、対象HEAD `44c71554` と固定した追補候補。候補行hashは `aebd365dd33dea4b0f4a53f043412cd970cd13851ff8da9e0f16483e42511e10`。修正必須・任意とも指摘なし。現配布本文の「コミュニティセンター1階上下水道課」、ガイドの赤2＝本庁舎南西棟、西道路・南斜行道路・北本庁舎・東保健センターが外形2133に対応すると確認した。境界余裕約7.16mは絶対精度の保証ではない。

[原候補](../../data/evidence/issue76/yoshioka-followup/candidate.json)、[評価追補](../../data/evidence/issue76/yoshioka-followup/assessment-followup.json)、[調査報告](../../data/evidence/issue76/yoshioka-followup/report.md)を保持する。採用ゲート用の[評価・承認](../../data/national/issue76/gunma/followup/assessment.json)は、この審査内容を既存形式へ整理したもの。原候補座標は変更せず、旧holdは当時の記録として残した。

## 記述差と資料の限界

利用者提示の2020施設計画2頁は町全域の広域図であり、詳細な棟配置図ではない。今回の棟対応には2019公式ガイドを使用した。旧東隣回答・旧保留ラベルは訂正前の履歴として保持する。絶対精度・個別外形更新日・図版年代の限界は共通評価を継承。原本PDF・HTML・描画画像は再配布せず、ignoredの `data/work/issue76/yoshioka-followup/` に保管した。取得記録のSet-Cookieヘッダーは保存対象から除外した。

## 統合と検証

独立レビューでは候補hash、参照8ファイル、原本3件、描画3件を確認。既存の原PBF検証と限定計算成功を引き継ぎ、全suite・全タイルdecode・現地・外部Maps経路を繰り返していない。

親の統合は候補資料を保存した段階で未反映・採用成果物未生成の失敗を確認した後、既存 `prepare_county` で採用・binding・旧値証跡を作った。追補は元assessmentのpathとhashを指定し、同県・同IDの旧holdかつ未承認である場合だけ更新する。無宣言重複・未承認・古いhash・他県への上書きは拒否する。

97件採用時の491件索引は保存し、[追補後の490件索引](../../data/national/issue76/remaining-index-after-yoshioka.json)を別に生成する。関東は145評価・98採用・47保留。玉村の仮設位置は不明のままで、回答待ちは0件。

採用ゲートと現台帳差分7テスト、残件追補6テスト、最新490索引の再生成は成功。実生成は吉岡の1ピンだけを追加し、既存1,095ピン・カード・全実効配布関係を保持した。full/splitの詳細・Maps座標query計2件と配信世代hashも成功。[生成記録](../../data/evidence/issue76/yoshioka-followup/generation.json)を保存し、検証サーバーは終了した。通常フックと統合差分レビューは別途追記する。
