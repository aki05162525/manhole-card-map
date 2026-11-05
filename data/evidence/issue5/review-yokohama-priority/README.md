# 横浜駅観光案内所の独立採否レビュー

2026-11-05 / AIによる資料照合、現地確認なし。

判定は **accepted**。対象は `14-100-A001` / `facility:kanto-south-4ecb948da292cb16373b` の建物代表点1件、JGD2011の緯度35.4666121・経度139.6223259。必要訂正はない。機械可読結果は `data/national/issue5/reviews/yokohama-priority.json`。

## 原本対応と建物同定

市カードHTMLの「ベイブリッジ柄マンホールカード配布場所」（保存原本648行）は横浜駅西口・JR横浜タワー2階アトリウムを指定する。JR Yokohama Station Cityの観光案内所節も2階を明示し、JEBL建物概要は南幸1-1-1と2020年3月竣工を示す。既存原本のURL・取得日時を維持し、そのhashを再検査した。旧住所高島2-16-1を根拠にしていない。

GMLの対象IDは `bldg_1754b772-2d39-48d3-9eb2-c5f0d933215a` / `14100-bldg-120521`。名称・番地による一致ではない。市資料をpdftoppmで画像化して実際に読み、GMLの周辺建物、対象LOD0外形、LOD2の100m超の面を独立に描画して比較した。

- `city-development-p28.png`：市PDF物理28頁（印刷27頁）。「JR横浜タワー（駅前棟）」が線路西側、中央西口駅前広場の東隣に黄色で描かれる。北側の鶴屋町棟や線路東側のルミネとは別。
- `city-tower-plan-p16.png`：市計画PDF物理16頁（印刷15頁）。商業低層部約60m、高層業務部約135m、低層部のアトリウムと観光コンシェルジュを確認。計画図なので現入居確認は上記現行本文で補う。
- `gml-context.png`：対象は橙、100m超の面は赤。南西〜北東方向の長い外形、北端の屈曲と北側の高層部が市図と整合する。周辺の広場側建物と線路側の空間の位置関係も整合する。図の背景にGoogle地図は使っていない。

LOD1上下端は標高2.4m/62.9m、差60.5m。measuredHeightは132.9m、LOD2最高標高135.36197894m。計画図の高さとは基準が異なり、同じ値であるとの主張はしない。配置・形状を主根拠、高さを補助根拠として同定できる。surveyYear=2020、creationDate=2024-03-22を確認し、2024年度版を測量年と扱わない。

引用精度の補足：物理28頁の配置図に「モアーズ」の名称ラベルはない。候補にある「モアーズ南側」をこの頁の直接の記載とする根拠は不足する。この語を除いても建物は同定できるため非阻害の指摘とし、任意のexact編集をレビューJSONに記録した。元成果は変更していない。

## 数値・原本・コードの検証

`checks.json` に全取得原本・再利用原本のhash、原頂点、CRS軸、属性、重心・包含判定を保存した。2メッシュともgzip復元hashが元記録と一致する。対象GMLは公式配信URLから独立再GETし、保存gzipから復元した33,939,275 bytesと完全一致した。復元SHA256は `310b719c3059620dd5a32da4ae60faf31717c4c34527aa001c29210ab7b19bd1`。

EnvelopeはEPSG:6697（緯度・経度・標高）。高さを除いたEPSG:6668の経度・緯度を、always_xy=TrueでEPSG:6677に投影する。6677の正式軸は北距・東距だが、この設定の返り値は東距・北距であり、コードの取り扱いは正しい。WGS84への変換はしていない。

平行移動した頂点への靴紐公式で面積と重心を別計算し、Shapelyとも照合した。面積7265.7019784103795 m²、重心は35.466612058450735 / 139.62232594269489。候補の7桁丸めと一致し、丸め後も建物内部、境界から約18.54mある。穴なし・閉環・有効なpolygonを確認。保存桁数を現地の精度と解釈しない。

