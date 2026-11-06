# Issue #5 全国未表示配布施設の監査（README）

監査には公開JSONではなく、`python3 -B tools/build-real-data.py` が生成する `data/work/internal-data/full.json` を使う。公開用は表示項目のみで、根拠・入力情報を省いている。台帳を指定する場合は同じ入力から `tools/national/assemble.py --out data/work/assembled-ledger.json` で生成する。

`tools/national/coverage.py` は Python 3.9 以降の標準ライブラリのみを使うオフライン監査 CLI。生成済みの内部用 `data/work/internal-data/full.json` と、その生成に使用した assembled ledger を入力とする。元データ・台帳・位置の承認を変更せず、JSON を出力する。リポジトリ root で実行する。

```sh
python3 -B tools/build-real-data.py
python3 -B tools/national/assemble.py --out data/work/assembled-ledger.json
python3 -B tools/national/coverage.py \
  --full data/work/internal-data/full.json \
  --ledger data/work/assembled-ledger.json \
  --out /tmp/current-coverage.json

python3 -B -m unittest discover -s tools/national -v
go test -count=1 ./...
```

`--full` の既定値は `data/work/internal-data/full.json`。`--out` 省略時は標準出力。既存出力への上書きは拒否し、親ディレクトリは作成しない。入力の SHA256 と `full.evaluatedAt` を記録する。実行時刻・絶対パスを埋め込まないため、同じ入力 bytes から同じ出力を再現できる。基準 JSON は固定し、最終監査は別のパスへ出す。`data/work` の基準入力は CI の前提にせず、テストは合成 fixture と収録済み監査 JSON を読む。

## 数え方

全国カード数は `full.cards` の unique ID 数であり、蓋ピン数ではない。施設は `full.places` の unique ID 数。名称が似ていても推測で統合しない。原文解析由来の未確定 place ID と承認済み facility ID の両方を含むため、実在施設の確定総数とは異なる。

`rawRelationRows` は生成 full の関係行数であり、HTML 原本の施設数ではない。承認済み addition も含む。`uniqueCardPlacePairs` は cardId/placeId の組数。同じ組の raw 行が複数あれば `duplicateRelations` に残す。異なる raw 文面でも review/status が同じなら一組に数え、異なる場合は監査を失敗させる。raw の出所を捨てる変換ではなく、入力 SHA256 と関連 ID から full に戻れる監査である。

配布確認は関係単位の `review == verified` で判断し、状態は別軸の `active / suspended / ended / unknown / upcoming`。Go は `upcoming` も出すため、省略したり unknown に丸めたりしない。`verified` でも状態 unknown は存在する。`knownStatusVerifiedUniquePairs` ではこの unknown を除く。raw 行、unique 組、verified 組、位置あり verified 組それぞれの状態内訳を出す。カード全体の `status` は `sourceCardStatus` として保存するだけで施設の配布確認に流用しない。

座標確認は full の `coordinate.status == confirmed` と有限・範囲内の lat/lng が必要で、同じ座標が ledger に承認済みとして存在することも照合する。candidate の数値座標だけでは確認済みにしない。未採用の位置提案は読まない。承認は入力 ledger の作成工程の責任であり、監査自身が manifest を検査して承認を追加することはない。

表示は Go の `appendPlacePins` に合わせ、位置確認済み施設と verified 関係の組で判定する。実際の `kind=place, reference=false` ピンの cardIds と完全一致することを検査する。ピンの座標も承認済み施設座標と照合し、状態は対象のverified関係がすべて同じならその状態、それ以外はunknownとして検査する。蓋・参考ピンは対象外。休止・終了・unknown の verified 関係も Go の配布ピンになる。UI の選択状態、検索、絞り込み、画面内の可視性は監査しない。

`activeLocatedCards` と `activeLocatedPlaces` は確認済み active 関係と承認済み位置が揃う unique 数。受取可能件数ではない。営業時間、休日、条件、在庫の変動、施設代表点と実際の窓口位置の差、現地確認の有無を保証しない。

## 未表示一覧と配布未確認の区別

`relations` は unique 組ごとに ID、raw 行数、状態、配布確認、位置確認、表示、理由、proposalAddition を保持する。`places` と `cards` に関連 ID を集約し、`undisplayedPlaces` はピン自体がない施設、`undisplayedCards` は配布ピンに一度も出ないカードの一覧。同じ施設が別カードでは表示される場合、その施設は前者には入らず、`places[].undisplayedCardIds` と `relations[].displayed` で不足を追う。

施設の `gapClass` は次の優先順で排他的に分類する。施設に複数カードがある場合、一件でも配布未確認なら配布未確認側に入れる。

- `evidence_backed_distribution_unconfirmed`: 公式確認の台帳・生成物に evidence があるが、未検証関係または状態 unknown が残る（関係なしも含む）。位置が確認済みでも該当する。
- `distribution_unconfirmed`: 同じ配布未確認で、根拠 evidence がない。
- `location_only_unconfirmed`: 全関係が verified かつ既知の状態で、位置だけ未確認。休止・終了・開始前も含むため、active 件数には読み替えない。
- `none`: 上記の不足なし。終了済みでもこれに入る。

ここで evidence の存在は「採用済み根拠がある」という意味。URL の政府ドメイン判定で公式性を推測せず、保存原本の内容・hash・公式性は既存 assemble/builddata の検証とレビューを前提とする。座標の evidence は配布の根拠とは限らない。`evidenceBacked` 単独では配布確認にしない。期限切れや sourceHash 変化で失効した関係は、ledger の昔の active に戻さず、full の needs-review/unknown を採用する。この CLI は基準日を進めない。日付変更後の監査では先に Go で full を再生成する。

カードは `displayCoverage = all / partial / none`。一施設でも表示されれば `displayedCards` に入るが、全施設表示とは分ける。全関係 verified、少なくとも一関係 verified、unknown が一つでも残るかも独立して出す。関係ゼロのカードは vacuous truth で全確認扱いにせず、`no_relations` と unknown を記録する。

理由コードは `location_unconfirmed`、`distribution_unverified`、`distribution_status_unknown`、`distribution_suspended`、`distribution_ended`、`distribution_upcoming`、`no_relations`。状態の理由は表示を妨げる条件とは限らない。各行の displayed と併読する。

## 地域担当の ID 集合

地域は施設 ID の接頭辞・名称・住所ではなく cardId 先頭の県コードで決める。01–07 north、08–11 kanto-north、12–14 kanto-south、15–20 chubu-east、21–23 chubu-west、24–30 kinki、31–39 chugoku-shikoku、40–47 kyushu-okinawa。県コード00は今回の調査担当に合わせ `kanto-south` に含める。地理上の所在地を推定した分類ではない。

`regions.<地域>.unlocatedPlaceIds` は raw 未確定施設も含む未位置集合。位置追補の対象となる既存 ledger 施設に絞る場合は `unlocatedLedgerPlaceIds` を使う。いずれも追加 proposal を含む。施設が複数地域のカードに関係すれば双方に出るため、地域施設数の単純合算は全国 unique 施設数にならない。カードと関係組は地域ごとに排他的である。

件数と対象IDは実行結果から取得する。カード未収録、施設未位置、配布未確認は別に集計する。監査は原文抽出や実在施設の同一性を再調査するものではない。
