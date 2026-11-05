# 第2弾・東海の位置調査（Issue39）

2026-11-05、`f66b7e994ef250fadee78f396d22fdfc40ba6a83` の現manifestを統合し、東海35施設の未位置を確認した。8施設を選定し、新しい資料・比較方法を調査した。候補提出0、採用0、保留8。manifest・台帳・配布関係・binding・アプリコードの変更はない。

## 母集団と選定

[selection.json](../../data/national/location-batch2/tokai/selection.json) はIssue24の `originalRef` が `issue7/tokai.json` に属する全35IDを、第1弾baselineと現assembleへ照合した記録。全35IDがbaselineにあり、現manifestでの採用済み除外は0件だった。配布分類は保存済み2026-11-05評価のactive 34・suspended 1であり、今回の全施設Web再確認ではない。全国608は開始時の台帳内未位置集合で、生成全体の未位置数とは異なる。今回は採用を増やしていない。

別棟誤誘導の懸念がある熱海2窓口・関2窓口・カクキュー、新施設の中津川、初ピン候補の科学館・垂井案内所を選んだ。8施設すべてIssue24ではfirstPin候補カードを持つ。熱海と関は同じ資料を共同利用するが、施設IDや配布関係を統合しない。住所一致だけの同棟承認も行わない。

非選定27施設には各IDの既存理由と除外理由を保存した。第1弾静岡10施設はintegration/followupsの停止条件を維持し、新居・焼津の「CSV点が入る外形だから同棟」という依存を再採用しない。ふじおやまはIssue20のCRS・独立棟対応待ちを維持する。Issue25〜27の対象はこの35IDに含まれないため触れていない。残り16施設も調査完了や重要度なしとは扱わない。

## 8施設の結果

ID・一次資料のURL/取得hash/版/該当箇所・停止再開条件は[outcomes.json](../../data/national/location-batch2/tokai/outcomes.json)と[retrievals.json](../../data/evidence/location-batch2/tokai/retrievals.json)に対応付けた。

| 施設 | 新たに行った調査と結果 | 保留理由・次の資料 |
| --- | --- | --- |
| カクキュー八丁味噌の郷 | 運営者の見学施設ページを発見。ローカル原本取得は403 | 検索表示を取得済み原本と扱わない。カード配布棟を示す取得可能な配置図待ち |
| 熱海・第二庁舎料金センター | 2025-10-08更新の市庁舎案内と敷地図を取得。第二庁舎1階のセンターを確認。旧P05点を最新Vectorと比較 | 旧P05点はBldA外。模式図から外形への一対一対応未成立。方位・周辺道路と接続する配置図/GIS待ち |
| 熱海・第一庁舎警備員室 | 同敷地図で第一庁舎と消防庁舎の隣接・第二庁舎との区別を確認 | 第二庁舎と同じP05点を流用しない。第一庁舎部分の外形同定待ち |
| 関・北庁舎2階下水道課 | 再配置計画の2023年3月改訂版を取得。紙面39ページは本庁舎の維持更新方針。旧P05点をVectorと比較 | P05点は大きな一体外形内にあるが、北庁舎との対応は未成立。棟別の方位付き配置図待ち |
| 関・北庁舎1階守衛室 | 同じ新計画・Vectorを共同調査。旧配布案内の窓口区別を保持 | 同住所とcontainsだけで2窓口へ座標を共有しない。同棟根拠と外形を再審査 |
| 中津川・ひと・まちテラス | 2024-10-11報道資料の物理3ページを画像確認。イベント受付と常設総合案内を区別。2026-09-17更新フロア図で1階総合案内・周辺道路/商業施設/公園の配置を確認 | 独立した配置資料は得た。今回は当該建物の地理参照外形・数値原典を取得していない。次回は保存図と現建物のVector/PLATEAUを照合 |
| 愛知県下水道科学館 | 県の平面・敷地図PDF候補を発見。原本取得403、Web取得404 | 図面は未確認。取得可能な県/運営者資料と公開建物外形待ち |
| 垂井町観光案内所 | 町の総合戦略進捗報告・紙面16ページを確認。平成27年度リニューアル・28年度充実の履歴 | 現棟の外形・座標ではない。1812-10の案内所を区別する駅北口配置図/GIS待ち |

在庫切れを恒久終了へ変更した施設はない。窓口・住所のexact patchが必要と判断できる新根拠もなく、元調査を保持した。室内窓口・入口の測量不足を理由に保留したものではない。

