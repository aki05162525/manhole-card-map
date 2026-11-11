# データの出典

標準画面の背景は mapcn の CARTO 明色スタイル。地図上と [aboutページ](about.html) に © CARTO、© OpenStreetMap contributors を表示する。利用条件は [CARTO](https://carto.com/attributions) と [OpenStreetMap](https://www.openstreetmap.org/copyright) を参照する。`VITE_MAP_STYLE_URL` で背景を変更する場合は、その提供者の条件と出典を別途確認する。

カード情報・配布場所の座標・自治体照合のクレジットは `src/pages/about/about-page.tsx` で表示する。自治体などの出典一覧は `src/pages/about/about-credits.ts` の配列、加工主体の表記は同ファイルの `AUTHOR` を編集する。出典追加時は実データの `places[].coordinate.source` と採用根拠を確認し、使用するデータセット・提供者・URL・利用条件・加工主体を更新する。CC BYの版が指定されていなければ推測しない。

都道府県・区分の移動範囲と数字の配置、ズーム7未満の境界線は、国土交通省「国土数値情報（行政区域データ）」[N03-20260101](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html)を本サイトの開発者が加工して作成した。県間の共有線だけを抽出し、結合・簡略化・小数4桁への丸めを行う。区分境界はこの共有線と既存の9区分から決める。原本は配信しない。データ個別ページの利用許諾条件は CC BY 4.0。出典・加工表示は[公共データ利用規約](https://nlftp.mlit.go.jp/ksj/other/agreement.html)を参照する。生成手順・原本hashは `tools/map/README.md` を参照。共有時の画像（`public/og-image.png`）の陸地の形と県境も同じ原本を加工して描いている。
