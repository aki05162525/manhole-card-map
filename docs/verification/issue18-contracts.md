# Issue18：位置採用の文書と実装の照合

2026-11-05、PR #21を含む `85b0777d` を基準に確認した。文書だけを変更し、位置採用・manifest・アプリの挙動は変更していない。以下の件数はこの確認時点の値で、将来の現在値ではない。

## 採用・配布関係・精度

- **公式案内の数値だけを使うという説明**：現行運用はP05・PLATEAU等も採用している。公式案内による現施設と建物の同定、座標との対応、取得元の条件を分けて確認する表現へ修正した。建物代表点で十分であり、近い別棟・旧施設の点は代用しない。[配布設計](../distribution-design.md)と[Issue16試行](issue16-pilot.md)を参照。Issue16の保留26施設を、この文書修正で採用に変更しない。
- **移転の登録と専用種別の区別**：[Goの配布関係検査](../../cmd/builddata/ledger.go)は、原抽出にない関係に `change.kind=addition` を要求する。新設窓口も移転先もこの追加として表現できるが、移転専用のkindや旧関係の自動終了はない。一方、位置ライフサイクルの `reasonType=relocation` は位置訂正の理由であり、カード配布関係の移転専用モデルではない。
- **同一カード・施設の複数行**：承認台帳は同じcardId/placeIdの異なる内容を拒否する。原文から生成したfullには期間別関係や完全一致の関係行が存在する。このため、台帳の「一組につき一関係」を生成full全体の一意性契約にはしていない。[全国監査](../national-audit.md)はこの違いを扱う。
- **scopeとconfirmed**：[Pythonのapply_locations](../../tools/national/assemble.py)はcoordinate/evidenceを台帳へ反映し、scopeを配信フィールドとして保存しない。原追補・明示binding内の採用履歴には残る。[Go](../../cmd/builddata/ledger.go)は、検証後に座標が残る台帳施設をconfirmedとする。測量精度・現地確認・在庫の保証ではない。精度区分を配信へ構造化する機能は未実装。
- **位置の訂正・撤回**：#17のopt-in位置ライフサイクルは実装済み。[manifest](../../tools/national/manifest.json)の今回のlocationLifecycle選択は0件で、全国既存位置への移行は行っていない。旧座標・判断履歴を保存して、管理対象のidentity変更/withdrawにより現座標を出力しない。未管理位置の制約を[手順](../location-lifecycle.md)に残す。

## 再現手順と履歴記録

- 配布設計の単独 `go run ./cmd/builddata` は、[CLI既定値](../../cmd/builddata/main.go)では `data/overrides/places.json` のみを使い、全国manifestを読まない。文書の再現例をassemble→`-places`指定へ修正し、元一覧取得日・確認一覧・評価日を明示した。
- Issue7監査の実行例を `python3 -B` に揃えた。`summary`は全国の全欠落数ではなく、固定810施設の集計である。位置ライフサイクルはこのCLIで適用しないため、manifest選択数と履歴適用後の有効位置を区別する説明を追加した。
- 全国統合手順にあった未追跡/stage・commitの説明は、PR #21で既に現在の手順から除去済み。今回もmanifestが選択する入力・証拠の追跡状況を確認し、当時の記録を現在の前提にしないことを明記した。
- [CI](../../.github/workflows/ci.yml)は全PRで一律にアプリ全体を実行する形ではなく、変更範囲から検証を選ぶ。backendは `go test -count=1 ./...` であり、旧文書の `go test ./...` と差があった。フロントの型検査はfixture buildに含まれる。

## 緯度範囲の差

範囲の用途を分けて現コードを確認した。

- [assemble.coordinate](../../tools/national/assemble.py)：施設座標の緯度±90、経度±180、有限数値のみ。
- [Go applyPlaceLedger](../../cmd/builddata/ledger.go)：施設座標の緯度±85、経度±180。Pythonの受理範囲より狭い。
- [UI confirmedQuery](../../web/src/ui.ts)：Mapsへ渡す緯度±90、経度±180。施設と蓋のリンクで共有する。
- [保存viewportの復元](../../web/src/explorer-state.ts)：緯度±85。施設データ自体の採否とは別の制約。
- ローカルにインストールされたmaplibre-gl 6.15.0の `src/util/util.ts` は、Mercator用の `MAX_VALID_LATITUDE=85.051129` を定義する。アプリの±85と同じ値ではない。Goの±85について、採用理由を説明するコメントは見つからなかった。Mercatorのためと断定して差を正当化しない。

### 実行した境界確認

`assemble.coordinate`を85、85.01、86、90、90.01で呼び、85〜90は受理、90.01は拒否された。`facilityMapLink`も85〜90では確定座標リンクを返し、90.01では施設名・住所検索へ切り替わった。これはURL生成関数の実行であり、Google Maps上の到達地点の検証ではない。

manifestから生成した台帳を `/tmp` へコピーし、座標がある最初の施設だけ緯度86に変更した。通常台帳での実Go生成は成功し、変更台帳では `invalid facility coordinate` で失敗した。入力ファイルの原本やmanifestは変更していない。

この確認時の台帳座標974件の緯度は24.801628219662〜45.187041で、±85の境界差が現在の採用位置を落としてはいない。ただし、Pythonの承認入力検査を通過して後段のGoで失敗する契約差は残る。文書だけで解消扱いにしない。

### 後続で決めること

施設座標のPython/Go入力範囲をそろえ、地理座標の妥当性と表示viewport制約を分ける修正を、[後続Issue #22](https://github.com/aki05162525/manhole-card-map/issues/22)へ切り出した。範囲差は未修正。対象は施設座標の入力契約であり、蓋リンク・viewportまで無条件で同じ範囲へ変更する案ではない。

受入条件案：

- ±85、±85.01、±85.051129、±86、±90、±90.01の境界でPython/Goの施設採否を照合する。
- NaN/Infinity、文字列、bool、片側欠落は従来どおり拒否する。
- 有効範囲の判断を先に記録し、失敗するテストから修正する。座標の丸め・切り詰めで矛盾を隠さない。
- 施設、蓋、Maps、viewportそれぞれの責務を文書化する。
- 現行台帳の座標・ピン数を変更せず、PythonとGoの必要テストを実行する。

## 参考ピンの文言

[標準UIのvisiblePins](../../web/src/explorer-state.ts)はreferenceピンを常に除外する。一方、[SourceNotes](../../web/src/app.tsx)には参考位置の注意文が残る。生成CLIの `-reference-places` は比較用の既存機能であり、標準UIに概略点を導入したことにはならない。この文言の整理は[#3](https://github.com/aki05162525/manhole-card-map/issues/3)へ引き継ぎ済みで、Issue18ではUIを変更しない。

## 検証した範囲

- manifestからの台帳再構築、Issue7監査CLI、保存HTML同士のlistdiff、文書で使う入力パス・相対リンクの確認。
- 全件素材を使った通常台帳のGo生成。2026-10-21取得一覧、2026-11-05確認一覧・評価日で、1,313カード、1,735施設、1,825関係、施設pin974、蓋pin1,309を出力した。
- 上記のPython/UI緯度境界呼出しと、Goの緯度86拒否。

親の統合検証でPython全80テストと `go test -count=1 ./...` は成功した。フロントエンドのテスト・ブラウザー操作・サーバー起動・現地検証は実施していない。全国整備や個別候補の採用を完了したという報告ではない。
