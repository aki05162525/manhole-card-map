# 桜木町駅観光案内所：独立再評価

対象：facility:kanto-south-7d5b518b29440ef8d976 / 14-100-D001。2026-11-05、AIによる調査。**採用候補1件：35.4511374, 139.6312274**。成果は `../../../national/issue7/sakuragicho-followup.json`。親レビュー用であり、manifestへ適用していない。

## 結論と先行判断の評価

先行 `../sakuragicho/README.md` と `../../../national/issue7/sakuragicho.json` を精読し、保存原本も画像・数値で再確認した。

JAPAN47GOの個別施設座標を、今回許容された**訪問先の建物代表点**として採用候補にする。原本JSON-LDの名称「桜木町駅観光案内所」、住所「神奈川県横浜市中区桜木町1-1」、電話「045-211-0111」が現配布先に一致する。CIALの現店舗store_id=47は横濱情報プラザ入居を示し、市のカード本文と公式図が南改札正面を裏付ける。

公式図では窓口は店舗列の西口側端で、提案点は駅東側広場の駅外縁付近にある。したがって入口・窓口点としては採用しない。しかし同じ駅棟の中間部近傍を指す施設名付きの点で、別棟のANNEXや駅の北端・南端を指す点ではない。建物代表用途であれば、東西の窓口位置まで一致を要求する必要はない。公式図との照合は「窓口の真上の屋根」を確定する作業ではなく、訪問対象となる駅棟が合理的かを判断するために行った。

先行の外形から5.436679mという計算は再現した。5mの差だけを誤座標の根拠としなかったこと、約250m長い駅全体の重心への置換を避けたことは妥当。一方、施設名・電話一致、公式図の現入居、同じ駅棟への近接という証拠がある段階で、特定の屋根面未同定を保留解除条件にすることは今回の用途には厳しすぎる。**先行の保留継続には賛成しない**。この判断は「PLATEAU内に点がある」という虚偽の主張や、最寄り外形への座標スナップによるものではない。

厳密な屋根面対応は未完了。点の測地系・精度もJAPAN47GO原本に明記されない。数値をそのまま保持し、比較時はJGD2011水平座標と同じ経緯度として扱った。これは数m単位の測地系差の不存在を証明するものではない。小数7桁は保存桁数であって測量精度ではない。建物案内の候補と、歩行者の入口への経路終点は区別する。

## 実際に確認した原本と追加解析

- `../sakuragicho/cial-plaza.png`：南改札正面の細長い店舗列の端に案内所、反対端にNEWDAYS。野毛ちかみちとANNEX方向も確認。
- `../sakuragicho/city-station-p23.png`：市PDF物理23頁（印刷19頁）のJR構内図。案内所は南改札正面店舗列の西口側端。JR図の2022年3月版であり、現在の営業時間等の原典にはしない。
- `../sakuragicho/operator-map-p60.png`：運営者マニュアル物理60頁。南改札正面の案内所と野毛・地下鉄方面の関係を画像確認。旧マニュアルの他施設や営業時間を現行情報へ転用していない。
- 同じ市PDFの物理98頁（資料編印刷10頁）を新たに `city-station-p98.png` へ描画。北矢印・縮尺のある周辺配置図で、駅の北西〜南東方向、北東側のコレットマーレと駅前広場、南東側のクロスゲート・市役所方面を確認。地図上に案内所の厳密座標があるとは主張しない。
- `cial-access.html`, `cial-access01.png`, `cial-access02.png` を新規取得して画像確認。コレットマーレ、駅、ANNEX、国道16号の相対配置を照合。
- 国土地理院 `seamlessphoto` のz18・3×3タイルを新規取得。`photo-overlay.png` はWeb Mercatorのタイル位置に原画像を配置し、PLATEAU LOD0とJAPAN47GO点を重ねた検証用図。市・CIAL配置図と周辺建物の並びが対応する。写真の個別撮影日は未同定で、2026年の入居確認には使用していない。出典：国土地理院「全国最新写真（シームレス）」、横浜市PLATEAU 2024年度。本調査が重ね合わせ。
- `analyze.py` はメッシュ53391540を再解析。駅の `bldg_4149036a-f412-4dc8-a472-5a740921f2ed` はLOD0外周1本、RoofSurface要素183個、屋根外周posList183本。最終独立レビューで保存GMLと実コードのXPathを再計数し、旧記述184本を訂正した。`roof-analysis.json` に各面のID、頂点、面積、距離、高さを保存し `plateau-roofs.png` で確認した。これらを特定テナントの屋根と同定してはいない。
- `coordinate-check.json` に距離再計算と原座標を保存。計算CRSはEPSG:6677、GML原CRSはEPSG:6697の水平成分EPSG:6668。近さは建物への対応を補強するもので、単独での採用根拠ではない。

