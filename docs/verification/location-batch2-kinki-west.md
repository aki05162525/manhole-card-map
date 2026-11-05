# 位置調査第2弾・近畿西（Issue42）

2026-11-05、基準コミット `f66b7e994ef250fadee78f396d22fdfc40ba6a83`。8施設を選定し、新しい一次資料と別手法を調査した。**採用0、保留8**。manifest、位置binding、台帳、全配布関係、アプリ、共有文書・共有テストは変更していない。限定調査の完了であり、未位置の解消を意味しない。

## 母集団と選定

[selection.json](../../data/national/location-batch2/kinki-west/selection.json)を新資料の取得前に保存した。Issue24 snapshotの `originalRef` が `issue7/kinki-west.json` またはそのreviewsに属する108IDを第1弾baselineと照合。現manifestをassembleすると、既採用の大阪市下水道科学館・スワンホール2IDを除く106IDが未位置だった。全国台帳未位置608は開始時の現manifestの集計であり、生成全体や採用後の推計ではない。

[coverage.json](../../data/national/location-batch2/kinki-west/coverage.json)は108件すべての原調査、レビュー、配布分類、firstPin候補、blocker、除外理由を保持する。今回選定8、既採用2、第1弾保留3、Issue25/27保留4、終了のみ1、今回範囲外90。終了のみと在庫切れ・配布休止を混同しない。Issue20の保留6件は地域外。第1弾integration/followupsの伊丹仮設店舗・旧岡田家・明石と、加東2・大東2の保留は新資料なしに再開していない。

8件は初ピン候補かつ移転・別棟または座標競合のある施設。守口2・芦屋2の共通資料取得は同棟認定ではない。配布状態とfirstPinは保存済み2026-11-05評価の分類であり、本調査で在庫を再確認した意味ではない。地域全施設への成功率や作業時間の外挿はしない。

## 調査結果

完全なID、出典URL・取得時刻・hash・原本パス、版、座標系、加工、停止・再開条件は[outcomes.json](../../data/national/location-batch2/kinki-west/outcomes.json)の8行を参照。

| 施設 | 新資料・到達点 | 停止理由と再開条件 |
| --- | --- | --- |
| 奈良町南観光案内所 | 市施設CSV 2025-09-01の論理レコード223に34.674053, 135.830732。運営者は繭を旧振興館の活用と説明。 | CSVは鹿の舟の複合施設説明。Vector内包1だけでは繭と断定できない。繭・竈・囀を区別する現配置と外形の対応、個別CRSの例外の有無を確認する。 |
| ダムパークいばきた パークセンター | 府の計画資料探索から運営者の2026年園内図へ進み、駐車場東側・ドッグラン南側の1番を確認。ダム管理所とは別。 | 絵図を数値外形へ接続できていない。周辺道路・駐車場・建物配置を独立照合する。 |
| 稲美町役場水道課 | 2026年度採用要項の物理6頁に、本館・新館・いきがい創造センターの区別と配置。 | 数値原典との接続が未完。新館外形・連絡部・道路を照合する。本館P05点で代用しない。 |
| 芦屋市役所 北館警備室 | 令和6年度カルテ物理8頁の施設101で北館を構成棟として明記。 | 本庁舎全体の写真や住所から北館外形を確定しない。北館配置図と数値外形を照合する。 |
| 守口市役所 総合案内 | 2026-02-25の施設Excel行36は34.735, 135.561。旧P05と同じ丸め値。 | 仮の経緯度投影ではBldA内包0。改訂点または現庁舎と数値外形の対応が必要。 |
| 柏原市役所別館 下水工務課 | 市が案内するBODIK全件APIは人口データ1セット。2019基本設計物理4頁は別館・渡り廊下・新庁舎を区別。 | 計画図を現況とみなせず、別館の数値原典も未取得。完成後の配置資料と別館外形を照合する。 |
| 守口市役所 下水道課 | 同じExcelを共有調査。旧調査の5階南エリアの窓口情報を保持。 | 総合案内と同様。別用途のコミュニティセンター点を流用しない。 |
| 芦屋市役所 東館下水道課 | カルテ物理9頁の施設102は2015年の東館・水道部部分を明記。住所は精道町8番28号。 | 台帳/旧配布案内の7-6と異なる。役所代表住所との使い分けを未確認のため訂正しない。東館配置・数値原典と住所の根拠を追加確認する。 |

