# Issue30 位置未確定施設の一括調査・第1弾

## 対象と選び方

PR #29をマージした `757481bfeb0a72e97b73887a75d7792316f55676` から台帳・実データ・全国監査・優先順位を再生成した。2026-10-21取得一覧と保存済み2026-11-05確認一覧を用い、評価日は2026-11-05。全施設の配布状況を新たにWeb確認したという意味ではない。

開始時の台帳未位置612IDはIssue24と完全一致した。生成全体の未位置761施設には台帳外149施設が含まれる。[baseline](../../data/national/location-batch1/baseline.json)に入力hash、基準コミット、対象ID、分類集計を保存した。

地域別3担当が各10施設を選定し、親が最新分類との施設名・地域・初ピン候補の一致、重複なし、既存保留との非重複を照合した。初ピン候補と自治体単位の新しい共通資料を優先した有意抽出であり、全国の無作為標本や成功率の推定用標本ではない。

- [静岡10施設](../../data/national/location-batch1/east-selection.json): 県共通オープンデータから複数自治体の施設を共同調査。
- [近畿10施設](../../data/national/location-batch1/kinki-selection.json): 伊丹仮設店舗の再審査と、文化施設・窓口の自治体公開データ探索。
- [中国・九州10施設](../../data/national/location-batch1/west-selection.json): 熊本・大分の公開施設資料と岡山県内の建物対応。

[全612IDの作業割当](../../data/national/location-batch1/coverage.json)は今回30、既存保留11、終了のみ9、今回対象外562に分かれる。対象外を未調査や重要性なしとは扱わない。北海道・東北・関東・北陸甲信・四国・沖縄などを今回の実査範囲に含めたとは主張しない。共通資料の発見、移転・再開の新資料、利用者報告、今回の結果を次回選定の材料にする。

#20の6施設と#25〜#27の5施設は新資料なしに同じ調査を繰り返さない。伊丹仮設店舗はIssue24に定めた初回3群の終了・停止という再審査条件を満たしたため今回含めた。同住所・同名称だけで施設IDや配布関係を統合しない。

## 結果と独立レビュー

最終採否は[integration.json](../../data/national/location-batch1/integration.json)に集約した。調査者の原成果は提案時点の記録であり、`pending`や候補数を最終採用数と読まない。

- 大阪市下水道科学館: 市公開CSVのJGD2011施設点を、現配布案内・運営者構内図・建物外形と照合して採用。
- スワンホール: 市施設カルテ・決算資料で中央公民館の2020年移転を確認。現スワンホールに対応するP05点を採用し、別地点の競合点を除外。P05で競合が生まれた編集過程までは確認していない。
- 笠岡市カブトガニ博物館: 現配布先、カブトガニを模した形、周辺配置とGSI最適化Vector外形を照合。穴を除いた外形重心が建物内にあることを確認して採用。
- 大分市美術館: 公式館内図の2翼・円形部・連絡通路を外形と照合。重心が建物外になるため、建物内代表点を別途算出して採用。

30施設中、提案6・採用4・保留26。調査担当を入れ替えた[近畿レビュー](../../data/national/location-batch1/review-kinki.json)・[西レビュー](../../data/national/location-batch1/review-west.json)は各2件を承認した。[東レビュー](../../data/national/location-batch1/review-east.json)では新居関所史料館・焼津市観光協会の2候補を採用保留にした。未記載CRSの施設点だけで外形を選ぶ依存を、別の図形・配置資料で解消できなかったためである。計算が間違っていると実証したわけではない。

各10施設の調査記録: [静岡](location-batch1-east.md)、[近畿](location-batch1-kinki.md)、[中国・九州](location-batch1-west.md)。共有資料の取得時間を各施設に重複加算せず、原成果に記録した地域単位の実測時間を使う。全612施設への成功率や所要時間には外挿しない。

Gemini 4 Argonの最終独立レビューは重大指摘0件・任意改善2件。4採用の原本・施設対応・加工条件・統合と保留判断を確認し、限定調査としてIssue30を完了してPRに進めてよいとの評価だった。詳細は[最終レビュー記録](../../data/national/location-batch1/review.json)。任意提案のうち、検証記録は `pins.detailsSHA256` と所属を明記した。東の原提案スクリプトは履歴として保持し、将来再調査する際は西のスクリプトと同じ丸め後内包検査も行う。今回採用したVector2点にはこの検査が既にある。

別担当の[整合監査](../../data/national/location-batch1/validation-review.json)にあるpendingは、その監査時点で未確定だった中央文書・最終レビューの除外記録であり、現在のレビュー待ちを意味しない。最終状態は上記レビュー記録へ追補した。

## 採用・生成の検証

