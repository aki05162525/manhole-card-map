# 調査資料の取得と位置候補の保守

新しい調査は、取得 → 候補生成 → 独立レビュー → manifestで明示採用 → assembleで検査、の順に進める。取得、観察、候補、採用は別の判断で、候補は採用ではない。新規実行コードは `tools/` に置く。`tools/ci/data_policy.py` がフックとCIで `data/` への追加を拒否する。

## 取得と候補生成

リポジトリrootから実行し、出力は一時ディレクトリに置く。取得の例は実サイトを使わず、保存済み原本をローカルHTTPで配る。先に稼働プロセス・ポートを確認し、空いているポートを指定する。

```sh
work=$(mktemp -d)
mkdir -p "$work/http/xyz/optimal_bvmap-v1/16/58043"
cp data/evidence/national/shizuoka-site-tolerance3-20261106/original/58043-26045.pbf \
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

実調査ではURLと版を対象資料に合わせる。取得記録は相対原本参照、hash、bytes、取得時刻を保持する。キャッシュ再利用は新しい取得確認ではない。失敗記録の検証成功も取得成功を意味しない。

続けて取得記録から候補を作る。PBF復号だけに使う研究用の任意依存と推移依存は `tools/national/requirements-research.txt` に固定する。通常のツールと `assemble.py` は標準ライブラリのみで動く。

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

独立レビューでは敷地、点の置き場所、別施設との取り違え、利用条件と残る不確かさを確認する。確認した主体・日付・根拠を残し、レビュー済み対象だけを `tools/national/manifest.json` に明示する。自動走査による候補の混入を防ぎ、採用範囲と根拠を追跡するためである。採用後は[統合手順](national-assembly.md)の検査を通す。

施設単位で確認でき、棟の特定だけが残る場合は `buildingIdentity.status = site_confirmed` を使う。同一施設の敷地内で候補が約50mに収まり、線路や川などで隔てられていないことを証拠に残す。`buildingIdentity.evidence` を必須とし、`surroundings.status = confirmed` とその証拠、`positionSuitability.buildingAssessment` に残る不確かさを記述する。承認には従来どおり利用条件の確認、機械検査の成功、CRSの評価、`positionSuitability.status = acceptable` が必要。`not_checked` のまま承認したり、未特定の棟を `confirmed` と記録したりしない。

旧取得記録、既存の採用行、`scope` なしの行などを一括で書き換えない。hashと来歴が変わるため、訂正は対象と理由を限定し、旧値と根拠を追跡できる形で行う。

## 証拠の参照閉包と削除

```sh
python3 -B tools/national/evidence_graph.py --references --out "$work/graph.json"
python3 -B tools/national/assemble.py --out "$work/ledger.json" --audit-out "$work/assembly-audit.json"
python3 -B tools/national/national_audit.py --full "" --out "$work/national-audit.json"
```

graphはGit追跡対象の参照閉包と不整合を出力する。外部URL・過去状態の参照は追跡先として辿らない。

**unreachedは削除可を意味しない。** ディレクトリ参照や計算された入力も人が確認する。削除対象一覧を固定し、削除理由と残る根拠を記録する。assembleと監査を削除前後に別の一時ディレクトリへ出力して比較し、採用・表示への影響と参照閉包を確認する。削除は別PRにする。

## テスト環境

フックの環境には `GIT_DIR` が入る。テストで `git init` や `git -C` を呼ぶときは、`os.environ` から名前が `GIT_` で始まる変数をすべて除いた環境をsubprocessへ渡す。引き継ぐと、本体リポジトリの `core.bare` が書き換わるおそれがある。
