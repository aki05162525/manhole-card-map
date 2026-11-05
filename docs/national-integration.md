# 全国整備の統合・入力監査（2026-11-05）

地域の調査完了と位置確定を区別する。監査表を全件生成しても、個別調査を済ませたことにはならない。以下は統合基盤の検証記録であり、全国整備完了の宣言ではない。

## 不変入力と今回の比較

地域共通入力は `data/work/national-input/{full,quality,places}.json`。変更していない。全件素材の基準は2026-10-21。現在一覧は親から渡された `/tmp/gkp-current-design.html`（2026-11-05取得）を再利用し、この作業ではGETしていない。取得元の全国一覧は `https://www.gk-p.jp/mhcard/?pref=zenkoku`。取得日時は引き継いだ情報で、HTTP応答ヘッダーを今回再検証したものではない。

共通入力の検証時SHA256:

|入力|SHA256|
|---|---|
|full.json|`6068da023f3bd4cb1e292b3e43877411a1505356e4377bbf02a255a89afb1987`|
|quality.json|`8561505b9c8c0426fae93bf35306bd53f324e75527b842986da3d1df7b31012b`|
|places.json|`152bb738c77e95fcbd54702e42a2107cfd5949d614c7e6b4a706c94cba2a41fe`|

- 旧HTML SHA256: `d77c7837d1ce62052c690f91945cf867b26eb11f6abcf209e4a3f3bc4779fb6c`
- 現HTML SHA256: `ad9d5072b1e99c7b44edd51336219a535b9a8d5c6b94dfed0f3acfd37016f2cc`
- 旧・現とも1,313件。画像URLの追加0、削除0、重複0、行index移動0。
- 保存済みmunicheckの採用印刷番号とローカル1,313カードを全件照合。ローカル欠落0、余剰0、重複0。これは既存OCR・上書き採用結果との照合であり、今回1,313枚の画像を目視で読み直したという意味ではない。
- 20カードで変更。Place 5、Hours 8、Stock 9、Links 6（同一カードの重複あり）。全フィールドの前後値は再現コマンドのJSONに出す。行indexを比較対象から除く。

|カード|変更フィールド|
|---|---|
|09-211-A001|Stock|
|11-208-A001|Links|
|11-208-B001|Hours, Links|
|11-208-C001|Links|
|11-208-D001|Links|
|11-242-B001|Stock|
|11-245-B001|Stock|
|12-100-B001|Place, Hours|
|13-100-P101|Place, Hours, Links|
|13-206-A001|Stock|
|13-207-A001|Hours|
|13-214-E001|Stock|
|14-218-B001|Place, Hours, Stock|
|15-202-C001|Place, Hours, Links|
|15-213-B001|Stock|
|22-215-A001|Stock|
|26-344-A001|Hours|
|26-344-B001|Hours|
|29-205-A001|Place|
|38-202-B001|Stock|

機械導出番号と採用印刷番号が一致しない10件も明示する。これらは機械導出の不確実性であり、採用番号を自動訂正しない。親で既存の `data/overrides/cards.json` と突合し、10件すべてに印字を採用した理由があることを確認した（人による既存確認2件、AIによる既存確認8件）。新たな未解決番号10件とは区別する。今回の画像再読ではない。記録は [番号照合](verification/national-id-reconciliation.json) を参照。

|採用印刷番号|現一覧からの機械導出|
|---|---|
|01-303-A002|01-303-A001|
|03-000-A001|03-000-A002|
|04-442-A001|04-422-A001|
|11-010-A001|11-010-A101|
|13-000-A001|導出不可|
|15-205-D001|15-202-D001|
|20-452-A001|導出不可|
|23-234-A001|導出不可|
|28-221-A001|28-221-A002|
|28-481-A001|28-481-A002|

## 実行

リポジトリrootで実行する。出力先は入力とは別にする。

```sh
mise exec -- go test ./...
mise exec -- go run ./cmd/listdiff \
  -before data/raw/gkp-list-20261021.html \
  -after data/evidence/national/list-source/gkp-20261105.html \
  -checks data/work/municheck.json \
  -local data/work/national-input/full.json \
  -retrieved-at 2026-11-05 \
  -source-url 'https://www.gk-p.jp/mhcard/?pref=zenkoku' \
  -out /tmp/national-list-reconciliation.json

python3 -B tools/national/assemble.py --out /tmp/national-assembled.json

mise exec -- go run ./cmd/builddata \
  -places /tmp/national-assembled.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05 \
  -merged-places /tmp/national-places.json \
  -audit-out /tmp/national-audit \
  -out /tmp/national-build
```

現在はレビュー済みパッチを先に適用する必要があるため、未補正の地域fragmentを直接globで結合しない。[統合manifestの手順](national-assembly.md)を使う。builddataは従来どおり保存済み照合結果とその入力hashを検証するため、全件素材のある親環境で実行する。全国素材をCIへ追加する必要はない。