## Vector・原本の扱い

[vector-inputs.json](../../data/evidence/location-batch2/tokai/vector-inputs.json) は2026-07-01版PMTilesの熱海/関タイルを指定する。P05点は既存調査からの探索ヒントで、採用候補ではない。JGD2011の国内データをWeb MercatorタイルXYへ投影してcontainsを検査し、WGS84変換や住所ジオコードはしていない。熱海は内包0、関はBldA index21内包。これは新たな棟同定を意味しない。重心・代表点の生成もしていないため、採用座標の丸め後内包検査は非該当。

出典：国土地理院最適化ベクトルタイル（[公式README](https://github.com/gsi-cyberjapan/optimal_bvmap)）。同タイルを加工し、manhole-card-mapの調査担当が建物外形比較を作成した。[利用条件記録](../../data/evidence/location-batch2/tokai/rights.json)のとおり、試験Vectorは基本測量成果と位置付けられておらず、国土地理院コンテンツ利用規約・PDL1.0の出典/加工表示条件を確認した。ラスタの条件から類推していない。

HTTP Range応答は要求長・206・同一ETagを検査し、タイル原bytesを必要範囲の証拠としてGitへ保存した。GSI規約は第1弾の保存原本を元の取得日・hashのまま参照し、今回のTLS互換性エラーを成功扱いにしない。Web本文でも条件を照合した。

一般HTML/PDF/写真は全文再配布条件未確認のため `data/work/location-batch2/tokai/` のみ。Gitには自作の事実抽出・取得URL・hashを保存した。検索索引の版日ではなく原本を優先し、関の資料は表紙の令和5年3月を採った。検索結果で見えた内容と、保存原本で確認できた内容を区別している。

## 検証と限界

```sh
mise exec -- python3 data/evidence/location-batch2/tokai/verify.py
mise exec -- python3 data/evidence/location-batch2/tokai/verify.py --with-work
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/tokai/compare.py
```

35IDの完全被覆・baseline所属・8IDの一意性・旧記録のJSON pointer・新原本hash・タイルhashとRange長・manifest不変・assemble出力全体不変を検証した。比較スクリプトの出力は保存した[vector-comparison.json](../../data/evidence/location-batch2/tokai/vector-comparison.json)と一致。`--with-work` は非配布原本がある調査環境で実行し、通常モードでも現manifestをassembleして開始時hashと照合する。

地域共有壁時計は選定保存から初回成果作成まで294.648秒。検索・取得・解析・待ち・記録を含み、選定前照合・その後の検証/独立レビュー/PR作成は含まない。8施設分として重複加算せず、全国所要時間へ外挿しない。最後のGSI README取得（11:29:55 UTC）は初回成果作成後の仕上げ確認で、計時対象外。

採用・アプリコード変更がないためGo生成/full/details/pins/Maps・UI検証は再実行していない。一方、既存pre-commitはdata配下の変更で全Goテストを要求するため、フックを省略せず `go test -count=1 ./...` を実行して成功した（cmd/builddataから全国Python unittestも実行）。現地確認、当日在庫、非配布原本のclean checkout再現、保留施設の数値座標は未確認。共有ファイル・履歴テストの変更はない。今回の範囲でドキュメントとコードの新しい不一致は見つからなかった。

## 独立レビュー

Gemini 4 Argonの独立レビューは重大指摘0件・任意改善2件で、研究のみのPRとして妥当と判定した。地域検証の再実行、Vector比較のbyte一致、原本/派生ファイルhash、旧停止条件、利用条件を独立確認。任意改善は両方反映し、派生6ファイルのhash検査を `verify.py --with-work` に加え、計時後の仕上げ取得を注記した。[レビューと対応記録](../../data/national/location-batch2/tokai/review.json)を参照。座標採用の承認ではない。

## Issue57での検証手順の訂正

当時の検証結果は上記のまま保持する。現在の `verify.py` は保存済みmanifestと当時の台帳hashで歴史基準を検査し、現manifestでは当該地域だけを除いた台帳との全フィールド・全関係差分を別に検査する。他地域の採用で当時の608件を更新しない。通常検査は全国Python試験にも含まれる。原本を検査するオプションには別途ignored workの原本が必要。今回の対象試験・未確認範囲は[Issue57の記録](issue57-workflow.md)を参照する。
