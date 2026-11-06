# 東京10件の限定照合

採用承認は0件。①②④は、提示座標の取得方法が確認できれば既存点の再審査へ進める条件付き候補。全10件の追加回答を照合済み。

|番号|施設|既存点との距離m|判断|
|---|---|---:|---|
|1|小金井市観光まちおこし協会|2.71|conditional_review_candidate|
|2|丸吉玩具店|5.70|conditional_review_candidate|
|3|Hintmation|8.04|hold_pending_coordinate_provenance|
|4|ヒノトントンZOO(羽村市動物公園)チケット売り場|3.56|conditional_review_candidate|
|5|URまちとくらしのミュージアム|11.96|hold_pending_coordinate_provenance|
|6|フレア五日市|13.12|hold_pending_coordinate_provenance|
|7|コネクトすみだ[まち処]|1.68|hold_pending_coordinate_provenance|
|8|国指定重要文化財 旧三河島汚水処分場喞筒場施設|203.81|hold_conflicting_user_coordinate|
|9|総合レクリエーション公園サービスセンター|11.41|hold_pending_coordinate_provenance|
|10|荻外荘公園受付|3.27|hold_conflicting_user_description|

①②④は提示点がそれぞれ4550、2982、2872内にあります。数値一致だけで独立検証済みとはせず、利用者の建物指定としての意味を確認した上で既存候補座標を再審査します。

⑧は旧事務棟から約204m離れています。⑩は本体でない屋外受付という説明に対して点が本体5899内です。⑤はスターハウスの東西説明にも差が残ります。③⑤⑥⑦⑨は提示座標の取得方法が未確認で、派生点等を独立に裏付けたとは扱いません。

原調査の建物同定・原タイル計算・通常フック成功を継承。新規の距離・内外判定だけをcompare.pyで計算しました。全suite、原タイル全件再decode、現地確認、実Google Maps閲覧は未実施。repo変更・commit・pushなし。新たな文書/code不一致なし。

results.jsonに全ID・元座標・計算対象のsha256・限定読解URL・理由を保存。数値距離は精度上限ではありません。
