# west-south 独立レビュー

判定は `data/national/issue5/reviews/west-south.json`。accepted 5件、correction-required 1件（神埼）、deferred 0件。6件とも建物代表座標自体は承認できる。元候補、manifest、baseline、アプリコードは変更していない。158保留は今回の新規調査対象ではない。

神埼は配布ページ7553が9–17時・12/29–31休み、施設ページ12136が月曜（祝日は翌日）・12/29–1/3休館。ledger/fullとも前者の時間のみを持ち、fullはreview=verified。施設側の月曜休館を誤適用した形跡はないが、不一致が表示されず年始や月曜の配布可否が確定したように読める。hours/conditionを両原典の不一致と訪問前確認を示す文へ置き換えるexact案を作った。activeをsuspendedへ変える根拠はない。baselineは比較用に固定し、親が統合入力へ訂正を反映してfullを再生成する。

鹿島は配布原本15748が平日下水道課・休日宿日直室をともに新世紀センター1階と指定。施設原本21632は2016年8月完成の第二庁舎、1階環境下水道課と明記する。市役所本庁の総称点へ置換しない。

隼人は配布原本20180726の第22弾が平日2階下水道工務課・休日1階お客様センター宿直室と指定。フロア案内hayato.htmlは内山田1-11-11、隣のすこやか保健センターは1-10-33。第14弾の代替窓口へ階情報を流用しない。フロア図画像の内部配置や部屋位置を測量したわけではない。

太宰府の原本22649はA/Bの休館日代替を市役所1階総合案内と指定。住所の一致は同ページの市役所フッターとP05で確認した（配布欄そのものには市役所住所なし）。Cの2026-10-01～12-22移転は駅構内観光案内所で、旧太宰府館・市役所とは別。baselineには旧館suspended/reviewUntilと新案内所の期間付き関係が存在し、元提案の説明訂正は妥当。終了後復帰やCの代替関係を追加しない。

宇美原本14168は南館上下水道課と本館警備室を明記。時刻の名称混入除去を含む2件のexact old/newはbaselineに一致。これらと太宰府説明の計3訂正は内容を承認し、EvidenceからfetchedAtを外した統合用案をレビューJSONに収録した。元取得時刻はwest-south/fetches.jsonに保存されている。

## P05・CRS・利用条件

原ZIPの内包県ZIPからGeoJSONを独立に読み、41のfeature431/361、46の657、40の1691を照合。候補6行は原feature・原座標・抽出ファイルhashに完全一致する。GeoJSONのCRSはEPSG:6668/JGD2011、順序は経度・緯度。lat/lngへの転記のみで変換なし。製品仕様KS-PS-P05-v3_0_1の5.1と位置正確度検査（建物外周内）を確認した。2022年4月基準であり、入口・室内窓口やセンチメートル精度の保証はない。閲覧した現行保存原本との建物同定はできるが、同住所建替え不存在の完全証明ではない。

P05個別ページのHTML345行は、コメントではない「オープンデータ（CC_BY_4.0）」指定を持つ。リンク先agreement_01.htmlは2020年の政府標準規約準拠版で、CC BY 4.0互換・同条件による利用可を記載。一方、現行[一般規約](https://nlftp.mlit.go.jp/ksj/other/agreement.html)は2026-03-23施行PDL1.0であり「権利表記の記載がない限り」と個別条件への留保がある。したがってP05の個別CC BY指定を否定してPDLのみへ一括置換する理由はない。元READMEに現行一般規約と個別指定の区別を追記するexact案を収録した。他地域の説明は根拠とせず、chubuに保存された公式HTMLを自分で読みhash照合し、本ディレクトリへ同一bytesをコピーした。current-terms.source.jsonは元取得日時を保持する。一般規約2 URLのみWebでも確認した。

出典：国土交通省「国土数値情報（市町村役場等及び公的集会施設）2022年版」<https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html>（保存原本取得日2026-11-05）。対象施設の座標を抽出・lat/lngへ転記した加工物。国土交通省による作成・承認を意味しない。自治体HTML全体にこのライセンスを適用しない。

## Go Evidence・文書とコードの相違

`cmd/builddata/ledger.go`のEvidenceはsourceUrl、snapshotPath、snapshotSHA256、sourceLocator、checkedAt、actorType、verificationMethodの7フィールド。decodeLedgerはDisallowUnknownFieldsを使う。6座標候補は適合するが、元の訂正提案3件はevidence.fetchedAtを含み、Goの厳密デコードで拒否される。READMEの「食い違いはない」はこの統合時制約を記載しておらず、訂正が必要。発見した文書・コードの相違はこの1件。取得時刻付き補助記録自体を不正とする判断ではない。

## 再検証

リポジトリルートから以下を実行する。出力はレビュー用パスだけに書き、元調査のbuild.pyは実行しない。

```sh
python data/evidence/issue5/review-west-south/verify.py
go run data/evidence/issue5/review-west-south/evidence-probe.go
```

validation.jsonに原値・hash・旧値一致と入力不変を記録。Go probeは現行Evidence構造体をそのまま抽出して厳密デコードする。6件成功、元訂正3件はunknown field fetchedAtとなることを確認した。これはレビュー成果物の検証であり、manifest統合や全アプリテストの完了を意味しない。