`-review-list` は現一覧を**画像URLで**結び、配布場所・時間・在庫・リンクの現指紋で関係承認を判定する。旧台帳の `sourceHash` と変われば `needs-review`。現一覧に合わせた関係承認には、現出典を再確認した上で現指紋が必要。新しい `quality.json.sourceHashes` に現指紋を出すが、共通入力を置き換えて地域作業を混在させない。指紋だけ更新して確認済みにしない。

旧一覧のカード原文と抽出関係は保持し、`reviewSource` に現一覧path、カードの `reviewSourceHash` に現指紋を残す。このモードは現一覧の施設を自動で再抽出・差し替えするものではない。変更がある20件の移転・時間等は地域の根拠付き訂正が必要。画像の増減があれば停止し、印刷番号の対応を人が確定してから入力移行する。

統合はfacility IDが完全一致する項目のみ共有可能。同じIDの異なる値、legacy alias衝突、同じcard+facilityの異なる関係をエラーにする。単一台帳出力はbuilddataの `-places` に再入力できる。validationは出力前に根拠hash、URL、座標、施設・カード・関係参照、期間を検査する。

監査JSON/Markdownには全カードと全関係を出す。確認済み関係数、座標確定施設数、座標確定施設に結び付いた確認済み関係数は別集計。休止・終了・予定も「根拠確認済み関係」に含むため、受取可能件数として使わない。未確認・候補は理由付きで残り、処理済みにはしない。地域の `data/national/regions/*.json` は独立した調査記録で、現CLIはそこに書かれた自己申告stateから配布承認を生成しない。親は地域別調査理由・証拠と監査行の突合も行う。

地域なしの検証結果はカード1,313、関係1,725、施設1,680、座標確定施設13、確認済み関係21、座標確定施設との確認済み関係15。監査行1,313/1,725を座標確定件数と呼ばない。抽出関係なしの6カードも監査カード行に未解決として残る。

## 新設・移転

schema 1の任意フィールド `relations[].change` で明示的追加を扱う。

```json
{
  "kind": "addition",
  "reason": "公式告知に基づく新窓口への移転。旧窓口は別の終了根拠で訂正",
  "previousPlaceIds": ["place:旧抽出ID"],
  "raw": ["公式告知の該当原文"]
}
```

これはrelationの `change` の値。relationには通常のcardId、placeId、sourceHash、status、evidenceも必須。新facilityはlegacyIdsを空にできるが、この追加関係による参照が必須。旧関係の参照は同じカードについて検証する。純粋な新設はpreviousPlaceIdsを空配列にする。追加元の原文と履歴を生成データにも残す。旧関係は自動で終了・削除しない。旧関係の終了・休止には独立した原典根拠の台帳行を付ける。未確認の新住所はcoordinateを省略し、旧施設の座標や住所代表点を流用しない。

同一カード・同一施設の複数期間は依然1関係では表現できず、競合扱い。今回追加した履歴は代替先の自動推定・旧関係の自動置換ではない。

## CIと親の残作業

既存の `go test ./...` に合成fixtureのマージ衝突・根拠・追加履歴・監査・現一覧変更失効・index誤適用防止テストを追加。チェックイン済み地域fragmentはネットワークなしでデコード、競合、関係施設参照、根拠ファイルhash、URL、期間を検査する。全件素材に依存する参照検査は親のbuilddata実行で行う。

municheckはOCRの画像名と一覧画像名、住所sourceの施設名・住所・条件・借用フラグを一覧の該当行・場所と比較し、不一致なら停止する。新一覧のindexへ古いgeocodeを適用する運用を禁止する。

親は8地域の成果を待ち、上記CLIを実データで実行し、地域調査台帳との網羅・未解決理由を突合する。20変更カードと10番号候補の根拠確認、新旧関係の整合、休止期限を独立レビューする。全国非画像snapshotの追跡化は別途選定し、今回巨大な全件素材は追加していない。コミット・push・PR・公開はこの実装担当では行わない。

設計文書の「原典にない新設・移転関係は今後拡張」はこの追加履歴実装により更新した。その他、今回見つけた既存コードとの文書不一致はない。

## 独立レビュー後の修正

- 現一覧の指紋が変わり、現情報に基づく再確認が済んでいないカードは、台帳未登録でもカードと蓋ピンの旧状態を要確認に戻す。原文は保存し、最新の根拠で全関係を再承認した場合は承認状態を使う。実データの11-242-B001、13-214-E001、22-215-A001、38-202-B001で旧activeが残らないことを確認。
- 住所sourceは生成側の仕様に合わせ、複数住所を ` / ` で分割した要素との完全一致で検証する。住所の部分一致・別の住所は許可しない。
- 移転履歴の `previousPlaceIds` は生成後のcanonical施設IDへ正規化する。入力台帳の旧IDは変更せず、原典上の参照と配信用の参照を両立する。

3件とも失敗する回帰テストを追加してから修正した。複数住所と移転履歴について見つかった文書・実装の不一致も上記の動作へ揃えた。
