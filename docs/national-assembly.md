# レビュー済み全国台帳のオフライン統合

`tools/national/assemble.py` はPython 3.9以降の標準ライブラリだけを使う。ネットワーク、全国raw原本、`data/work`内の入力コピー・手動合成台帳は不要。元台帳・パッチ・位置追補・証拠を変更せず、新しいPlaceLedger schema 1を出力する。

リポジトリrootから実行する。

```sh
python3 -B tools/national/assemble.py \
  --out /tmp/national-assembled.json \
  --audit-out /tmp/national-assembly-audit.json
python3 -B -m unittest discover -s tools/national -v
mise exec -- go test -count=1 ./...
```

`--out`を省略すると標準出力。親ディレクトリは既存のものを指定する。入力検査が失敗すると非ゼロ終了し、台帳出力に進まない。`data/work`を除く`data`配下への出力は拒否する。`--root`でリポジトリroot、`--manifest`でroot相対の選択manifestを指定できる。

## 適用順序と承認範囲

`tools/national/manifest.json`が入力を明示する。globやディレクトリの自動走査はしない。

1. `data/overrides/places.json`、8地域、6つの`data/overrides/proposals/{kanto-south,kinki,west-south,north,kanto-north,chubu}.json`を読み込む。
2. 入力のメモリ上のコピーへexactパッチを適用する。対象行は一意、旧値は完全一致が必要。フィールドの不在とnullを区別し、重複・同一行への全体置換とフィールド置換の重複も拒否する。
3. 施設ID、関係のcardId/placeIdが同じ行は、全内容が一致するときだけ重複排除する。異なる値、legacy alias衝突、存在しない施設を参照する関係は失敗する。
4. 全施設・関係の証拠bytesのSHA256、URL・確認主体・確認日などを検査する。
5. 統合後にだけmanifestで承認された位置を追補する。未存在施設、重複座標パッチ、既存coordinateの上書きを拒否する。lat/lngは両方必須の有限数値で、文字列・真偽値・null・範囲外を拒否する。座標追補の証拠SHA256も検査する。
6. 任意の `locationLifecycle` を選択している場合は、ファイルhash・採用時binding・判断履歴の前state hashを検査し、再承認・訂正・取り下げを最後に適用する。identity不一致は個別のneeds-reviewとして座標を省略し、hash不一致等の整合性違反は引き続き失敗させる。詳細は[位置ライフサイクル](location-lifecycle.md)。

2026-11-05のIssue18照合時点では、manifestは位置追補840件、次の11パッチファイル・111操作を選択している。`locationLifecycle`選択は0件で、機能実装と全国既存位置への導入は別である。以後の件数はmanifestと監査の再実行で確認する。

| ファイル | 操作数 | 選択 |
| --- | ---: | --- |
| issue7/address-reviewed-patches.json | 3 | 沼津水道部2窓口住所、本部町県名 |
| issue7/chugoku-reviewed-patches.json | 5 | 倉敷の混在住所電話と不足電話 |
| issue5/north-reviewed-patches.json | 1 | 千歳の部署名 |
| issue5/west-south-reviewed-patches.json | 4 | 宇美棟別名称2件、神埼hours/condition2件 |
| kanto-south-integration.json | 52 | replacements全件 |
| kinki.json | 9 | patches全件。deferredCorrectionsは対象外 |
| west-south.json | 3 | patches全件 |
| north.json | 16 | 元north地域ファイルへの変更のみ。生成full削除5件は保留 |
| kanto-north.json | 13 | patches全件 |
| chubu.json | 4 | replace-relationのみ。見出し除外3件は保留 |
| chubu-west-reviewed-closure.json | 1 | 家康館の再確認期限追加。現在active維持 |

SouthKantoの`sourceFile=data/work/national-input/places.json`だけは、明示的に`data/overrides/places.json`へ対応付ける。旧値の照合を省略する例外ではない。それ以外のworkパスの読み替えはしない。

