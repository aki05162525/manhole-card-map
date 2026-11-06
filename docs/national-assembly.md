# レビュー済み全国台帳のオフライン統合

`tools/national/assemble.py` はPython 3.9以降の標準ライブラリだけを使う。ネットワーク、全国raw原本、`data/work`内の入力コピー・手動合成台帳は不要。元台帳・パッチ・位置追補・証拠を変更せず、PlaceLedger schema 1を出力する。

取得・候補生成・独立レビューは[データ保守手順](data-maintenance.md)を参照する。

リポジトリrootから実行する。

```sh
work=$(mktemp -d)
python3 -B tools/national/assemble.py \
  --out "$work/national-assembled.json" \
  --audit-out "$work/national-assembly-audit.json"
```

`--out`を省略すると標準出力。親ディレクトリは既存のものを指定する。入力検査が失敗すると非ゼロ終了し、台帳出力に進まない。`data/work`を除く`data`配下への出力は拒否する。`--root`でリポジトリroot、`--manifest`でroot相対の選択manifestを指定できる。

## 適用順序と承認範囲

`tools/national/manifest.json`が入力を明示する。globやディレクトリの自動走査はしない。

元台帳・地域・提案を読み、メモリ上のコピーにexactパッチを適用し、同一行を重複排除して証拠を検査する。統合後に承認済み位置を追補し、最後に[位置ライフサイクル](location-lifecycle.md)を適用する。入力の整合性違反はビルドを停止する。

## 再生成と監査

Goの実生成に必要な一覧・照合入力とコマンドは [web/README.md](../web/README.md) にまとめる。採用件数はmanifestの行数だけでなくassembleの監査から取得する。生成ピン数・未位置施設数・配布関係の確認数は別の集合で、基準日を添える。

位置のscopeは配信上の精度区分ではない。有限数値の緯度±90・経度±180をPythonとGoで検査し、表示viewportの±85制限とは分ける。位置ライフサイクルで保留・撤回された座標は配信から除く。

利用者指定の限定例外は `manual_user_approval.py` がID・指定値・旧行・証拠hashを検査する。独立承認や利用条件検証済みとは扱わず、通常承認と残件集計を区別する。

現行監査は [監査・出典確認・位置優先順位](audits.md)を参照する。過去の件数と検証結果はPR・CI・Git履歴に残す。