## 利用条件の判断範囲

JAPAN47GO `../sakuragicho/japan47go-about.html` の原本を実読した。一般条項は文書・写真・イラスト等の権利と無断転用・転載、出版物等への掲載時の事前連絡を記載する。これは確認済みの事実である。他方、施設の経緯度という数値事実1点を名指しする条件は確認できなかった。

今回の提案は個別施設の座標事実1点と出典の保持である。原本HTML・写真・地図の公開転載、DB一括利用とは分離する。「座標なら無条件で許可済み」「一般条項があるから一点利用も禁止」のどちらも断定しない。個別許可の照会や取得もしていない。検証用に保存した原本全体を公開配布してよいという提案ではない。

PLATEAUの利用条件が整理された既存 `../../issue5/yokohama-priority/README.md` も確認したが、本提案の数値はPLATEAU由来に付け替えていない。PLATEAUは建物位置の検証に使用した。独立したPLATEAU代表点を作るには、駅全体重心以外の部分を選ぶ説明が必要であり、今回はその新しい数値を作らなかった。条件の明確な原典を選ぶためだけに根拠の弱い別点を採用しない。

## 証跡・再現

`fetch-records.json` は今回実際にGETした13原本のURL、開始・完了UTC、HTTP status、サイズ、SHA256。`reused-sources.json` は先行14取得記録を参照として保存した小さなメタデータで、旧原本はコピーしていない。旧原本の取得時刻を今回の検査時刻で代用していない。失敗した旧運営者307応答2件も履歴に含むが本文証拠には使用していない。

再描画・再生成・検証（リポジトリルートから）：

```sh
uv run --with shapely==2.2.0 --with pyproj==3.8.0 --with matplotlib --with pillow python data/evidence/issue7/sakuragicho-followup/analyze.py
uv run --with matplotlib --with pillow python data/evidence/issue7/sakuragicho-followup/photo.py
pdftoppm -f 98 -l 98 -scale-to 2200 -png -singlefile data/evidence/issue7/sakuragicho/city-station.pdf data/evidence/issue7/sakuragicho-followup/city-station-p98
uv run --with shapely==2.2.0 --with pyproj==3.8.0 python data/evidence/issue7/sakuragicho-followup/build.py
```

`fetch.py` は追加13原本を再取得する任意スクリプト。再取得すると原本・実取得時刻が更新されるため、上記の保存原本再検証には実行不要。`hashes.json` は追加資料とスクリプトのhash一覧。`build.py` は先行の取得原本hash・gzip復元hash・先行input-hashes・固定baseline、割当IDの一意性とGo Evidenceの7フィールド契約を検証する。fetchedAtはEvidenceに入れず、取得記録だけに置く。

## 調査範囲と変更禁止の遵守

画像確認、GML数値再計算、JAPAN47GOの名前・住所・電話・座標照合、追加原本13件の取得を実施した。現地訪問、室内測量、特定テナントの屋根面同定、写真の個別撮影日同定、JAPAN47GOへの利用照会は未実施。これらを実施済みとは扱っていない。

旧候補、固定 `data/work/issue7-baseline/*`、manifest、既存コードを変更していない。子起動、branch変更、commit、push、PRは行っていない。

**文書・既存コードの不一致：確認範囲では0件。** `cmd/builddata/ledger.go` のEvidence型7フィールドと今回のEvidenceは一致する。先行との採否判断の相違は上記に明記したが、コード契約の不一致とは別である。
