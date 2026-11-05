# Issue 7 north-kanto 建物代表点の追加調査

固定割当112 ID。**候補24、残件88、住所表記訂正提案1**。親の独立レビュー前であり、manifestへの採用、配布関係・状態の変更はしていない。候補はP05建物点23 IDと草加市公式HTMLの施設Marker 1 ID。P05は全国ZIPを再利用し、08–11の全レコードを新たに検索した。旧候補のコピーを承認として扱っていない。

## 実施範囲と限界

全112 IDで公式ページの新規取得を試み、既存原本・issue5保留理由と新P05検索を突合した。取得は234 URL試行、232成功、2失敗（旧吉岡町ドメインのDNS失敗、無印良品店舗詳細の読込タイムアウト）。今回の取得時刻は各fetch-recordsのrequestedAt/fetchedAt。失敗時刻はfinishedAtでありfetchedAtを捏造しない。Cookieは保存していない。

全件でページ取得と地図数値構造走査を実施したことは、全リンク・PDF・公開GISを深掘りし終えたという意味ではない。候補について施設同定の本文を確認した。残件では従来の別棟・施設全体点・住所feature・蓋・viewport等の障害を解消できていない。個々の旧理由はinvestigation.jsonのpreviousReason、新規試行はattemptsに分離。未取得・取得失敗・旧原本再読を「現行建物確認済み」にしない。PLATEAU建物外形の追加調査は今回未実施。

P05検索は広めの名称包含検索で、同名他市・別庁舎が候補に混じる。decisions.jsonの明示選択が採用候補。38 IDで検索候補を得たが全てを採用していない。例えば壬生の通町旧庁舎、沼田の西倉内町旧庁舎、白岡の旧市役所、富士見の本庁舎を現配布別棟へ転用しない。

## 候補の要点

北茨城市役所は総合受付・守衛室・市民課の3 IDとも公式配布記事に庁舎1階と明記。烏山庁舎2 ID、小山市役所2 IDも室内座標を要求せず同じ建物点を使う。小山は2021年5月6日新庁舎開庁を市統計年表で確認し、P05基準2022年4月との時点関係を検討した。

さくら本庁・卯の里庁舎は旧住所featureを採用せず、名称・番地を持つP05の別建物点を使う。コテラスは隣接温泉421-3ではなくP05観光交流センター419-1。渋川第二庁舎は新規取得施設記事が石原6-1・2階下水道課を明示し、本庁石原80から区別。龍ケ崎はP05「小柴5-1-22Ｆ」を市の専用案内「小柴5丁目1番地2、サプラ2階」で照合した。

草加宿芭蕉庵は公式HTMLのinitParam_Mapから、市のmap.jsのLatLng→Marker.positionまで検証。表示中心だけを建物点と言い換えていない。既存住所「神明二丁目145番地1」に対し、市の施設ページの「神明二丁目5番1号」への表記訂正を別提案にした。地番と住居表示の関係までは確定していないため、旧番地が誤りと断言せず親レビューで表記統一の採否を決める。施設名・配布記事の一致に基づく座標候補はこの表記変更と分離した。

残件の例：土浦一中・日立・ORIGAMIは座標競合未解消。守谷は追加の本庁舎案内により警備室が議会棟1階と判明したが、P05守衛室点との建物配置照合は未了。加須本庁のP05は現住所三俣2-1-1と一致するが、観光協会事務局の現行同居原典の追加確認が未了。これらは室内精度を要求しているのではなく、対象建物同定の欠落。

## 原本・生成・検証

- `investigation.json`: 全112 IDの旧分類、旧原本参照、新規試行、判定と候補P05生feature。
- `fetch-records.json`, `additional-fetch-records.json`, `targeted-fetch-records.json`: 今回取得原本のURL・時刻・hash。
- `p05-search.json`: 検索対象レコード数・全国ZIP hash・メンバーhash・feature locator。
- `decisions.json`: 人手ではなくAIによる施設同定判断を明示した候補リスト。
- `referenced-original-hashes.json`: 旧原本103ファイルのrepo相対参照と検証hash。大量複製しない。
- `verification.json`: 全件一意分類、24座標原値、Evidence 7キー、訂正old値、原本hash、固定入力不変の検査結果。

ネットワークなしで再生成・検証：

```sh
python data/evidence/issue7/north-kanto/assemble.py
python data/evidence/issue7/north-kanto/verify.py
```

新規取得を意図して繰り返す場合のみ `research.py` → `additional.py` → `fetch-targeted.py`。既存の実取得記録を更新するため通常の検証では実行しない。年表のテキスト抽出は `pdftotext 26a542c2eb99255d703c6be7.pdf oyama-chronology.txt`（本ディレクトリ内）。座標値は文字列の検索結果から推定せず、全国ZIP内GeoJSONの数値を直接再読する。

## 出典条件と精度

国土交通省「国土数値情報（市町村役場等及び公的集会施設）2022年版」を加工。P05個別データページはCC BY 4.0を指定する。今回取得したデータページはadditional-fetch-recordsに記録。既存の製品仕様書 `data/evidence/national/official-facility-index/p05-spec.pdf` / `p05-spec.txt` の建物外周内検査と照合し、住所ジオコード結果を直接採用したものではない。数値はJGD2011 (EPSG:6668)から保持し、測量・入口精度や地殻変動補正を主張しない。

全国ZIP参照先は `data/evidence/issue5/chubu/P05-22_GML.zip`。元取得日時の記録は `data/evidence/national/official-facility-index/P05-22_GML.zip.source.json`（2026-11-05T04:46:10.674180+00:00）と同一hashで照合できる。今回再ダウンロードしたとは記載しない。

自治体HTMLの数値事実の利用とHTML原本全体の外部再公開は別問題。P05の個別CC BY指定を自治体HTMLに拡張しない。HTML一般規約やCopyright表記だけを理由に事実座標を一律保留しない。今回は原本の公開・デプロイはしていない。Google地図本体を取得・解析せず、Google由来の抽出値への原典付け替えもしていない。

## 文書とコードの不一致

既存issue5/north-kanto/README.mdは「文書と実装コードの食い違いは…発見していない」とするが、同assemble.pyが生成するEvidenceにはfetchedAtが含まれ、cmd/builddata/ledger.goのEvidenceは7フィールドのみ。旧reviewもこの不整合と厳密デコード失敗を記録している。今回はコードの7フィールドに従いfetchedAtを取得メタデータへ分離。旧ファイルは修正しない。今回読んだ範囲でその他の文書対コード不一致は発見していない。旧筑西のPOI表現不整合は旧レビューにあるが今回の担当ID外で変更していない。
