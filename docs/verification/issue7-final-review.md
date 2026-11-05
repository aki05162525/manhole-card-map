# Issue 7 最終統合レビュー

2026-11-05、AI独立統合レビュー。結論：**確認範囲でP0/P1/P2なし。統合データの採用を阻害する問題なし。非阻害の文書差・検証上の限界は下記。** 監査CLI自体と証拠容量・収録再現性は別担当のため、この結論はそれらの承認を代替しない。

ユーザー提示AGENTSを適用した。cwd・祖先およびdocs/tools/data配下に追加AGENTS.md実ファイルなし。既存コード、manifest、元成果、固定baselineは変更せず、出力は本書と `data/evidence/issue7/review-final/` に限定。Go出力は/tmp。子起動・branch操作・commit・push・PRなし。

## 検証結果

- 固定 `data/work/issue7-baseline/hashes.json` のledger/full/assignmentsのSHA256一致を確認。割当810 IDは重複なし。
- manifest全選択を実assembleで読み込み、全840位置・111補正操作を検証。台帳正規化SHA256は `d89e788b0998fd625ea3d2b06e4cae6ff85c1c30f1526bc18c6bd8908702a5ff` に一致。
- baselineからの台帳差分を全フィールド比較。201施設が変化し、198座標追加・対応するEvidence置換・住所5フィールド・電話3フィールドだけ。施設ID集合と1,670配布関係は完全一致。baselineのdeep copyに今回の198更新と8補正だけを適用した期待値が、実assemble出力と完全一致する。
- 生成fullも全フィールド比較。施設ID集合1,735、カード1,313の全内容、配布関係1,825の全内容、トップレベルメタデータが不変。201施設の変更は上記と対応し、198件の座標・Evidenceおよび8補正値が台帳と一致する。配布状態・関係の意図しない変更なし。
- 既存pin全件が完全一致し、今回採用198 IDの配布施設pinだけが追加。最終配布施設pin974、蓋pin1,309。座標の追加は配布再開や在庫保証を意味しない。
- 12地域のmanifest選択は各独立レビューの採用集合（必要訂正後の採用集合を含む）に一致。元202候補から保留6件を除外し、秦野・桜木町の2件を追加して198件。
- `test_assemble.py` は実行して13テスト成功。現行digest固定テストと採用数検査は成功。明示的な保留テストは北関東3件を対象とするが、本レビューでは6候補すべてを別途比較した。

全フィールドのbefore/afterは [ledger-all-field-diff.json](../../data/evidence/issue7/review-final/ledger-all-field-diff.json) と [full-all-field-diff.json](../../data/evidence/issue7/review-final/full-all-field-diff.json)。集計のEvidence差分986は葉フィールドの差分数であり、施設数ではない。

## 実Go再生成と配信成果

以下を実行し、Goはカード1,313、場所1,735、対応1,825、pin lid:1,309/place:974で成功した。

```sh
python3 -B tools/national/assemble.py --out /tmp/issue7-final-review-ledger.json
mise exec -- go run ./cmd/builddata \
  -places /tmp/issue7-final-review-ledger.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05 -out /tmp/issue7-final-review-generated
python3 -B data/evidence/issue7/review-final/verify.py
python3 -B data/evidence/issue7/review-final/focused.py
python3 -B -m unittest discover -s tools/national -p test_assemble.py
```

`full.json`, `details.json`, `pins.json`, `quality.json` は `web/public/data` と `web/dist/data` の双方にバイト一致。生成manifestは入力台帳のパスキー `/tmp/issue7-final-review-ledger.json` 対 `/tmp/issue7-final-ledger.json` のみ異なる。台帳バイトSHA256自体は同じで、このキーだけを置換するとmanifest全体が一致する。manifestまで無条件のバイト一致とは主張しない。各ファイルのSHA256と比較結果は [generated-file-comparison.json](../../data/evidence/issue7/review-final/generated-file-comparison.json)。distのJS/CSSを独立再ビルドして比較したものではない。

親申告のPython38、Go全テスト、Vitest56、lint、format、typecheck、フロントエンドbuild成功と、本レビューで再実行した範囲を区別する。本レビューも実ブラウザーでの操作・目視は未実施。