パッチ選択はファイルhashと配列indexで固定する。位置選択はfacilityIdと選択行全体の正規化JSONのSHA256で固定する。これにより既存ファイルへの未レビュー追記も自動採用されない。初期位置選択は千葉`scope=building`35件、`chubu-east-south.json`41件だけ。その後、神奈川のbuilding/office-entrance 21件、東京77件、近畿31件、東北59件を親レビュー後に追加した。北海道は独立レビュー `data/national/reviews/north-hokkaido.json` の無修正採用27件のみ追加し、要訂正4件・保留41件は対象外。中部西部は独立レビューのaccepted 29件のみ追加し、住所feature等は採用しない。九州沖縄は独立レビューaccepted 61件と、原本CSVの菊水ロマン館行に訂正した1件を追加。誤った緑彩館の行と保留3件は採用しない。東北の花巻本庁舎・新館共通点2件と処理場2件は建物同定待ちで保留。千葉・神奈川の保留施設代表点と中部北部は `facility-point-scope.json` の独立レビューaccepted 50件を追加。scopeの単語だけで判定せず原典の対象建物を確認した。中国四国・埼玉は独立レビューaccepted 136件を追加。CSの原本絶対パスは元提案を残し、採用用追補でrepo相対パスへ変換した。茨城・栃木・群馬は独立レビューaccepted 37件を追加。P05競合・住所feature・棟未特定・ORIGAMI原典座標差は保留。残る保留・要訂正地点とofficial-facility-indexは対象外。

承認範囲を追加するときは原本と競合をレビューしてからmanifestの選択を追加し、テストの件数・採用差分を再検証する。位置行hashは `sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode())`。パッチhashはファイルの元bytes。追補ファイルを置くだけで承認される仕組みはない。

既存の履歴digestは新しい採用に合わせて上書きしない。履歴テストでは後続の選択を明示的に外して旧基準を再現し、後続採用は別テストで対象ID・許容フィールド・全関係の差分を検査する。Issue30では4施設のcoordinate/evidence/locationReviewだけが変わり、保留2候補が未選択であることも検査する。

## 時刻と再現検証

位置証拠の`checkedAt`がタイムゾーン付きtimestampなら、その表記の暦日へ正規化する。元の位置追補ファイルを変更せず、任意の監査出力にも`originalEvidence`としてtimestampをそのまま保存する。置換前の施設証拠は`previousEvidence`に記録する。タイムゾーンのないtimestampは失敗する。監査出力には入力ファイルhashと適用件数も含む。

親の手動基準`data/work/national-assembled-reviewed-itg.json`との一度限りの比較で、施設1,586件・関係1,670件、全フィールド一致を確認した。比較は施設ID・cardId/placeIdで配列を整列する。この比較はIssue5開始前の履歴である。基準照合テストはworkファイルを読み込まず、Issue5の固定基準から37位置・名称3件・神埼hours/conditionだけが変化したことを全フィールド比較した最終出力の正規化JSON SHA256を回帰テストに固定している。Issue7ではそこから198位置と住所電話8フィールドだけが変化したことを比較し、下記digestを更新した。詳しくは[Issue7統合記録](verification/issue7-integration.md)。Issue26以降もこの履歴digestを保持し、`test_assemble.py` の `batch1_manifest` で `locations` / `locationLifecycle` の `data/national/location-batch2/` と `data/national/issue76/` 配下の選択をすべて除き、さらにIssue26の住所パッチとIssue30の位置・binding選択を除いたmanifestで旧基準を照合する。844件の選択検査と第1弾4施設の差分検査も `batch1_manifest` を使う。Issue7の旧不採用3施設の検査も同じ履歴入力を使う。これら4テストは履歴契約であり、現manifestの総数検査ではない。別テストで石巻1施設の住所・証拠の訂正、およびIssue30の4施設への位置追加だけが生じ、他の施設・全関係を保持することを検査する。

```text
d89e788b0998fd625ea3d2b06e4cae6ff85c1c30f1526bc18c6bd8908702a5ff
```

テストは実装前のImportError（RED）から実装後の成功（GREEN）を確認した。旧値不一致、不在行、不在フィールド条件、重複・重複範囲パッチ、同ID異値、alias衝突、不在施設参照、未承認削除非適用、位置上書き・重複・型違反、証拠hash不一致、timestamp、manifestの変更を検査する。統合テストは入力hashが実行前後で変わらないことも検査する。

## CIと残る範囲

`cmd/builddata/fragments_test.go`がPython統合コマンドと単体テストを実行する。既存のGoによる厳密デコード、mergeLedgers、全関係の施設参照、relationStatus、全証拠hash検査を維持する。`.github/workflows/ci.yml`がバックエンド変更と判定した場合の`go test -count=1 ./...`から実行される。CIの`ubuntu-latest`が提供する`python3`を使い、欠落時はskipせず失敗する。GoのテストキャッシュがPythonの編集を検知しない場合があるため、ローカル再検証には`-count=1`を使う。

CIに必要なのは選択manifest、台帳・パッチ・位置追補、それらの採用証拠が参照する保存原本、テストが読むfacility-point-scopeレビューJSON、置換前pilotの証拠。新規採用時は、CIに必要な選択ファイルと参照証拠を同じ変更に収録する。