`derive.py` は指定GML以外を座標計算に読み込まない。元Google点35.4667112 / 139.622346とは異なる値で、平均・転用・オフセット計算はない。既知の地域を検索することと、Googleの座標値を再利用することは別である。

`reproduce.py` は元derive/buildを出力先だけ隔離して実行し、derived-pointのJSON全体、候補と再利用記録のバイト一致を検査した。`reproduction.json` に結果と元ディレクトリの不変hashを保存。元validateも出力先だけ隔離して実行し、`candidate-validator-result.json` に結果を保存した。

`evidence-probe.go` は実際の `cmd/builddata/ledger.go` からEvidence構造体とvalidateEvidence関数を抜き出した検証用記録。既知7フィールドへのstrict decodeと実validateEvidenceが通過した（`go-evidence.txt`）。アプリのコード・manifestを変更していない。

## 利用条件の採否判断

当該metadataのCC BY 4.0表示を原ZIPから確認した（`metadata-extracted.xml`）。[公式FAQ](https://www.mlit.go.jp/plateau/faq/)は一般のデータ利用について手続き不要・商用利用可と説明する。[サイトポリシー](https://www.mlit.go.jp/plateau/site-policy/)のWeb Site Policy 3は、出典・加工表示、CC BYでの利用許諾と、個別法令の留保を含む。候補Evidenceは出典自治体・データセットURL・CC BY・加工主体と方法を保持している。

3(2)の留保を消してはいけない。GMLのpublicSurveySrcDescLod0=003はコードリストの空中写真測量の測量成果である。[国土地理院の公共測量ナビ](https://service.gsi.go.jp/onestop/navi/nav6-1/)も、公共測量成果から別種の地図を作る場合等の手続を説明する。この説明を読み、CC BYが測量法を全面的に免除するとは判断しない。

その上で、今回の対象は既存の公開モデルから算出した施設案内の最小代表点1件であり、形状・地形の再配布や新しい測量成果の整備ではない。ユーザー申告のprivate repo・デプロイなしという現状も含め、公式の一般利用許諾を覆してこの採用に追加手続を課す個別条件は今回の資料から確認されない。**本用途の採用に具体的な支障を認めずacceptedとする**。これは根拠に基づく採否判断であって、個別法令上の免除を公的に認定するものではない。将来のGIS再配布について包括的な法的保証が得られていないことを、今回の保留条件にはしない。

[GSI Q&A](https://www.gsi.go.jp/LAW/2930-qa.html)もwebツールで閲覧したが、基本測量の説明なので、その内部利用の扱いを市の公共測量へ直接流用していない。このページのローカルGETはTLSエラーになり、原本保存できていない。`official-fetch-records.json` に失敗と他の成功した取得を区別して記録した。

最小代表点の利用と、市PDF内の写真・背景地図、JR/Google原本を丸ごと外部公開する行為は別である。後者の一括公開許諾はこのレビューの対象外。問い合わせ送信・外部公開・デプロイは行っていない。

## 再検証

リポジトリルートで実行する。書込みは本レビュー記録の範囲に限定される。

```sh
uv run --with pyproj==3.8.0 --with shapely==2.2.0 --with matplotlib python data/evidence/issue5/review-yokohama-priority/check.py
uv run --with pyproj==3.8.0 --with shapely==2.2.0 python data/evidence/issue5/review-yokohama-priority/reproduce.py
```

レビューJSONを再生成する記録は `write-review.py`、ネットワーク再確認用は `fetch-official.py`。PDF画像の再生成はpdftoppmの `-f 28 -l 28` / `-f 16 -l 16`、`-scale-to 1800 -png -singlefile` を使用した。

調査したREADMEの計算・再現手順とderive/build/validate、およびGo Evidence契約の間に、ドキュメントとコードの相違は見つからなかった。上記のモアーズ記載は資料の引用精度に関する非阻害の指摘として別記した。

変更は指定のレビューJSONと本ディレクトリのみ。元候補・元証跡・manifest・既存コードは未変更。子起動・branch作成・commit・push・PRは実施していない。