## 重点確認

**保留6候補**：小山市役所4階、小山市役所1階中央管理室、吉岡町役場上下水道課、柏原市役所かしわらテラス、スワンホール、国分シビックセンター総合窓口。manifest非選択、生成fullの緯度経度なし、配布施設pinなしを全件確認した。IDは [selection.json](../../data/evidence/issue7/review-final/selection.json) に収録。草加の保留住所訂正も8補正に混入していない。

**必要訂正**：北海道26件のverificationMethodは独立レビューのexact newに全件一致し、個別P05-2022 CC BY指定と一般PDLの区別を保持。甲信16件の日付に加え、上山田文化会館の住所出典を市配布本文とする説明訂正も一致。九州9候補のreviewedコピーの日付は訂正済みで、うち8件のみ採用。保留国分は日時修正されていても非採用。本部町住所補正EvidenceもYYYY-MM-DD。数値・scopeの変更はない。合計52件のupdates配下exact訂正を照合した。

**旧柚木家・沼津の同時訂正**：旧柚木家の新倉敷駅混在住所・電話を分離し、玉島3丁目8-25／086-522-0151を採用点と同じ施設に適用。児島駅の住所・電話と新倉敷駅電話も5操作で訂正。沼津水道部庁舎1階・2階は両方とも御幸町16-1から2-20へ訂正され、座標追加と同時に生成fullへ反映。旧柚木家と沼津を、旧住所のまま位置だけ採用する問題はない。

**秦野**：独立レビューの追加候補JSONと採用updatesが一致。保存JAPAN47GO JSON-LDを再解析し、秦野駅観光案内所、大秦町1-1、0463-80-2303、35.37028971/139.225494を確認した。市・運営者との施設対応を記録するレビューを確認。「改札出て左」と「1階」は、それだけで別棟・移転を証明しない。建物代表点として追加採用する判断を支持する。原典の測地系明記なし・入口精度未保証はEvidenceに残っている。

**桜木町**：保存JSON-LDの名称・桜木町1-1・045-211-0111・35.4511374/139.6312274を再解析し、採用数値とhash一致を確認。公式配置資料との照合を記録した再評価READMEと親の採用レビューを確認し、保存photo-overlayを本レビューでも目視した。駅棟東側外縁付近の点であり、窓口西口側という限界と整合する。駅外形外約5.44mを「建物内」と言い換えていない。建物代表用途での採用を阻害しないが、入口・室内窓口・特定屋根面の座標として扱わない。距離計算そのものの独立再実行や現地測量は今回行っていない。

詳細な原数値・採用集合・訂正照合は [focused-checks.json](../../data/evidence/issue7/review-final/focused-checks.json)、reviewedコピーの全変更は [reviewed-copy-diff.json](../../data/evidence/issue7/review-final/reviewed-copy-diff.json)。

## 非阻害事項と文書・コード・原典の全相違

今回新規に確認した記述差：

1. 桜木町followup READMEはRoofSurface183個／外周posList184本とし「1要素が複数ポリゴン」と説明するが、保存GMLをコードと同じXPathで再計数するとRoofSurface183、屋根外周posList183。`coordinate-check.json` と `roof-analysis.json` も183。実コード・原GMLに従い183として扱う。READMEの184と説明の訂正を推奨するが、採用座標・外形距離・建物同定には影響しない。[計数証拠](../../data/evidence/issue7/review-final/sakuragicho-count-check.json)
2. `reviews/sakuragicho.json` の `integrationStatus: pending`、followupのcandidate/notDone manifest適用、秦野additionalCandidateのnot applied、各旧レビューのapplied:falseは現manifestの採用済み状態と異なる。原調査・レビュー時点の履歴として保持されているため現在状態はmanifestと統合文書を優先する。原本へ直接適用済みという意味には変更しない。
3. 生成manifestの/tmp入力パス差は上記の実行条件差であり、配信データの不一致ではない。

地域独立レビューから引き継いだ全相違（本レビューで過去の全生成スクリプトを再実行したという意味ではない）：

