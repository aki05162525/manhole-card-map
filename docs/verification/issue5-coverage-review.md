# Issue #5 coverage 独立レビュー

判定: 固定基準の誤集計は検出しなかった。ただし、不整合入力を正常扱いする P2 の指摘が2件ある。入力の組み違い・生成物の破損を監査で検出するには修正が必要。

レビュー対象: `tools/national/coverage.py`、`tools/national/test_coverage.py`、`docs/issue5-coverage.md`、`data/national/issue5/baseline-coverage.json`。Go の `cmd/builddata/ledger.go` と `cmd/builddata/main.go` を契約として照合した。地域担当の作業には触れていない。既存ファイルは変更せず、再現は `/tmp/issue5-coverage-review-eb3iqhc0` にコピーしたコード・入力とメモリ内コピーで実施した。子起動・branch・commit・push・PR操作なし。

## 指摘

### 1. [P2] 配布ピンの座標・状態が壊れていても「表示済み」と認定する

対象: `tools/national/coverage.py:95–104`。

`actual` は pin の ID と cardIds の集合だけを検査する。pin の lat/lng/status は読まないため、承認済み施設座標と全く違う場所のピンでも正常な表示として集計する。座標フィールドの欠落も検出できない。Go の `appendPlacePins` (`cmd/builddata/ledger.go:392–426`) は施設の承認済み座標をそのままコピーし、verified 関係からピンの状態を決める。

再現: 固定 full の最初の非参考 place ピン `facility:chubu-east-03b8e873197013417a8a` は、カード `18-202-B001`、座標 `(35.6635393733764, 136.072831998673)`、状態 active。一時コピーでその pin だけを `(0, 0)` / ended に変更して `audit` を実行すると例外なく成功し、summary は基準と完全に同じになる。施設と台帳の承認座標は変更していない。

影響: 地図上で誤った場所・状態に表示する生成物を、位置承認と表示確認が揃った結果として報告する。ID集合の一致だけではピンの位置を保証できない。

修正案: 対象 pin の座標の型・有限性を検査し、対応する confirmed place の lat/lng と一致させる。status も Go と同じ「全対象関係が同一ならその状態、それ以外は unknown」で照合する。pin の座標改変・欠落・状態不一致を拒否するテストを追加する。

### 2. [P2] 同じIDを持つ別版の台帳を渡しても配布確認・状態の不整合を検出しない

対象: `tools/national/coverage.py:74–78, 110–114`。

verified 関係について ledger の同一キーの存在は検査するが、その内容と full の review/status は照合しない。座標が同じまま配布状況だけ更新された台帳と古い full を組み合わせると、古い verified/active を正常に集計してしまう。入力SHA256の記録は組み違いの検出にならない。

再現: 固定 ledger の `00-101-A001` / `facility:kanto-south-c5f3c43a0c2bf2667f5d` の status を active から ended に変更し、full はそのままにすると監査成功・summary不変。同じ関係の `reviewUntil` だけを `2000-01-01` にする別ケースも監査成功・summary不変。Go の `relationStatus` と `applyPlaceLedger` (`cmd/builddata/ledger.go:140–175, 330–348`) では前者は ended、後者は基準日2026-11-05に needs-review/unknown となるため、この full はその ledger から生成されたものではない。

影響: 間違った入力ペアを使った最終監査で、終了済み・確認期限切れの関係を verified/active と数え、配布未確認の不足を過少報告する。既存の失効テストは full 側も正しく needs-review/unknown にしたケースだけなので検出できない。

修正案: full を台帳の古い状態で上書きせず、不整合として拒否する。`evaluatedAt` における validFrom/validTo、reviewUntil、および可能な sourceHash の整合を照合するか、生成工程で full と assembled ledger の暗号学的な対応情報を残して検証する。単純な `full.status == ledger.status` は upcoming/ended の日付判定や正当な失効を誤拒否するので不可。

## 再現手順

次は再現済み操作をまとめたコード。既存ファイルを変更せず、コードと固定入力を新しい一時ディレクトリへコピーして読み込む。各 `True` は、本来拒否したい不整合入力が基準と同じ集計で成功したことを示す。