新規位置4件だけをmanifestで選択し、採用時identity・原採用行hashを持つ[binding](../../data/national/location-batch1/location-lifecycle.json)を同時に追加した。全台帳比較で変更が対象4施設のcoordinate/evidence/locationReviewだけで、住所・名称・全配布関係・他施設・既存ピンは不変であることを確認した。東の保留2候補は座標なしのままという回帰検査も追加した。

大阪の座標を期待するテストは採用前に失敗、採用後に成功。全件差分テストの採用範囲は当初の提案6件から独立レビュー後の4件に絞り、保留2件の非採用を明示した。履歴digestは変更していない。Python92テストとGo全体、実データビルド・型検査が成功。既存のMapLibre大チャンク警告は残る（#9）。

[実生成比較](../../data/national/location-batch1/generated-comparison.json)では施設ピン978、台帳内未位置608、生成全体未位置757。新しい4ピンにより `27-100-C001`、`28-207-A001`、`33-205-A001`、`44-201-D001` の各カードに初めて配布施設ピンが付いた。カード1,313・施設1,735・関係1,825は変わらない。生成漏れピンは0。これは生成データの値で、外部デプロイ済み件数や当日の在庫を表さない。

原本PDF/一般HTML/写真は許諾を推定して再配布せずworkへ保持。確認済み条件に基づくCSV・Vectorタイルと自作事実記録・取得hashを追跡する。Vector原本の取得範囲は同じETagとLast-Modifiedで揃えた。出典と加工表示を配信Evidenceにも保持し、国土地理院がこの施設点を作成・承認したとは表示しない。CIは保存証拠のbytesを照合するが、施設同定を自動保証しない。

実データ用ブラウザー回帰検証はfull/splitとも成功。追加で4採用と2保留を各モードで開く計12ケースを検証し、採用4件の実canvasクリックと座標Mapsリンク、保留2件のピン非生成と住所検索維持を確認した。[ブラウザー記録](../../data/national/location-batch1/browser-verification.json)を参照。自分で起動した4173の試験サーバーは終了した。現地、外部Maps上の到達、スマホ性能、同一origin旧版→新版の保存更新は今回未確認。SW・更新処理のコード変更はない。

## 再生成

以下は開始時の入力を保存した実行例。出力が存在する場合は未使用の作業パスへ替え、後続入力も同じパス表記に揃える。採用後のmanifestで実行した結果を開始時baselineと呼ばない。

```sh
mkdir -p data/work/location-batch1
python3 -B tools/national/assemble.py --out data/work/location-batch1/before-ledger.json --audit-out data/work/location-batch1/before-assembly.json
mise exec -- go run ./cmd/builddata -places data/work/location-batch1/before-ledger.json -list data/raw/gkp-list-20261021.html -date 2026-10-21 -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 -out data/work/location-batch1/before-generated
python3 -B tools/national/national_audit.py --full data/work/location-batch1/before-generated/full.json --ledger data/work/location-batch1/before-ledger.json --as-of 2026-11-05 --out data/work/location-batch1/before-audit.json
python3 -B tools/national/location_priorities.py --audit data/work/location-batch1/before-audit.json --full data/work/location-batch1/before-generated/full.json --hold-selection data/national/issue20/selection.json --hold-outcomes data/national/issue20/north-outcomes.json --hold-outcomes data/national/issue20/oyama-outcomes.json --hold-outcomes data/national/issue20/fujioyama-outcomes.json --out data/work/location-batch1/before-priorities.json
```

優先順位CLIは#25以降の形式の違う成果を自動統合しない。親が別途既存保留11IDと停止・再開条件を照合した。取得しただけの資料、名前だけ一致した点、座標系が未確認の数値を採用済みと扱わない。

第1弾の到達段階・停止/再開条件は[全国監査用追補](../../data/national/location-batch1/followups.json)へ正規化した。これは元調査を置換しない。採用後の監査例:

```sh
python3 -B tools/national/national_audit.py --full data/work/location-batch1/after-generated/full.json --ledger data/work/location-batch1/after-ledger.json --as-of 2026-11-05 --followups data/national/location-batch1/followups.json --out data/work/location-batch1/after-audit.json
```

`after-ledger.json`と`after-generated`は採用後のmanifestで上のassemble/builddataを別出力先へ実行して作る。初回の追補検査でレビュー文書の参照にJSON pointerが不足していたため、該当施設行へのpointerを付けて再実行し成功した。今後も追補を使わない監査と使う監査を区別する。

## 履歴文書の扱い

Issue24の「次の作業」「後続調査未実施」は当時の記録として残し、現在の後続調査への案内を冒頭に追加した。優先順位手順の#20向けコマンドが#25以降の保留も自動反映するわけではないことを明記した。原調査・当時の件数・採用判断を現在の結果に書き換えない。
