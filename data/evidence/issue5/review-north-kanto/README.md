# Issue #5 北関東4候補の独立レビュー

判定は4件とも `correction-required`。建物同定と座標そのものは4件とも `accepted` だが、元候補の `evidence.fetchedAt` はGoの厳密デコードに対応していない。数値変更は不要。親の統合前に、原取得記録を保持した統合用コピーを使用する必要がある。元候補・manifest・baseline・既存コードは変更していない。

対象は `data/national/issue5/north-kanto.json` のupdates 0–3。判定は `data/national/issue5/reviews/north-kanto.json` に保存した。公式HTMLの保存bytesとリンクを独立再読したレビューであり、今回新たなWeb取得・現地確認は行っていない。

- 筑西下水道課と1階総合案内：36.3052692, 139.9794245。配布記事が平日3階・休日1階を同じ本庁舎内と明示し、本庁舎というリンクラベルが目的地点を指定している。`!3d/!4d` を採り、`@36.3052692,139.9772358` のviewportは除外。0x0:0x0で名前付きPOIではないことだけを拒否理由にしない。蓋の所在・隣の駐車場とは別。旧POI説明は現在の候補で訂正されており、旧ファイル用4フィールドのexact訂正もold一致を確認した。386.3m離れたP05点は未承認候補のままで採用しない。
- 桜川水道お客様センター：36.2783968826407, 140.091696381569。配布記事が真壁庁舎2階・飯塚911を指定し、公共施設ガイドの真壁庁舎の名称・住所とq数値リンクが一致する。住所検索による推定ではなく、公式が名指しする建物目的地。岩瀬・大和庁舎、蓋展示場所からの転用ではない。旧baselineの座標未確認を解消できる。
- 川島上下水道課：35.9925196, 139.4844419。配布本文の役場1階という明示から、役場交通アクセスの下八ツ林870-1へつながる。徒歩経路の2番目の地点が川島町役場であり、その `!1d139.4844419!2d35.9925196` を使用。出発バス停、viewport、さまちか事務所923は採らない。旧baselineの座標未確認を解消できる。

いずれも建物代表点であり、階・室内窓口・入口の測量精度は主張しない。原測量のCRS・誤差は確認できず、座標変換はしていない。既存relationsの曜日・条件・状態は変更しない。

## 実装との整合とexact訂正

`tools/national/assemble.py` の `evidence()` はcheckedAtを暦日に正規化するが、`dict(ev, checkedAt=day)` により他のキーを保持する。`apply_locations()` はこの結果をplace.evidenceへ渡す。scopeはplaceへ転記しないため、今回の未知フィールドエラーの原因ではない。

`cmd/builddata/ledger.go` のEvidenceはsourceUrl、snapshotPath、snapshotSHA256、sourceLocator、checkedAt、actorType、verificationMethodの7フィールド。decodeLedgerはDisallowUnknownFieldsを指定する。実際の型宣言とdecodeLedgerを一時Goプログラムに抜き出し、実assemblerでbaselineに4候補を適用した結果を入力すると `json: unknown field "fetchedAt"` で失敗した。統合用コピーの4箇所のfetchedAtのみを除くと同じデコードが成功した。これはスキーマ互換性の検査であり、全builddataの業務検証やmanifest統合を実施したとの意味ではない。

- `proposed-location-updates.json`：統合用コピー。各updatesのevidence.fetchedAtのみ除去。まだmanifestで選択されていない。
- `original-evidence.json`：4件の原evidenceをfetchedAt込みで保存。元候補と元fetch記録も保持。
- 判定JSONの `exactCorrections`：対象元ファイル・JSON Pointer・old値と、コピーにだけ適用する方針を記録。元ファイルへ直接適用しない。
- `inherited-exact-corrections.json`：筑西の旧説明4箇所のold一致検査結果。旧原本は変更していない。

元READMEの「文書と実装コードの食い違いは発見していない」は、今回確認したfetchedAtの互換性問題を反映していない。候補生成スクリプトはfetchedAtを追加し、全国assemblerは保持し、Goは拒否する。コードに合わせて統合用コピーを提案する。読んだ範囲でその他の文書・コード相違は見つからなかった。これとは別に、旧筑西evidenceのPOI表現と原典の不一致は上記のとおり記録した。

## 根拠・検査と範囲

`source-review.json` は原典URL・保存場所・独立計算SHA256・元取得日時・本文抜粋・完全な座標リンクを記録。配布→建物→数値の連鎖に使った6原本と筑西権利条件の1原本、合計7原本のhashが取得記録と一致した。レビュー日時をfetchedAtに補完していない。

`verification.json` は候補・固定baseline ledger/full・実装・元READMEのhashとGo実行結果を記録。4候補はbaseline ledgerでは座標なし、fullではunconfirmedである。座標数値4件と旧exact訂正4件を検査した。再現はリポジトリ直下で `python data/evidence/issue5/review-north-kanto/verify.py`。書込み先はこのレビューの成果物のみ。

112未解決については件数と継続扱いを維持する。今回の4候補レビューは112件の現行全件再調査・旧理由解消を意味しない。

## 原本の権利条件

repoはPRIVATE、デプロイなしという依頼条件でレビューした。数値地点の採用判断と原本HTMLの外部公開許諾を分離する。筑西の保存権利ページには私的使用・引用等と無断転載制限があり、包括的なオープンライセンスではない。桜川・川島についても包括許諾を確認したとは扱わない。数値地点は公式HTMLが明示した事実として評価し、Google地図本体を取得・解析していない。原本の外部公開・再配布を承認する成果物ではない。

子起動・commit・branch・push・PRは行っていない。他担当の調査ファイルは変更していない。
