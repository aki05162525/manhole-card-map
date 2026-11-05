簡略背景の生成と制約

配信用成果物は public/background/japan.geojson と manifest.json。どちらも
Gitで追跡し、クリーンcheckoutは元ZIPなしでCを表示できる。Vite devでも同じ
/background/japan.geojson を使う。prepare.mjs は両buildに配置・事前圧縮する。
背景をSWのFILES、ready保証、cache version算出には追加しない。

再生成（リポジトリのweb/で実行）:
  mise exec -- bun install --frozen-lockfile
  mise exec -- node scripts/generate-background.mjs /path/to/N03-20260101_GML.zip

必要環境: mise.tomlのNode/Bun、unzip、約8GBのNode heapを許容するメモリ。
ZIPを一時ディレクトリへ展開し、終了時に削除する。元ZIPは変更しない。
成果物manifestにZIP SHA256、使用したarchive member、固定Mapshaper版、
コマンド、保護座標SHA256、成果物SHA256、容量を記録する。時刻は入れない。
ZIPは国土数値情報2026年1月1日の都道府県界版を用いる。

出典: 国土交通省 国土数値情報（行政区域データ）2026年版を加工
https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html
使用許諾: CC BY 4.0（上記データページ）。原典は同ページ記載の国土地理院
数値地図等。JGD2011の経緯度を保持し、別測地系への座標変換は行わない。
仕様確認: https://mapshaper.org/docs/reference.html
          https://mapshaper.org/docs/guides/simplification.html

手順は県別dissolve→explode→小島の選別→spherical Douglas-Peucker 800m
keep-shapes。全県を同一トポロジーで処理するため共通県境を別々には簡略化しない。
keep-shapesはmultipart全体で一つの島しか守らないため、先にexplodeする。
snap、clean、独自の形状簡略化は行わない。背景座標だけを出力時に小数6桁へ丸める。
丸め単体の各軸誤差は最大0.0000005度（緯度で約0.056m）であり、カード座標は丸めない。Mapshaper既定の交差修復
（除去した頂点の再導入）は有効。Leafletの追加簡略化もsmoothFactor:0で止める。

全小島を保護する試作はgzip 7,908,583 bytesだった。現成果物は面積1km²以上、
または保護座標の±0.02度とbounding boxが交差する島を残す。後者は海岸付近の
座標誤差も考慮した保守的な選別で、島上に厳密に入る座標だけを条件にしない。
保護座標は background/protected-pins.json に全pin（蓋・配布場所・参考位置）の
経緯度を重複除去し固定したもの。対応元pins.jsonのSHA256と更新日は
protected-pins-source.jsonを参照。生成時に現在のpublic/dataを暗黙参照しない。
カードの対象範囲を更新したらこのsnapshotも再作成して背景を再生成すること。
将来追加されるカードや座標不明カードの島は現snapshotでは保証しない。

800mは簡略化の閾値であり地図全体の測地精度やHausdorff誤差の保証ではない。
小島除去、穴の縮退、原典自体の誤差はこの数値に含まれない。全県名の保持、
各出力ringの閉鎖・最低頂点数・非零面積、出力精度、圧縮容量をテストする。
生成ログの変位統計は平均190.5817m、最大799.9188mである。
出力4382 Polygonは全て非空。出力座標を丸めたため、原典座標との完全一致は主張しない。
小数5桁では保護対象を含む極小地物3件がnullになったため不採用とし、小数6桁へ緩めた。
約0.1mの保護島を含むテストで、独自のring補正を使わずMapshaperの出力を検査する。
カード座標自体は変更しないが、簡略化後の海岸線の外側に見える場合はある。
県境と陸域の概形だけの概略図で、道路、経路案内、敷地・領域判断には使わない。
主要11地名のラベル位置は表示用の概略値で、施設座標ではない。

全国1段階。CとDのmaxZoomは8。日本の緯度20–46度でおおむね425–575m/px
となるため800m閾値との釣り合いを取り、それ以上の拡大はしない。
A/C/Dでピン操作を共有。上限ズームのclusterクリックは内部の全cardIdsを
重複除去してonSelectへ渡す。Dは背景なしの診断用とattributionに表示する。
描画時は座標を変えずに県単位のMultiPolygonへまとめ、47レイヤーにする。
Cのreadyはfetch、GeoJSON追加、Canvas初回_redrawの成功、2 animation frames
を待つ。Leaflet 1.9.4の非公開_redraw hookを限定利用しているため、Leaflet
更新時にはcanvas-ready.test.tsと実ブラウザ検証が必要。

容量はmanifest参照。圧縮300KBを検査上限とし、100KB目安より形状とカード所在小島を優先する。
地図とUIは統合し、合成データによる実ブラウザの操作・オフライン検査を行う。
性能の測定結果はweb/README.mdから参照する。Android実機の性能合格は未確認。Bの大きな素材を使う比較ビルドは、通常の簡略地図ビルドとは分離する。

保護座標snapshotを更新する場合、採用するpins.jsonから各pinの[lng,lat]を
そのまま抽出し、重複除去後に経度→緯度の数値昇順で並べ、JSON配列として
protected-pins.jsonへ保存する（丸めない）。protected-pins-source.jsonの
sourceSHA256は採用したpins.jsonの生bytes、updatedはそのupdated、countは
重複除去後の個数へ同時更新する。その後上記生成コマンドを再実行する。