- 旧Issue5北関東・西南READMEの「不一致なし」に対し、旧Evidence／生成コードにはfetchedAtがある。Goの厳密7フィールド契約を優先。今回採用Evidenceは契約内。
- 甲信READMEの不一致なし・九州の厳密デコード成功という説明に対し、元checkedAtは日時でGo実行時検査の日付契約を満たさない。九州旧probeはvalidateEvidenceを実行していなかった。今回reviewedコピーと実Go生成で解消。
- 北海道旧verify.pyの7キー検査は日付値の検査を含まない。今回北海道30件の日付は適合し、統合Go成功で確認。
- 旧中国四国追補の「形式上の食い違いなし」に対し、snapshotPath絶対パスはassemble.repo_pathが拒否。今回repo相対参照。
- 旧南関東validate.pyのCRS検証済み説明には対応assertがない。旧検証の効力は数値・feature一致まで。旧building-verificationの6件は追補待ちと記すが更新Evidenceには既に出典・CRS・加工説明がある。
- 旧寝屋川READMEのsuspended維持に対し、旧build.pyは終了状態と読める旧Evidence説明を継承。Issue5 reviewedでは修正済みで今回の候補に含まない。
- 旧北海道decide.pyはH22/H25/H26の個別条件・CRS記録が不足。旧READMEの複数窓口説明に反し、登別第2庁舎・苫小牧北庁舎に総称点を候補化。釧路の共通説明に留萌出典が混入。未解消別棟点や留萌根拠を今回流用しない。
- 千歳の旧経営管理課と現総務課の名称差はbaselineで訂正済み。古いsourceLocatorは履歴として残り、再訂正しない。
- P05-2022個別CC BY 4.0と現行一般PDL1.0を混同できない。北海道の元説明は個別指定を保持せず、今回26件で補正。近畿西部も旧個別ページと現行一般規約を区別する。四国は条件引用先の保存版差異をレビューに記録。
- P05仕様書の建物外周内検査は「8章」ではなく「6章・本文12頁」。旧README・sources.json・policyの参照誤りはexact提案として残す。
- 近畿西部READMEは既存取得時刻を継承するとするがbuild.pyは再利用仕様書PDFのfetchedAtを無条件nullにする。既存.source.jsonには実取得時刻があり、未確認とは区別する。
- 富士宮の臨時配布を庁舎移転とした旧理由、飛騨古川の保存marker見落とし、多度津新庁舎点を旧点とした誤認、キターレ理由への輪島住所混入、上山田の住所出典説明差は各地域のexact訂正提案に記録。現採用点の判断は新レビューを用いる。
- 長岡京の旧分庁舎2を現住所と呼ぶ旧理由に対し、現問い合わせ先は本庁舎5階。配布再開窓口の確定とは分離し、旧施設・配布関係は保持する。
- 秦野の「改札出て左」対「1階」は旧保留判断の修正対象。草加住所差は保留。沼津、旧柚木家、児島駅、新倉敷、本部町の原典との住所電話差は今回8フィールドで解消。

根拠ファイル別の相違を [regional-discrepancies.json](../../data/evidence/issue7/review-final/regional-discrepancies.json) に収録。元調査・旧理由を破壊せずexact訂正提案を別保存する統合方針に従うため、履歴ファイルに誤記が残ることと現在採用データの必要訂正未適用は区別する。今回採用の前提となる説明・日付・住所電話訂正の未適用は検出していない。

## 限界

810件中198件採用、612件未採用という集合差を確認した。**612件の残件が全件確定・全リンク探索済み・公開GISや建物外形まで深掘り済みという意味ではない。** 地域ごとの未探索・部分探索を含む残件は保持される。本レビューは地域レビュー後の統合検査であり、198施設の原典をすべて一から再調査する作業でもない。

原本HTML・写真の外部再公開許諾を認定していない。桜木町・秦野の数値事実と出典を保持する判断と、原本全体の公開を区別する。監査CLI、証拠の収録容量・配布再現性の全調査は別担当。実ブラウザー未実施と既存MapLibreチャンク警告は統合文書の通り。
