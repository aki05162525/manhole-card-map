# 近畿・配布施設の位置追加調査（2026-11-05）

対象は確定済み `data/overrides/regions/kinki.json` の座標未設定施設206件。元fragment・元監査・条件・配布状態は変更していない。結果は `data/national/location-updates/kinki.json` に31件のupdates、175件のunresolvedとして収録した。全206件を一度ずつ収録し、採用関係のfacilityIdと照合した。未解決は「位置情報が存在しない」という断定ではなく、今回保存した原典で目的地点を確定できなかったという調査結果である。

採用した点は施設・建物の代表点であり、室内窓口の位置ではない。すべてAIによる原典照合で、現地確認・人の確認ではない。Google埋込の `!1m3!1d...!2d...!3d...`、`@lat,lng`、`ll` は表示中心なので不採用。明示q、placeの!3d/!4d、Marker.position、施設データのgeo等を施設名・現住所と照合した。配布原典の数値位置であっても、蓋を指す高石・田原本・橿原などは不採用。

主な補充には栗東市役所2窓口、藤井寺市役所2窓口、洲本市役所2窓口、太子町役場2窓口、交野市水道局、堺東観光案内所、甲賀流リアル忍者館、川西公民館、五色塚古墳館が含まれる。洲本はHTMLのinitlat/initlongが公式JSのMarker.positionへ渡ることを確認した。柏原は地図centerと別のmarkerInfosを採用。五色塚古墳館は市公式リンクからHTTP 200で取得した地図の目的地点を使用し、古墳本体を使用していない。

`proposal-candidates.json` は関まちなみ資料館と島本町上下水道部庁舎の別施設候補。legacy IDを添えたが、旧facilityへの座標更新には混ぜていない。proposal担当による現在住所・窓口・関係の確認が必要。伊丹旧駅構内施設、橿原華甍についても移転先の地点を流用していない。御坊は同一敷地の建替え前後の地点同定が未完なので保留した。

## 原本と探索記録

- `targets.json`: 元fragmentの未位置206施設を凍結した対象リスト。
- `research-index.json`: 施設ごとの元原典・施設案内・アクセス等の探索リンク。共通フッターの他施設も含む探索ログであり、採用根拠リストではない。
- `manifest.json`: 取得URL、最終URL、実取得日時、HTTP状態、原本パス、SHA-256。元地域キャッシュは再GETせずbytesを本ディレクトリへコピーし、元取得日時、reusedFrom、reusedManifestを保持。新規取得ではホスト毎約1.1秒の間隔、通常TLS検証を使用した。拒否・TLS異常は回避していない。失敗原本・無関係と判明したページも取得経緯のため保存した。
- `map-links.json` / `map-resolutions.txt`: 公式ページの短縮地図リンク調査。多くは429で不採用。拒否ページのcontinueパラメータ内座標を採用していない。
- `decisions.py` / `coordinate-review.json`: 採用31施設の数値と施設同定の個別記録、原典抜粋。数値が原本にあるだけでは同定とはみなさず、判断はdecisionsに明記。
- `digest.txt` / `candidates.json` / `strict-review.txt` / `js-review.txt`: 探索用の候補抽出。別施設・蓋も含むためそのまま採用不可。candidatesはviewport座標を除外済み。
- 各unresolved.attempts: 個別に取得・確認したURLと結果。理由には別施設、移転、蓋、建替え、取得制限などを記録。

## 再現と検証

リポジトリルートで次を実行する。ネットワークアクセスは発生しない。

```sh
python data/evidence/national/locations-kinki/build_updates.py
```

このスクリプトは本担当の結果ファイルと根拠ディレクトリのみを書き、保存原本・手動判断からupdates/unresolvedを再生成する。全対象の排他・網羅、元fragmentのID、全manifest原本のSHA-256、採用数値の原本内存在と緯度経度順を検査し、`validation.json` を出力する。施設名・住所と数値の意味的な照合結果は `coordinate-review.json` を親担当がレビューする。再取得したい場合の研究コードも保存したが、原典が変化するためネットワーク再実行はオフライン再現とは別扱い。

Go/UI・全国統合・PRは担当外。ドキュメントとコードの不一致は本調査では検出していない。
