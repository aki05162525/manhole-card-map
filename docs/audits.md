# 監査ツール

| 知りたいこと | ツール | 入力 | 主な出力 |
| --- | --- | --- | --- |
| 配布施設・カードの表示被覆 | `tools/national/coverage.py` | 内部 full、表から書き出した台帳 | 表示・未表示、確認状態、地域別ID |
| 台帳の表から導く件数と再確認の一覧 | `tools/db/ledgerdb.py summary` | `data/db` の行ファイル、基準日 | 位置・配布関係・調査記録・位置の候補・再確認の候補・利用者の回答・出典の点検の件数、期限を過ぎた行（[集計](database-design.md#集計)） |

## 共通の前提

監査には公開JSONではなく、`python3 -B tools/build-real-data.py` が生成する `data/work/internal-data/full.json` を使う。公開用は表示項目のみで、根拠・入力情報を省いている。

リポジトリルートで実行する。どちらもオフラインで動作し、元データ・承認・配信資産を書き換えない。入力不足時にfixtureへ置き換えない。件数は対象集合と基準日を添えて実行結果から取得する。

## coverage.py：表示被覆

```sh
audit_out=$(mktemp -d)
python3 -B tools/build-real-data.py
python3 -B tools/db/ledgerdb.py export-ledger --out "$audit_out/ledger.json"
python3 -B tools/national/coverage.py \
  --full data/work/internal-data/full.json \
  --ledger "$audit_out/ledger.json" \
  --out "$audit_out/current-coverage.json"
```

`--out` を省くと標準出力へ出す。既存のファイルと入力ファイルには書かない。

### 数え方

入力を検査し、不正なら失敗する。

全国カード数は `full.cards` の unique ID 数であり、蓋ピン数ではない。施設数は `full.places` の unique ID 数である。名称が似ていても推測で統合しない。原文解析由来の未確定 place ID と承認済み facility ID の両方を含むため、実在施設の確定総数とは異なる。

配布確認は関係単位の `review == verified` で判断し、状態は別軸の `active / suspended / ended / unknown / upcoming`。Go は `upcoming` も出すため、省略したり unknown に丸めたりしない。`verified` でも状態 unknown は存在する。raw 行、unique 組、verified 組、位置あり verified 組それぞれの状態内訳を出す。カード全体の `status` は `sourceCardStatus` として保存するだけで施設の配布確認に流用しない。

座標確認は full の `coordinate.status == confirmed` と有限・範囲内の lat/lng が必要で、同じ座標が ledger に承認済みとして存在することも照合する。candidate の数値座標だけでは確認済みにしない。承認は台帳の表で行い、監査自身が承認を追加することはない。

`activeLocatedCards` と `activeLocatedPlaces` は確認済み active 関係と承認済み位置が揃う unique 数。受取可能件数ではない。営業時間、休日、条件、在庫の変動、施設代表点と実際の窓口位置の差、現地確認の有無を保証しない。

### 未表示一覧と配布未確認の区別

施設の `gapClass` は次の優先順で排他的に分類する。施設に複数カードがある場合、一件でも配布未確認なら配布未確認側に入れる。

- `evidence_backed_distribution_unconfirmed`: 公式確認の台帳・生成物に evidence があるが、未検証関係または状態 unknown が残る（関係なしも含む）。位置が確認済みでも該当する。
- `distribution_unconfirmed`: 同じ配布未確認で、根拠 evidence がない。
- `location_only_unconfirmed`: 全関係が verified かつ既知の状態で、位置だけ未確認。休止・終了・開始前も含むため、active 件数には読み替えない。
- `none`: 上記の不足なし。終了済みでもこれに入る。

URL の政府ドメイン判定で公式性を推測せず、原本の内容と公式性はレビュー、hash の形式は表と builddata の検査を前提とする。座標の evidence は配布の根拠とは限らない。`evidenceBacked` 単独では配布確認にしない。期限切れや sourceHash 変化で失効した関係はledger の昔の active に戻さず、full の needs-review/unknown を採用する。

全関係 verified、少なくとも一関係 verified、unknown が一つでも残るかも独立して出す。

### 地域担当の ID 集合

地域は施設 ID の接頭辞・名称・住所ではなく cardId 先頭の県コードで決める。地理上の所在地を推定した分類ではない。

`regions.<地域>.unlocatedPlaceIds` は raw 未確定施設も含む未位置集合。位置追補の対象となる既存 ledger 施設に絞る場合は `unlocatedLedgerPlaceIds` を使う。地域をまたぐ施設は重複するため単純合算しない。

## ledgerdb.py summary：表の件数

```sh
python3 -B tools/db/ledgerdb.py summary --as-of 2026-11-06
```

出力の項目と数え方は [集計](database-design.md#集計) にある。公開データとの突き合わせはしないので、表示の有無は coverage.py で数える。
