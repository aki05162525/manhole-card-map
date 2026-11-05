# Issue #22：座標の入力契約

2026-11-05に[Issue #22](https://github.com/aki05162525/manhole-card-map/issues/22)の修正を検証した。[Issue #18の記録](issue18-contracts.md)にあるPythonの緯度±90とGoの±85の不一致は、この修正で解消する。過去の記録の実行結果を更新結果へ読み替えない。

## 地理座標と画面表示の責務

| 入力・用途 | 契約 |
| --- | --- |
| Pythonの施設位置採用 | `lat`と`lng`の2項目、有限数値、緯度±90・経度±180。文字列・真偽値・nullは数値として扱わない |
| Goの施設台帳 | 同じ地理範囲。座標オブジェクトの片軸欠落・null軸・未知項目・不正な型を拒否。施設全体の位置未確定を表す座標オブジェクトの省略/nullは別扱い |
| 保存された蓋座標のGo生成 | 両軸があれば同じ地理範囲を検査し、不正値は生成エラー。片軸でも欠ければ従来どおり座標なし・未確認とする |
| 参考施設候補 | 地理範囲外は座標なし・未確認。参考ピンを含め、範囲外座標は出力しない |
| 施設・蓋のGoogle Mapsリンク | 地理範囲内の有限数値を使用する。座標を丸めたり、Mercatorの範囲へ押し込んだりしない。位置の確認状態等の判定は別途維持 |
| 保存viewportの復元 | 中心緯度±85という既存の保守的な復元範囲を維持。採用する地理座標の許容範囲や、Mercator限界そのものを表す値ではない |

採用可能な緯度±90と、平面地図上で正確に表示できる範囲は同一ではない。MapLibreのMercator投影には高緯度の表示制約があり、例えば緯度90の施設を正確に描画できる保証はしない。台帳・full・pin・Mapsへ渡す元座標は表示都合で変更しない。

蓋の画像OCRにある[cardimg.ParseCoord](../../internal/cardimg/cardimg.go)の北緯20〜46・東経122〜154という日本域の検査は、画像の誤読検出である。今回の一般的な地理座標検査と目的が異なるため変更しない。自治体形状の[geometry.go](../../internal/municipality/geometry.go)も既存の緯度±90・経度±180の有限数検査を維持する。

## 境界のRED/GREEN

[Goの回帰テスト](../../cmd/builddata/coordinate_contract_test.go)では、まず既存実装が緯度±85.01、±85.051129、±86、±90の8ケースを拒否して失敗することを確認した。修正後は以下の結果になった。[Pythonのテスト](../../tools/national/test_assemble.py)も同じ入力範囲を照合する。

| 緯度（正負両側） | 修正前のGo施設台帳 | 修正後のPython / Go施設 / Go蓋 |
| --- | --- | --- |
| 85 | 受理 | 受理、値を保持 |
| 85.01 | 拒否 | 受理、値を保持 |
| 85.051129 | 拒否 | 受理、値を保持 |
| 86 | 拒否 | 受理、値を保持 |
| 90 | 拒否 | 受理、値を保持 |
| 90.01 | 拒否 | 拒否 |

経度±180は受理、±180.01は拒否する。NaN・Infinity等の非有限値、文字列・真偽値・軸のnullは施設採用入力として拒否する。GoはJSONデコードと内部の数値検査をそれぞれ検証した。蓋は欠落時の未確認状態と、不正な数値がある場合の生成失敗を区別する。参考候補と直接のピン生成経路でも不正値を出さないことを確認した。

```sh
mise exec -- go test ./cmd/builddata -run 'Test(FacilityCoordinate|LidCoordinate|ReferenceCandidate)' -count=1
python3 -B -m unittest discover -s tools/national -p test_assemble.py -v
```

上記は成功（Pythonは14テスト）。全Pythonテスト `python3 -B -m unittest discover -s tools/national -v`（実行時88件）と `mise exec -- go test -count=1 ./...` も成功した。MapsのURL生成と保存viewportの境界は、[ui.test.ts](../../web/src/ui.test.ts)と[explorer-state.test.ts](../../web/src/explorer-state.test.ts)が別に検証する。URLの単体テストはGoogle Maps上での実到達や、高緯度の地図描画の保証ではない。

## 実台帳を変更しない前後照合

変更前後に同じmanifest、一覧原本、基準日を使い、一時ディレクトリへ生成した。手順は両方のコード状態で次を実行し、台帳と3ファイルをバイト比較する。`$work`には書き込み可能な一時ディレクトリを指定する。

```sh
python3 -B tools/national/assemble.py --out "$work/ledger.json"
mise exec -- go run ./cmd/builddata -places "$work/ledger.json" \
  -list data/raw/gkp-list-20261021.html -date 2026-10-21 \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05 -out "$work/generated"
```

実行時の台帳は前後で完全一致した。生成結果はカード1,313・施設1,735・関係1,825、蓋ピン1,309・施設ピン974で、以下もバイト一致した。これは当日の収録集合と基準日の記録であり、将来の最新件数ではない。

| ファイル | SHA-256（前後共通） |
| --- | --- |
| full.json | `d2934e149d7d04676017560c9d1689bd167e676afb1f62e713afca79a70cbeb5` |
| details.json | `e5515e1178c412a27c9f54e9c9a1411bd8f6f6d0944a13f0badf64b25011ccbb` |
| pins.json | `14fb25c8ec3d4214c44c7cfeea06beb6f5ee93fd4fa62f754e5d7f29bbc415c4` |

さらに一時台帳コピーの施設 `facility:chubu-east-03b8e873197013417a8a` の緯度だけを86へ変更して生成し、fullと施設ピンの両方が86を保持することを確認した。これは生成契約の試験であり、実位置の採用ではない。manifest・原本・原調査・公開生成物は変更していない。

未確認範囲は高緯度地点での実ブラウザー描画、Google Mapsの到達地点、実機の投影・操作性。これらを今回の台帳契約テストで確認済みとはしない。

## 親による統合検証

#24の分類テストを含むPython全89テストとGo全体が成功。フロントはlint・整形・型検査・Vitest138テスト・fixtureビルド・Chromium回帰テストが成功した。Maps/viewportの追加テストは既存契約の確認で、Goの不整合修正は上記RED→GREENで確認した。ブラウザー試験は合成データであり、高緯度の実描画・実機性能を確認したものではない。試験用4179サーバーは終了済み。