奈良の数値は市CSV、守口の数値は市Excelからの観察値であり、採用提案ではない。[numeric-observations.json](../../data/evidence/location-batch2/kinki-west/numeric-observations.json)に列・行と出典を保持する。奈良市カタログのCRSは原則WGS1984（一部除く）、守口の個別CRSは未確認。測地系未確認の点を含む外形を、独立した建物同定の根拠にしない。重心・建物内代表点は導出していないため、代表点の丸め後内包検査は適用外。

## 原本・利用条件・時間

[取得記録](../../data/evidence/location-batch2/kinki-west/retrievals.json)は失敗も保持。一般HTML/PDF/写真/Excel全文は `data/work/location-batch2/kinki-west/` にのみ保存し、Gitには事実抽出・取得hashを置く。奈良市CC BY 2.1 JP、守口市CC BY 4.0の掲載表示を確認し、事実抽出に出典を付した。原本の再配布と位置情報の採否は別判断。

試験Vectorは国土地理院の現PMTiles（readme上2026-07-01版）から奈良・守口の2タイルだけを保存。[Range取得記録](../../data/evidence/location-batch2/kinki-west/vector-retrievals.json)のETag・Last-Modifiedは全応答で一致。国土地理院最適化ベクトルタイルを加工した内包診断であり、国土地理院による施設点の作成・承認ではない。基本測量成果と位置付けない試験公開で、ラスターと同じ利用条件とは推定していない。PDL1.0と出典・加工表示は[source-conditions.json](../../data/evidence/location-batch2/kinki-west/source-conditions.json)に記録。今回の規約原本取得はTLSエラーのため、第1弾保存済み規約の元取得日時とhashを維持して再利用した。readme取得の大文字ファイル名404も記録している。

[timing.json](../../data/national/location-batch2/kinki-west/timing.json)は選定保存から結果記録まで315.054秒の地域共通wall clock。資料取得待ち・図の実見・共有資料読解を含む。事前の既存資料読解、後続の検証・レビュー・PR作成は含まず、施設別に按分も重複加算もしない。

## 検証と未確認範囲

```sh
mise exec -- python3 -B data/evidence/location-batch2/kinki-west/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python -B data/evidence/location-batch2/kinki-west/verify-vector.py
mise exec -- python3 -B tools/national/assemble.py --out data/work/location-batch2/kinki-west/after.json
cmp data/work/location-batch2/kinki-west/before.json data/work/location-batch2/kinki-west/after.json
```

地域母集団・baseline・選定8ID・原記録/レビューJSON pointer・入力hash・原本hash、採用ゼロを検査。Vector計算は保存タイルだけから再現し奈良1/守口0を確認。研究前後のassemble出力はbytes単位で一致し、座標・証拠・全関係の変更はない。`verify.py`はこの基準manifestに対する調査スナップショット検証であり、後続地域採用後の件数基準ではない。

採用/製品コード変更はないため、独立したアプリ全体のPython/Go/UIテスト、Go builddata、full/details/pins再生成、ブラウザー/Maps到達確認は実施していない。現地、入口・室内窓口、現時点の在庫、全国の最新配布状態も未確認。サーバー起動なし。既存テスト期待値・digestは変更していない。

今回の範囲で文書と実装の動作上の不一致は見つからなかった。原典間の差は芦屋東館住所と守口数値点の精度問題として上記に保持する。過去の保留を現時点の採用や新しい移転と読み替えない。

## 独立レビュー

Gemini 4 Argon（Antigravity）へこのworktreeの原本・新資料差分・全件分類・非採用と検証を独立レビュー依頼したが、利用枠超過で失敗した。返答は `You have reached your Antigravity quota for this period.`。レビュー結果・承認は得られておらず、別モデルで代替していない。[review.json](../../data/national/location-batch2/kinki-west/review.json)に記録。PRはレビュー未完了のdraftとして引き渡し、Gemini利用再開後に独立レビューが必要。採用ゼロのため未承認候補の統合はない。

commit時は既存pre-commitフックを有効にし、data配下の変更に対して指定される `go test -count=1 ./...` を省略せず実行する。上記の研究限定検証とは別の必須フックである。
