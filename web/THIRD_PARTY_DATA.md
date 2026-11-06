# データの出典

標準画面の背景は mapcn の CARTO 明色スタイル。地図上と [aboutページ](about.html) に © CARTO、© OpenStreetMap contributors を表示する。利用条件は [CARTO](https://carto.com/attributions) と [OpenStreetMap](https://www.openstreetmap.org/copyright) を参照する。`VITE_MAP_STYLE_URL` で背景を変更する場合は、その提供者の条件と出典を別途確認する。

カード情報・配布場所の座標・自治体照合のクレジットは `src/about-page.tsx` で表示する。自治体などの出典一覧は `src/about-credits.ts` の配列、加工主体の表記は同ファイルの `AUTHOR` を編集する。出典追加時は実データの `places[].coordinate.source` と採用根拠を確認し、使用するデータセット・提供者・URL・利用条件・加工主体を更新する。CC BYの版が指定されていなければ推測しない。

`public/maps` の protomaps / PMTiles 関連素材はローカル試験用。Viteの本番ビルドは `publicDir: false` で、`scripts/prepare.mjs` もこれらをコピーしないため、実データ・fixtureの配信物には含まれない。開発サーバーでは `public` が公開される。

ローカル素材を使う場合は、その素材が含むレイヤーに応じて [protomaps/basemaps](https://github.com/protomaps/basemaps) の出典・条件を確認する。OSM由来の地物と [osmdata.openstreetmap.de](https://osmdata.openstreetmap.de/) の水域・陸域はODbL、[Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)はパブリックドメイン。Daylight Landcoverを含む場合は [ESA WorldCover](https://esa-worldcover.org/en/data-access) のCC BY 4.0、地形等のMapzen由来素材を含む場合は [Mapzenの出典](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) も確認する。これらを標準背景の出典として扱わない。
