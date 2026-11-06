# レビュー済み全国台帳のオフライン統合

`tools/national/assemble.py` はPython 3.9以降の標準ライブラリだけを使う。ネットワーク、全国raw原本、`data/work`内の入力コピー・手動合成台帳は不要。元台帳・パッチ・位置追補・証拠を変更せず、新しいPlaceLedger schema 1を出力する。

リポジトリrootから実行する。

```sh
python3 -B tools/national/assemble.py \
  --out /tmp/national-assembled.json \
  --audit-out /tmp/national-assembly-audit.json
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

## 再生成と監査

Goの実生成に必要な一覧・照合入力とコマンドは [web/README.md](../web/README.md) にまとめる。採用件数はmanifestの行数だけでなくassembleの監査から取得する。生成ピン数・未位置施設数・配布関係の確認数は別の集合で、基準日を添える。

位置のscopeは配信上の精度区分ではない。有限数値の緯度±90・経度±180をPythonとGoで検査し、表示viewportの±85制限とは分ける。位置ライフサイクルで保留・撤回された座標は配信から除く。

利用者指定の限定例外は `manual_user_approval.py` がID・指定値・旧行・証拠hashを検査する。独立承認や利用条件検証済みとは扱わず、通常承認と残件集計を区別する。

現行監査は [national-audit.md](national-audit.md)、[出典確認](source-inventory.md)、[位置優先順位](location-priorities.md)を参照する。過去の件数と検証結果はPR・CI・Git履歴に残す。
