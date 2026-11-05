# Issue #5 PR前・最終独立レビュー

判定：今回の統合を止める P0/P1/P2 は検出しなかった。先行coverageレビューのP2二件は修正済みで、固定入力の改変による再現でも拒否を確認した。文書の現行件数表記に軽微な残件がある。

対象ブランチ：`feat/issue-5-distribution-locations`。2026-11-05時点の作業ツリーを対象とする。既存コード・データは変更せず、本報告のみ新規作成。子起動、branch作成、commit、push、PR操作、Web再調査はしていない。

## 独立確認した統合差分

manifestから `assemble.assemble` を再実行した結果は `/tmp/issue5-final-ledger.json` と全フィールド一致。固定 `data/work/issue5-baseline/ledger.json` と施設ID、cardId/placeIdで突合し、追加・削除IDはゼロ、施設1,586・関係1,670を維持した。

- coordinate追加37、evidence変更37。既存座標の変更なし。
- name変更3：宇美町役場 本館 警備室、宇美町役場 南館 上下水道課、千歳市水道局庁舎2F総務課総務係窓口。
- 関係変更は `41-210-A001` / `facility:kyushu-fec63a8962497abb940f` のhoursとconditionのみ。神埼の公式情報間の休館日不一致と訪問前確認を明示し、activeを維持。
- その他のフィールド差分なし。施設の名称変更で既存ID・座標・配布状態を変えていない。

各地域レビューの coordinateDecision=accepted（同項目がない中部はdecision=accepted）のID集合と、manifestのIssue5選択集合を機械照合し、完全一致した。北関東4、南関東9、近畿4、西南6、北10、中部3、横浜1の計37件。baselineから座標が追加された集合とも完全一致。中部deferred 5件や旧北海道の保留点など、今回の未採用候補の混入はない。

manifestの固定hash検証を含むassembleを通過し、採用Evidenceの保存原本hashも検証された。北関東はfetchedAtを除いた専用コピーを選択。近畿は寝屋川のsourceLocatorだけをレビューexact訂正し、他3行は原候補と同一。中部採用3行は各3項目の説明訂正と小矢部の移転説明訂正、計10個の該当exact訂正がすべて一致。北はP05由来8行のverificationMethodのみ追補、他2行は同一。北の追補はレビューの出典・加工・JGD2011説明を保持し、親が整理した個別CC BY 4.0／一般PDL1.0併記を採用している。この明示された調整を未レビュー座標の追加とは扱わない。

## 再生成・監査

Python 26テスト成功。追加でメモリ内の独立入力コピーを使い、reviewUntil/validFrom/validToの当日境界3件、将来開始・終了後の有効状態2件、sourceHash一致・不一致2件、共有施設のactive/suspended混在1件、期限切れ／原典変更による正当なneeds-review 2件の計10ケースを確認した。過剰拒否を検出しなかった。

`/tmp/issue5-final-review-16tdz9_7` に監査コード・テストfixture・最終台帳をコピーし、Go builddataを別出力先で実行した。生成full.jsonは `web/public/data/full.json` とbytes一致し、publicとdistのfull.jsonもbytes一致。1313 cards、1735 places、1825 raw relations、776 place pins。横浜 `14-100-A001` の配布ピンは `facility:kanto-south-4ecb948da292cb16373b`、active、非参考、35.4666121 / 139.6223259。MapsリンクのUI実行は今回再実施していない。

baselineとfinalのcoverageを再計算し、それぞれ保存済み監査JSONと全出力フィールド一致（CLIが付けるinputSHA256は別途照合）。最終監査の入力hashは実ファイルと一致。

先行P2の固定baseline再現を現コードへ適用した結果：

- pinを(0,0)/endedへ変更 → `place pin coordinate mismatch`。
- `00-101-A001` / `facility:kanto-south-c5f3c43a0c2bf2667f5d` の台帳statusをendedへ変更 → `verified relation status differs from ledger`。
- 同じ関係のreviewUntilを2000-01-01へ変更 → `verified relation exceeds ledger reviewUntil`。
- 同じ関係のsourceHashをゼロ64桁へ変更 → `verified relation source differs from ledger`。

既存テストはpinの座標欠落・null・bool・状態だけの破損も拒否する。Go `relationStatus` と `appendPlacePins` の契約を読んで照合した。監査はfull側を台帳の状態で上書きせず、不整合入力を拒否する。reviewSourceHashがない入力の照合省略、hours/condition等すべての生成フィールドの版一致を認証しない制約は残るが、統合記録にも明記されており、今回の生成結果はGo再生成のbytes一致で補完した。

再現コマンド（既存出力への書込みなし）：

```sh
python3 -B -m unittest discover -s tools/national -v
python3 -B - <<'PYCODE'
import json, pathlib, shutil, subprocess, sys, tempfile
root = pathlib.Path.cwd()
tmp = pathlib.Path(tempfile.mkdtemp(prefix='issue5-final-recheck-'))
shutil.copy2(root/'tools/national/coverage.py', tmp/'coverage.py')
sys.path.insert(0, str(tmp))
sys.path.append(str(root/'tools/national'))
import assemble
from coverage import audit
ledger, _ = assemble.assemble(root, json.loads((root/'tools/national/manifest.json').read_text()))
assert ledger == json.loads(pathlib.Path('/tmp/issue5-final-ledger.json').read_text())
(tmp/'ledger.json').write_text(json.dumps(ledger, ensure_ascii=False))
subprocess.run(['go', 'run', './cmd/builddata', '-places', str(tmp/'ledger.json'),
 '-review-list', 'data/evidence/national/list-source/gkp-20261105.html',
 '-as-of', '2026-11-05', '-out', str(tmp/'generated')], check=True)
assert (tmp/'generated/full.json').read_bytes() == (root/'web/public/data/full.json').read_bytes()
full = json.loads((tmp/'generated/full.json').read_text())
saved = json.loads((root/'data/national/issue5/final-coverage.json').read_text())
assert audit(full, ledger) == {k:v for k,v in saved.items() if k != 'inputSHA256'}
print(tmp)
PYCODE
```