初回統合時の「親作業中の新規ファイルが未追跡」「本作業はstage・commitをしない」という説明は当時の作業記録だった。該当入力・証拠は既にGit管理され、PR #21時点で現在の手順から除去済み。追跡状況は今回も確認した。今後の変更にも未追跡という前提を持ち越さない。

カードの原本への存在確認、sourceHashと最新原本の照合、`change.previousPlaceIds`が旧カード関係に属するかの確認は、既存builddataの全国rawを使う検証に残る。previousPlaceIdsは未採用の旧place IDも合法に含むので、承認済み施設一覧への参照として誤って拒否しない。raw無しの本処理は台帳の施設参照と保存証拠を確認するもので、全国の未解決調査が完了したことを意味しない。

## 見つかった記述の差

- 初期依頼文の「完成済みパッチ7ファイル」に対し、当時の列挙と実ファイルは6つで、初期実装は6ファイル97操作だった。Issue5開始前は家康館の再確認期限パッチを加えた7ファイル98操作。Issue5完了時は9ファイル103操作。Issue18照合時点はIssue7を含め11ファイル111操作。Issue26の住所・証拠2フィールド追補後は12ファイル113操作。
- `data/evidence/national/proposals-chubu/README.md`が指摘する、初期地域記録の「入力外のため新規関係を登録できない」は現在のGoの`change.kind=addition`対応と一致しない。現在のコードに従い、レビュー済みproposalを統合する。
- 千葉位置追補の`checkedAt`はtimestampだが、既存GoのEvidence検証は日付のみを受け付ける。元証拠を保持して出力を日付へ正規化した。
- 変更前のfragmentsテストは未補正のpilot＋全地域を直接mergeしており、各追補READMEの「exact patchを先に適用する」手順と一致していなかった。厳密mergeを維持したまま適用順序を修正した。

## Issue #5 位置追加

北関東の4施設を独立レビュー後に追加。取得日時を保持する原候補とは別に、Go Evidenceの7フィールド契約に合わせた `data/evidence/issue5/review-north-kanto/proposed-location-updates.json` をmanifestで選択した。旧台帳との差分が該当4施設のcoordinate/evidenceのみであること、実Goビルドで配布ピン743件になることを検証した。原取得記録は削除しない。

南関東9施設と近畿4施設を追加し、Issue5の位置追加は計17件。近畿は寝屋川の旧「終了」説明を独立レビューのexact訂正どおり統合用コピーで修正し、suspendedを維持した。13施設のcoordinate/evidence以外に差分がないこと、実Goビルドで配布ピン756件になることを検証した。南関東の原検証スクリプトは説明に反してCRSを検査せず、独立レビューで補完済み。P05補助資料の追補待ち記述も、今回採用した6件には当てはまらない。

西日本・南日本6施設を独立レビュー後に追加し、Issue5位置追加は計23件。神埼は公式ページ間の休館日の相違をhours/conditionへ明示し、activeは変更しない。宇美の南館/本館名称2件もexactパッチで訂正。変更範囲を前回台帳と全フィールド比較し、実Go生成を確認。元訂正案の取得時刻は補助記録に保持し、Go非対応fetchedAtを統合用Evidenceへ持ち込まない。P05の個別CC BY指定と一般PDL1.0を区別するレビューを根拠とする。

北海道・東北10施設を追加し、Issue5位置追加は計33件。P05由来8件は独立レビューの出典・加工表示追補を採用し、西日本レビューとの整合のため個別CC BY 4.0指定と一般PDL1.0の留保を併記した統合用コピーを使用。旧原本/調査記録は変更せず、Google由来6施設・その他146施設の位置は保留。前回から10施設のcoordinate/evidenceのみ変化したことと実Go生成を検証。千歳部署名は後続のexactパッチで訂正した。

中部は独立レビューacceptedの燕2窓口・小矢部の3施設のみ追加し、Issue5追加は計36件。原説明の「住所ジオコードではない」はP05自体の作成工程を否定しない記述に訂正。規約・カタログに対する施設同定という誤った説明も統合用コピーで訂正した。その他5候補は建物の継続性・棟対応の追加資料待ちとして未選択。3施設のcoordinate/evidenceのみの差分と実Go生成を検証。

横浜駅観光案内所は独立レビュー済みPLATEAU建物代表点を追加。Issue5の位置追加は計37施設、配布ピン総数776。市配置図のモアーズ名称表示は原図にないため、同定は配置・輪郭と他資料との対応として理解し、名称表示を根拠としない。千歳の部署名を別パッチで訂正。前回台帳との差分を全フィールド検証し、全国fullを再生成した。

## 採用後の位置変更

位置採用元を消さず、manifestの `locationLifecycle` で再承認・訂正・撤回を追補できる。状態・hash・操作手順・未管理既存位置の限界は[位置ライフサイクル](location-lifecycle.md)を参照。

