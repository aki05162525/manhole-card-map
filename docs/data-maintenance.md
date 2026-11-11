# 原本の取得と位置候補の保守

新しい調査は、取得 → 候補生成 → 独立レビュー → 台帳の表に採用の行を足して検査、の順に進める。取得、観察、候補、採用は別の判断で、候補は採用ではない。新規実行コードは `tools/` に置く。

## 原本の置き場

取得した原本は Git に入れない。Git 管理外の `data/work/originals/<作業名>/` に置き、採用とレビューが済んだら、記録（出典 URL・取得日時・sha256・確認日・確認主体・確認方法）だけを台帳の表 `evidence` に入れる（[根拠を足す](database-design.md#根拠を足す)）。原本の場所は表に書かない。原本はその後持たなくてよい。要るときは URL から取り直し、表の sha256 と照合する。

- レビュー担当には、原本を置いた作業ツリーのパスを渡し、同じ場所を読んでもらう。別の環境のレビュー担当は、取得記録の URL から取り直して sha256 を照合する。一致しなければ、その差もレビューで扱う。
- Git に残すのは2種類だけ。取り直せない利用者の回答・承認の原文と受領の記録は `data/user-answers/<Issue など>/` に置く。回答の文は表（`user_answer`）にも入れる。法的表示に必要な利用条件・ライセンスの写しは `data/terms/` に置く。同じ内容（sha256）は1つにまとめる。この2つの置き場へ足すときは、置く理由（取り直せない利用者の記録か、利用条件の写しか）を PR に書き、レビューで確かめる。
- 一覧原本 `data/raw/gkp-list-YYYYMMDD.html` は生成の入力なので Git に置く（[配布場所設計](distribution-design.md)）。
- `data/` への実行コードと原本らしいファイルの追加は、`tools/ci/data_policy.py` がフックと CI で止める。`tools/national/acquisition.py fetch` も、`--storage` が `data/work/` の外の `data/` を指すと止まる。
- 試験が読む原本は、試験の隣の `testdata/` に置く（例：`tools/national/testdata/`）。

## 取得と候補生成

リポジトリrootから実行し、出力は一時ディレクトリに置く。取得の例は実サイトを使わず、試験用の原本をローカルHTTPで配る。先に稼働プロセス・ポートを確認し、空いているポートを指定する。

```sh
work=$(mktemp -d)
mkdir -p "$work/http/xyz/optimal_bvmap-v1/16/58043"
cp tools/national/testdata/58043-26045.pbf \
  "$work/http/xyz/optimal_bvmap-v1/16/58043/26045.pbf"
python3 -m http.server 18765 --bind 127.0.0.1 --directory "$work/http" >"$work/http.log" 2>&1 &
http_pid=$!
trap 'kill "$http_pid"; wait "$http_pid" 2>/dev/null' EXIT
# HTTP受付開始を待つ（外部サイトには接続しない）。
python3 - <<'PYWAIT'
import socket, time
for attempt in range(100):
    try:
        with socket.create_connection(('127.0.0.1', 18765), timeout=0.1):
            break
    except OSError:
        time.sleep(0.05)
else:
    raise SystemExit('local HTTP server did not start')
PYWAIT
python3 -B tools/national/acquisition.py fetch http://127.0.0.1:18765/xyz/optimal_bvmap-v1/16/58043/26045.pbf \
  --storage "$work/storage" --version local-example --out "$work/fetched.json"
python3 -B tools/national/acquisition.py verify "$work/fetched.json" --storage "$work/storage"
kill "$http_pid"
wait "$http_pid" 2>/dev/null || true
trap - EXIT
```

実調査ではURLと版を対象資料に合わせ、`--storage` に `data/work/originals/<作業名>` を指定する。取得記録は相対原本参照、hash、bytes、取得時刻を保持する。キャッシュ再利用は新しい取得確認ではない。失敗記録の検証成功も取得成功を意味しない。

採用する根拠の行には取得記録の `sha256` を `snapshot_sha256` に、`fetchedAt` を `fetched_at` に写す。`cached` の記録の `fetchedAt` は最初に取得した時刻なので、そのまま写す。再利用の時刻 `reusedAt` は写さない。

続けて取得記録から候補を作る。PBF復号だけに使う研究用の任意依存と推移依存は `tools/national/requirements-research.txt` に固定する。ほかのツールは標準ライブラリのみで動く。

```sh
python3 -B - "$work" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
record = json.loads((root / 'fetched.json').read_text())
config = dict(facilityId='facility:example',
    source=dict(record='fetched.json', storage='storage', sha256=record['sha256']),
    tile=dict(z=16, x=58043, y=26045), layer='BldA', featureIndex=17, method='centroid')
(root / 'config.json').write_text(json.dumps(config))
PY
uv run --no-project --with-requirements tools/national/requirements-research.txt python -B tools/national/candidate_pipeline.py \
  "$work/config.json" --out "$work/candidate.json"
```

`source.record` は `fetch --out` の記録、`source.storage` は `fetch --storage` の保存先を指す。記録の `rawPath` はstorage基準で、`cached` の記録も同じ形で使える。

configの参照はconfig所在ディレクトリからの相対パス。`featureIndex` は0始まり。BldA以外の資料や未対応の形状・処理は人とAIで調査する。

生成処理はタイル番号と原本URL末尾を照合し、タイル境界に触れる建物を拒否する。隣接タイルの結合には対応しない。敷地の同定、道路・線路・川との関係、利用条件は機械判定しない。50m程度という採用基準は人とAIのレビューで確認し、自動採用しない。

## 独立レビューと明示採用

採用の基準と、独立レビューで確かめる点は [AGENTS.md](../AGENTS.md) の「データを変更するとき」にある。独立レビューではそれに加えて利用条件も確かめる。確認した主体・日付・根拠を残し、レビュー済みの対象だけを台帳の表に採用の行として足す（[位置を採用する](database-design.md#位置を採用する)）。候補を一括で取り込まず、採用範囲と根拠を行ファイルの差分と PR で追跡するためである。

候補の観察記録（`research_common.py` の `new_observation` が作る形）では、施設単位で確認でき、棟の特定だけが残る場合は `buildingIdentity.status = site_confirmed` を使う。棟を特定しなくてよい条件（AGENTS.md）を満たすことを証拠に残す。`buildingIdentity.evidence` を必須とし、`surroundings.status = confirmed` とその証拠、`positionSuitability.buildingAssessment` に残る不確かさを記述する。承認には従来どおり利用条件の確認、機械検査の成功、CRSの評価、`positionSuitability.status = acceptable` が必要。`not_checked` のまま承認したり、未特定の棟を `confirmed` と記録したりしない。

旧取得記録、既存の採用行、`scope` なしの行などを一括で書き換えない。指紋と来歴が変わるため、訂正は対象と理由を限定し、次の判断の行を足して旧値と根拠を追跡できる形で行う（[位置の判断を足す](database-design.md#位置の判断を足す)）。

## テスト環境

フックの環境には `GIT_DIR` が入る。テストで `git init` や `git -C` を呼ぶときは、`os.environ` から名前が `GIT_` で始まる変数をすべて除いた環境をsubprocessへ渡す。引き継ぐと、本体リポジトリの `core.bare` が書き換わるおそれがある。

## カード番号の訂正と追加

`data/card-ids.json` の `ids` は公開済み番号の履歴で、削除しない。番号を訂正するときは旧番号を残し、`aliases` に旧番号から現行番号への対応を加える。台帳から外すときは `excluded` に番号と理由を加える。除外済み番号と alias の旧番号は再利用しない。alias の連鎖は認めないため、訂正先が再び変わったら過去の旧番号も最新の番号へ直接向ける。

新しい番号は、リポジトリrootで `python3 -B tools/build-real-data.py --update-card-ids` を実行して履歴へ追加する。通常の生成と同じ入力・基準日を使い、消失・不正な alias・再利用があれば更新せず失敗する。新番号以外の履歴や対応は自動変更しない。`data/card-ids.json` を更新したら、`python3 -B tools/db/ledgerdb.py import-card-ids` で台帳の表に写す。差分をレビューし、番号訂正や除外の根拠とともにコミットする。

通常の `cmd/builddata` と CI の生成テストは、履歴にない新番号、説明のない消失、生成結果にない alias 先、alias の連鎖・循環、除外済み番号と旧番号の再利用を拒否する。公開 `full.json`・`details.json` の `cardAliases` に対応表を出す。旧番号の記録は、フロントでは `web/src/domain/records.ts`、API では `web/worker/card-ids.ts` と `web/worker/records.ts` が現番号に読み替える。
