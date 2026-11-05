# 位置調査第2弾・近畿西（Issue42）

2026-11-05、基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83`。選定8施設の初回調査は採用0・保留8だったが、Opusの指摘を受けて稲美・柏原のGSI外形を実際に取得・照合した。現在は**採用提案2、保留6、独立再レビュー待ち**。2件をmanifestに仮統合して検証しており、レビュー承認はまだ得ていない。初回判断は[initial-outcomes.json](../../data/national/location-batch2/kinki-west/initial-outcomes.json)に保持する。

## 母集団と選定

[selection.json](../../data/national/location-batch2/kinki-west/selection.json)は初回資料取得前に保存した。Issue24のoriginalRefが近畿西に属する108IDを第1弾baselineと照合。既採用の大阪市下水道科学館・スワンホールを除く開始時地域未位置は106。全国未位置608も開始時台帳の値であり、今回の仮統合後は地域104・全国606である。

[coverage.json](../../data/national/location-batch2/kinki-west/coverage.json)に全108件の原調査・レビュー・分類・除外理由を保持する。選定8、既採用2、第1弾保留3、Issue25/27保留4、終了のみ1、今回範囲外90。第1弾integration/followupsの伊丹仮設店舗・旧岡田家・明石、加東2・大東2の保留は再開していない。Issue20保留6件は地域外。終了のみと在庫切れを区別する。

8件はfirstPinかつ移転・別棟または座標競合に該当する20件からの**作業者判断による有意抽出**で、網羅的・定量的な順位付けではない。同条件の対象外12IDはcoverageのsameCriteriaExcludedIdsに列挙し、後付けのスコアや劣後理由を作らない。共通資料の守口2・芦屋2を同棟認定したわけではない。配布状態は保存済み2026-11-05評価で、現時点の在庫再確認ではない。

## 2施設の外形照合と採用提案

[building-correspondence.json](../../data/evidence/location-batch2/kinki-west/building-correspondence.json)に現配布原典、図の版・物理頁、取得日・hash、旧台帳行hash、照合項目を記録。[building-inputs.json](../../data/evidence/location-batch2/kinki-west/building-inputs.json)が元タイル・feature・頂点を固定し、[derive-buildings.py](../../data/evidence/location-batch2/kinki-west/derive-buildings.py)が計算を再現する。レビューに記載された概算点を入力にしていない。旧P05点は取得範囲を絞る探索用に限る。

| 施設・ID | 独立した建物同定 | 代表点 lat, lng |
| --- | --- | --- |
| 稲美町役場地域整備部水道課 `facility:kinki-0df3699f1debe84ccd2a` | 2026採用要項物理6頁は北が上、2023庁舎案内の敷地図は北が右上。新館が本館南西、いきがい創造センター南東、県道北側という配置、長軸・南東曲線部・東側細長い構造物をGSIに照合。2023案内に新館2階水道課。 | 34.748402, 134.9130319 |
| 柏原市市役所別館1階 下水工務課 `facility:kinki-1ca68b2dbec83466c8f0` | 2019基本設計物理4頁の北（左上）を合わせ、本館→連絡部→南東の矩形別館、西側国道25号/大和川、東側JR沿い帯状空間、北のリビエールホールを照合。2025市案内が別館・所在地を明記し、配布原典も別館1階。 | 34.5775854, 135.6296097 |

稲美はBldA z16/57328/26014 feature79で本館と新館が連続する。公式図で特定した新館側の元頂点16〜31を用い、細い接続部の端点間を閉じた部分外形の重心を採った。柏原はz16/57458/26052 feature55の矩形全体の重心。両者とも有効な外形で、重心が外部や穴に出ず、7桁丸め後も元外形と選択部分の内部にある。独立した棟同定を経ずCSV点の内包だけで外形を選んだものではない。入口測量や1995年別館の追加存続証明は採用条件にしない。

候補の根拠と最終承認は別記録。[locations.json](../../data/national/location-batch2/kinki-west/locations.json)と[location-lifecycle.json](../../data/national/location-batch2/kinki-west/location-lifecycle.json)を明示選択した仮統合である。変更を許すのは2施設のcoordinate/evidence/locationReviewのみ。名前・住所・全配布関係・他施設・既存ピンを保持する。

## 残る6件と初回記録の訂正

詳細な出典、到達段階、停止・再開条件は[outcomes.json](../../data/national/location-batch2/kinki-west/outcomes.json)。実際に外形照合したのは上の2件だけであり、残る6件をbuilding-comparison完了とは扱わない。

| 施設 | 到達点・残件 |
| --- | --- |
| 奈良町南観光案内所 | CSVの名称・観光案内所POI・旧ならまち振興館の説明は強い施設対応。Vector内包1は確認したが、繭の棟同定を独立に完了していない。再開は「配置図とGSIを照合しCSVを数値原典にしない」または「CSV点の位置意味とCRS/精度を確認」の別経路。双方を必須にはしない。文化財GIS探索は計画のみで未実施。 |
| ダムパークいばきた パークセンター | map02は**図の左が北**。1番は駐車場南、ドッグラン西〜北西。初回の東/南を原本で訂正した。外形との照合は未実施。大阪府資料は検索のみで本文取得成功とはしない。 |
| 芦屋市役所 北館警備室 | 施設カルテ101が北館を区別するが、外形照合は未実施。市公開ページで共通CSVを発見していない。市GIS紹介とポータルを追加取得したが、個別地物・数値座標・GIS利用規約は未確認。 |
| 芦屋市役所 東館下水道課 | カルテ102は東館・水道部を区別。カルテ住所8-28と台帳7-6の使い分け未確認のため住所を訂正しない。北館と同様GISの個別確認・外形照合が残る。 |
| 守口市役所 総合案内 | Excel行36の34.735,135.561はBldA内包0。行36 T/U列の別館1階エントランスロビー等の記述も抽出した。市役所主棟/別館と施設点の意味を区別する必要がある。 |
| 守口市役所 下水道課 | 同じExcel。行3の中部エリアコミュニティセンター34.735676,135.561805は旧P05の34.736027,135.561523と異なるが、別用途の点を流用しない。庁舎外形との独立照合は未実施。 |

[search-notes.json](../../data/evidence/location-batch2/kinki-west/search-notes.json)は検索のみ・未実施・限定ページでの未発見を区別する。記録のない検索時刻や応答hashを後から作らない。[numeric-observations.json](../../data/evidence/location-batch2/kinki-west/numeric-observations.json)に原典行・列を保持する。

## 原本・利用条件・時間

一般HTML/PDF/写真/Excelの新規原本は再配布条件未確認のためworkのみ。Gitは事実抽出・取得hash・再現処理とPDL1.0の必要タイルを追加し、既存原本を削除しない。[取得記録](../../data/evidence/location-batch2/kinki-west/retrievals.json)はTLSエラー/404等の失敗も保持する。奈良のCC BY 2.1 JP、守口のCC BY 4.0表示は原本と利用目的を分けて扱う。

国土地理院最適化ベクトルタイルPMTilesはreadme上2026-07-01版。初回奈良・守口2タイルと今回稲美・柏原周辺8タイルを保存した。後者のRange取得は全件同一ETag・Last-Modifiedで、[footprint-retrievals.json](../../data/evidence/location-batch2/kinki-west/footprint-retrievals.json)に記録。Web Mercator格子extent4096・左上原点x東/y南から逆変換しlat/lngで保存、測地系変換なし。7桁は測量精度を表さない。[source-conditions.json](../../data/evidence/location-batch2/kinki-west/source-conditions.json)にPDL1.0・出典/加工表示を記録。基本測量成果に位置付けない試験公開で、ラスターと同条件とは推定しない。規約は第1弾取得日時/hashを維持して再利用し、新取得と偽らない。国土地理院による施設点の作成・承認ではない。

初回[timing.json](../../data/national/location-batch2/kinki-west/timing.json)の315.054秒は初回調査だけの地域共通wall clock。追加調査の[revision-timing.json](../../data/national/location-batch2/kinki-west/revision-timing.json)を別記し、施設別へ按分・重複加算しない。

## 検証

新しい地域差分テストを仮統合前に実行し、座標なしで期待2点に一致せず失敗するREDを確認。仮統合後GREEN。unittest discoverが認識する `test_location_batch2_kinki_west.py` とし、ハイフン名では収集されなかったため修正した。全Python93件・Go非cache成功。共有変更はmanifestとtest_assemble.pyのみで、後者の履歴3テストをbatch2選択/bindingを除くmanifestへ限定。既存844やdigestは書き換えていない。

```sh
mise exec -- python3 -B data/evidence/location-batch2/kinki-west/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python -B data/evidence/location-batch2/kinki-west/derive-buildings.py
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python -B data/evidence/location-batch2/kinki-west/verify-vector.py
mise exec -- python3 -B -m unittest discover -s tools/national -v
mise exec -- go test -count=1 ./...
```

原本45hash、全108ID・原記録/レビューpointer、元行hash・旧値・binding・提案/証拠hashを検査。代表点の再計算は保存JSONとbyte一致。元の内包診断も奈良1/守口0を再現した。初回の追跡外スクリプトはhistoryに履歴として保存し、現在の処理はfetch-sources.py/fetch-footprints.py/render-footprints.py/derive-buildings.py/verify*.pyで追跡する。historyの初回結果作成処理で現在の成果を上書きしない。

assemble→Go builddataは保存一覧20261021・review-list20261105・as-of2026-11-05で前後生成。builddata初回は既存municheckがないため失敗し、親rootの既存raw/checks関連原本をhashを保ってローカルコピー後に成功。[build-inputs.json](../../data/evidence/location-batch2/kinki-west/build-inputs.json)に再利用を記録した。全国監査も実行。1313カード・1735場所・1825関係、配布施設ピン978→980、蓋ピン1309不変。full/details/pinsの世代hash、分割とfullの一致、既存ピン全件不変、追加2件の詳細座標を[verify-generated.py](../../data/evidence/location-batch2/kinki-west/verify-generated.py)で検査し、[generated-check.json](../../data/evidence/location-batch2/kinki-west/generated-check.json)に保存。実detailsとUIのfacilityMapLink関数を使って2件の関係別Maps queryを[check-maps.ts](../../data/evidence/location-batch2/kinki-west/check-maps.ts)で確認した。ブラウザー操作やGoogle Maps先の現地表示は未確認、サーバー起動なし。

文書とコードの差は、初回文書の「全行building-comparison」「採用0でmanifest不変」と追加実装後の状態を上記の通り訂正した。既存履歴テストの件数を現manifestの件数と読まない。アプリUI変更なし、入口/室内測量・現地在庫・未選定施設の追加調査は未確認。

## 独立レビュー

Gemini 4 Argonはquotaで失敗し、承認を得ていない履歴を[review.json](../../data/national/location-batch2/kinki-west/review.json)に残す。その後ユーザーがOpus代替を許可。初回Opusの重大3件と任意指摘への対応は[opus-review-response.json](../../data/national/location-batch2/kinki-west/opus-review-response.json)に別記する。新規Claude Opus 5.5の独立再レビューを依頼するまで提案2件の最終採用は保留。CI監視・マージは親が担当する。