## 位置精度と生成契約

`apply_locations`が通常台帳へ追補するのはcoordinateとevidenceで、原追補のscopeは構造化した精度フィールドとして配信されない。原追補やlocationLifecycleのadoption履歴には保持できるが、配信の `confirmed` は建物/入口の精度区分ではない。Goでは検証後の台帳に座標が残ればconfirmedとなり、位置履歴の保留・撤回では座標が除去される。

PythonとGoの施設座標検査は有限数値の緯度±90・経度±180で一致する。保存viewportの緯度±85は別の表示復元ポリシーであり、採用座標を切り詰めない。以前のGo±85との不一致は[Issue18契約照合](verification/issue18-contracts.md)に履歴として残し、修正・境界検証・現行データ不変の確認は[Issue22記録](verification/issue22-coordinate-contract.md)に記録する。

## Issue26 住居番号の訂正

石巻市かわまち交流センターは2022年の住居番号変更で11番21から11番12号になった。現配布案内には旧番地が残るため、原文とカード別関係を保持し、施設の住所と根拠だけをexact field patchで追補した。1階表記は配布案内に基づき維持する。新しい座標は採用していない。詳細と実生成差分は[Issue25〜27統合記録](verification/issues25-27-integration.md)を参照する。

## Issue30 地域別一括調査の第1弾

30施設の調査で得た6候補を独立レビューし、大阪市下水道科学館・スワンホール・笠岡市カブトガニ博物館・大分市美術館の4施設を追加した。新居関所史料館・焼津市観光協会は派生計算を再現できたが、現施設と外形の対応が不足しているため未選択。原提案は保持する。

第1弾統合コミット `f66b7e99`（評価日2026-11-05）では位置追補844件、exactパッチ12ファイル113操作だった。当時の4採用にはそれぞれbindingを作成し、`locationLifecycle`は1ファイル4binding・event/groupなしだった。従来の未管理既存位置全体を移行したわけではない。施設ピン978、台帳内未位置608、生成全体未位置757という別集合の集計と再生成手順は[第1弾記録](verification/location-batch1.md)を参照する。

## 位置調査第2弾の統合後

2026-11-05、地域PR45〜56を統合した `11b7e4ee` のassemble再実行では、位置追補864件、exactパッチ12ファイル113操作、`locationLifecycle` 9ファイル24binding・2group・0event。第2弾の追加20施設IDだけにcoordinate/evidence/locationReviewの差分があり、既存施設と全1,670関係を保持する。台帳1,586施設の未位置は608→588。これは生成fullの全施設・地図ピン数とは別の集合である。[第2弾最終集計](verification/location-batch2.md)に地域別採否・独立レビュー・再現コマンド・未確認範囲を記録する。

## 関東の実採用（Issue76）

関東145施設の評価から97施設を独立承認し、原候補座標を保って採用した。台帳未位置は588→491、実生成の配布施設ピンは998→1,095。保存一覧は2026-11-05取得分、生成評価日は2026-11-06。配布関係や在庫を新たに確認した件数ではない。[採用・検証記録](verification/issue76-adoption.md)と[残件491施設](verification/issue76-remaining.md)を参照する。

その後の吉岡1件の独立承認追補では98採用・台帳未位置490・配布施設ピン1,096。[吉岡追補](verification/issue76-yoshioka.md)に差分検証を記録する。

2026-11-06の人手回答後、承認済み15施設を追加採用。台帳未位置475、関東保留32、実生成の配布施設ピン1,111。配布状態・在庫の新規確認ではない。成果・再現手順・限界は[Issue60採用記録](verification/issue60-human-adoption.md)を参照。

## Issue60 利用者指定の限定例外

No6/11/19の3施設は、利用者の明示判断により通常の独立承認とは別の `manual-user-approval` 経路で採用する。ID・指定数値を限定し、旧行・証拠・選択hashと既存の参照検査を維持する。No19は誤転記値の撤回、停止、訂正後の再承認を保存した。独立位置検証・利用条件確認済みとは扱わない。[判断・検証記録](verification/issue60-manual-user-approval.md)を参照。残件生成では `issue76Adopted` と `manualUserApproved` を分け、通常のreview.jsonへ偽の独立承認を追加しない。

先行6件とのマージ後、利用者の追加許可No7/13/21も同経路へ追加した。利用者指定は計6件で、No21は歴史IDの旧敷地代表点に限定する。旧判断・旧値provenance・歴史manifestは保持する。[統合記録](verification/issue60-combined-adoption.md)と `data/national/issue60/remaining-index-combined.json` が今回の統合結果である。