```sh
python3 -B - <<'PYCODE'
import copy, json, pathlib, shutil, sys, tempfile
root = pathlib.Path.cwd()
tmp = pathlib.Path(tempfile.mkdtemp(prefix='issue5-coverage-review-'))
shutil.copy2(root / 'tools/national/coverage.py', tmp / 'coverage.py')
for name in ('full', 'ledger'):
    shutil.copy2(root / 'data/work/issue5-baseline' / (name + '.json'),
                 tmp / (name + '.json'))
sys.path.insert(0, str(tmp))
from coverage import audit
full = json.loads((tmp / 'full.json').read_text())
ledger = json.loads((tmp / 'ledger.json').read_text())
base = audit(full, ledger)['summary']
bad_full = copy.deepcopy(full)
pin = next(p for p in bad_full['pins']
           if p['kind'] == 'place' and not p['reference'])
pin.update(lat=0, lng=0, status='ended')
print('wrong pin accepted:', audit(bad_full, ledger)['summary'] == base)
for patch in ({'status': 'ended'}, {'reviewUntil': '2000-01-01'}):
    bad_ledger = copy.deepcopy(ledger)
    row = next(r for r in bad_ledger['relations']
               if r['cardId'] == '00-101-A001'
               and r['placeId'] == 'facility:kanto-south-c5f3c43a0c2bf2667f5d')
    row.update(patch)
    print('wrong ledger accepted:', patch,
          audit(full, bad_ledger)['summary'] == base)
print(tmp)
PYCODE
```

## 合格した検査と範囲

- `python3 -B -m unittest discover -s tools/national -v`: 24件成功（coverage 12件、assemble 12件）。
- 一時コピーのCLIを2回実行し出力bytesが一致。保存済み `baseline-coverage.json` ともbytesが一致。
- 固定 full の全1,313カード・1,735施設・unique 1,820関係のID集合と監査出力の集合が完全一致。raw 1,825行、重複余剰5行。異なるreview/statusを持つ重複の拒否も既存テストで確認。
- 固定入力を独立に走査し、ledger の日付・期限・sourceHashから得る関係状態と full の状態・review の不一致はゼロ。全1,313カードに reviewSourceHash があり、この入力では照合可能だった。
- 基準の各非参考 place ピンについて、施設座標との一致、verified 関係から得る状態、重複なし・ソート済み cardIds を独立に検査してすべて成功。指摘1は現存基準の破損を意味しない。
- 配布ピン739施設・650カード、全施設表示527・部分表示123・未表示663カード。activeかつ位置・配布確認済み577カード・661施設。文書の数値と一致。
- unknown はunique 174組、うちverified 24組。upcoming はunique/verifiedとも3組。追加の一時合成ケースでも、位置ありverified upcomingは表示されるがactiveには数えず、理由は distribution_upcoming になる実装を確認。
- 複数施設カード、関係ゼロ、候補座標、未承認座標、無効座標、未検証関係、期限切れ相当のfull、追加proposal、地域横断施設について既存テストとコードを照合。未確認の配布・座標を勝手に確認済みに昇格する処理はない。
- 地域のカード集合は排他的・全件。08–11北関東、00/12–14南関東の修正を確認。未位置ledger施設数は順に162/116/75/86/52/192/84/80で文書と一致。施設の複数地域所属による重複は意図どおり。

固定入力SHA256:

- full: `b37be905cf426f098947fe567a74b849b6a2b2ac080b7e30c1885af838a3b150`
- ledger: `bb1a61b437a16582d5a6323614da26f88e6a193cb2973b20af8cd0665e7f671b`

## 文書とコードの照合・限界

読んだ対象文書と既存コードの間に、直接の仕様矛盾は見つからなかった。文書はピンの「cardIds」の一致検査を明記し、full生成に用いた台帳とのペアを利用者の前提としている。このため上記2件は文書に反した実装というより、独立監査としての検出範囲の不足である。文書上も「ピンの座標・状態は未検査」「同一生成ペアは認証しない」と明示すると保証範囲が明確になるが、実害を防ぐには検査の追加が望ましい。

`sourceCardStatus` は入力 full.cards[].status の転記であり、Goが台帳適用後に更新したカード状態を含む。原典HTMLの状態そのものではない。文書もカード全体のstatusを保存するとしており、処理上の矛盾ではないがフィールド名の読み違いに注意。

原典一覧からfullまでの抽出網羅性、施設同一性、証拠の公式性・本文の正確性は今回の監査入力だけでは保証できず、文書でも対象外。証拠の再取得・地図調査・Go生成の再実行は行っていない。保存済み基準の回帰テストは件数と一部整合だけであり、CLI全体の再生成一致は今回別途確認した。
