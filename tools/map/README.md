# 地図の固定範囲の生成

リポジトリルートで実行する。

```sh
python3 tools/map/generate.py /path/to/N03-20260101_GML.zip web/src/prefectures.ts
cd web
mise exec -- bun run format
```

原本は国土数値情報「行政区域データ」N03-20260101：
https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html
原本は引数で指定し、配信資産にコピーしない。生成物にZIPのSHA256を記録する。
2026-11-06に利用者指定の保存原本から生成。原本の取得日時はこの処理では不明。
JGD2011の経緯度を保持する。ブラウザー向けには県・区分の範囲と配置点だけを出力する。
出典：国土交通省「国土数値情報（行政区域データ）」を加工して作成。
利用条件は国土数値情報の公共データ利用規約に従う。

各ポリゴンの外接矩形の中心が生成スクリプトのWINDOWS内にあるものだけを採用し、
その外接矩形を結合する。北海道は北方領土側、東京は伊豆諸島と小笠原、
鹿児島は奄美以南、沖縄は宮古・八重山・大東諸島を除く。
他県はすべてのポリゴンを採用する。これは行政境界判定用の形状ではなく、
地図移動用の本土側固定範囲である。離島のピン自体は除外しない。

県の数字は外接矩形の中心。全国の区分の数字はAREA_BADGESで理由付きの位置を指定する。
地域IDは英字、県IDは県名（東京都等）、県コードは2桁文字列。
visibleBadgesはkind/id/name/badgeの配列、countPinsはprefs/areasの件数辞書を返す。
未知の県名は集計対象外。不明なタップ対象は全国へ戻す。
countsGeoJSONの引数はzoom、focus、countPinsの戻り値。

生成器の検査：
```sh
python3 -m unittest discover -s tools/map
```