SHA256：

- 固定baseline ledger bytes: `bb1a61b437a16582d5a6323614da26f88e6a193cb2973b20af8cd0665e7f671b`
- 最終ledger bytes: `a0e3fe82a4996e1041cb5434b7a24e90408a8c55c1f3f1d7e36e0e5e56b2c6c8`
- 最終ledger正規化JSON: `38d0451c51fc2f3fcf74f3d73fb42ba28e71a18927bdbb5253e532528e6f91f6`
- public/dist/独立Go再生成full bytes: `c12ff18fa3bae89bfd04875d2e0656e90fe65fc24780a4882263432769ace130`

## 文書・コード・データの相違

新規の軽微な文書残件：`docs/national-assembly.md` の「見つかった記述の差」に「現在は…7ファイル98操作」が残っている。現manifestとテストは9ファイル103操作で、同文書上部の表も9/103。7/98はIssue5追加前の時点と明示するのが正確。再現は `len(manifest['patches'])` と選択indexes長の合計で9/103を確認できる。

同文書の「親の手動基準 data/work/national-assembled-reviewed-itg.json との一度限りの比較」の直後にあるdigestは、現在の最終Issue5出力のdigestへ更新されている。今回照合した固定基準はIssue5 baselineとfinalであり、その旧手動基準ファイルとの一致は再認証していない。歴史的比較の説明と現在の回帰digestの由来は区別して読む必要がある。

以下は既存レビュー／統合記録に残る相違の全件を整理したもの。保存原本・旧生成スクリプトの書換えを要求する指摘ではない。現在の採用経路はコードとmanifestを優先して確認した。

1. 北関東候補と西南訂正案のfetchedAtはGo Evidence非対応。元READMEの不一致なしという説明とは異なるが、統合用コピーで除去済み。
2. 地域割当の埼玉／00の旧区分と調査割当が異なった。現coverageは08–11北関東、00/12–14南関東。
3. 南関東README／validationのCRS検証説明に対して元validate.pyはCRSをassertしない。独立地域レビューで補完済み。P05六件の追補待ち表現も現採用行の追補済み状態と異なる。
4. 近畿READMEのsuspended維持と元build.pyが再生成する寝屋川の「終了状態・旧配布施設」説明が矛盾。統合用コピーのsourceLocatorだけ訂正済み。
5. 北のP05説明は元build.py／READMEのCC BYだけの説明、独立レビューのPDL中心のexact案、親の個別CC BY／一般PDL留保併記で異なる。採用コピーは親整理後の説明。原本権利一般論の再調査は実施していない。
6. 旧北海道README／decide.pyは古いGISの利用条件・CRS未記録、登別第2庁舎／苫小牧北庁舎の棟未同定を一律の名称住所照合説明で覆っていた。今回その保留点は採用していない。釧路へ留萌の説明が混入する点も旧レビューに訂正案を保持。千歳の経営管理課／総務課の不一致は名称パッチで訂正。
7. 筑西の旧名前付きPOI説明は実URLの0x0:0x0と不一致。採用Evidenceは名前付きPOIではないことを明記。中部の旧住所feature／別庁舎／処理場全体点の説明は訂正案に残し、今回の採用3件と区別。
8. 中部の「住所ジオコードではない」という元説明はP05作成工程を否定するように読める。統合用コピーは本追補で行わない旨に限定。規約・カタログを施設同定資料とする方法説明も訂正済み。小矢部は新庁舎計画を説明に反映。
9. 神埼の二つの公式ページで休館日が異なる。hours/conditionで明示。宇美の旧名称は時刻混入・本館/南館区別不足があり名称を訂正。
10. 横浜市配置図にモアーズ名称ラベルはない。現Evidenceの配置・形状による同定説明を名称の直接表示と読まない。地域レビューでは任意の表現修正であり採否条件ではない。
11. 旧全国ドキュメントの「入力外なので新規関係登録不可」は現Goのchange.kind=addition対応と異なる。千葉timestampはGoの日付専用契約に合わせ出力正規化。旧fragmentsテストの直接mergeはexactパッチ先行手順と異なったが現assemblerで対応。初期の「7パッチ」と実6ファイル97操作の差は歴史的記録。
12. `issue5-coverage-review.md` の24テスト／検出漏れ記述は修正前の記録。現状は26テストでP2二件を拒否する。本報告はその再確認結果。

施設の同定原本・測量精度を全件新規調査したレビューではない。地域の独立採否と具体的訂正が統合結果へ正しく反映されるか、未採用候補・出典欠落の混入、生成物との整合を重点確認した。Go全テスト・Vitest・lint・format・frontend buildは依頼文の成功報告を再実行したとは扱わない。本レビューで再実行したのはPython26テスト、追加10ケース、assemble、Go builddata、coverage。実ブラウザー目視は未実施。
