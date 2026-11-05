# 南関東座標追補：cardId 13 / 00

2026-11-05、AIによる公式資料の追加調査。現地確認・人による確認ではない。

成果: `data/national/location-updates/kanto-south-tokyo.json`。対象は元地域fragmentの未位置102施設（105関係）。77施設（79関係）に建物地点を追加提案、25施設（26関係）は未解決。元地域JSON・台帳・UIは変更していない。commit、branch、push、PR操作なし。

## 確認方法

元配布案内を再利用し、東京都観光案内窓口詳細、自治体施設アクセス、施設運営者の地図、自治体公共施設CSV、東京都公開アセットDBの建物行まで調査した。建物名・住所と既存配布窓口を照合。Google Mapsでは数値destination/q、明示placeマーカー、車経路の終点を区別し、viewport中心・蓋の地点・住所ジオコード代表点は不採用。羽村市XMLのPlacemark座標は同市配信JavaScriptのCreateMarkerへの接続も確認。

`scope: building` は階・室内受付・入口の正確な位置を保証しない。複数窓口のある同一建物には同じ建物の根拠を共有。移転先を旧facilityに推測で上書きしていない。確定した新施設移転proposalなし。

未解決理由はpatchおよび `unresolved-notes.json` に個別記載。主な外部制約はCADANアクセスのHTTP 500、虹の下水道館公式サイトのTLS取得失敗、虹の下水道館・旧三河島の公式リンク先Google MapsのHTTP 429。制限回避・再試行の反復は行っていない。ほかは表示中心しかない埋込、広い公園等の中で窓口建物を特定できない資料、対象施設の公的地点データ不足。

## 根拠ファイル

- `manifest.json`: URL、実取得時刻、HTTP状態、最終URL、原本bytesパス、SHA-256。拡張子`.html`でもCSV/XML/PDFの場合がある。bytesは変換せず保存。
- `reused-*`: 元担当のキャッシュbytesをコピー。同じURLは再fetchせず、元取得日時を維持。`reusedFrom`で出所を記録。
- 4件の取得日時は、初期取得時のmanifest並行書込競合を検出したため、保存原本のmtime（書込完了時刻）で復元した。`timestampNote`に明示。対象は千駄ヶ谷区民会館、立川市役所、東大和市郷土博物館、東久留米市市民プラザのページ。URL・HTTP成功は取得ログ、値とSHAは原本で照合。
- `targets.json`: 対象施設と既存配布案内。`jobs.json` / `extra.json` / `map-links.json`: 調査先一覧。
- `decisions.py`: 手動照合した採用判断。`build.py`: 指定箇所の座標を原本から抽出。
- `review.json`: 各採用値・原典locator・本文。`validation.json`: 検証結果。

原本を一次根拠とし、`.txt`は補助抽出。大きなCSVの冗長な`.txt`複製は削除したが、CSV原本bytesは保持している。

## 検証

リポジトリルートで:

```sh
uv run --with beautifulsoup4 --with requests python data/evidence/national/kanto-south-locations-tokyo/validate.py
```

ネットワークを再取得せずに原本から77件を再抽出。102件の対象ID完全一致・重複なし・既存座標上書きなし、389保存原本エントリのSHA、採用座標数値の原本対応を検証済み。XML座標はElementTreeで抽出するため、補助本文用BeautifulSoupのXML警告は座標抽出に影響しない。

注意: 町田市公共施設CSVの独立した番地列には日付形式への誤変換が見られる。採用時は正しく保たれた所在地連結列（森野2-2-22）を照合した。サザンスカイタワー公式トップとアクセスページのマーカーは約36m異なり、トップの建物代表点を採用しevidenceに差を記録した。ドキュメントと既存コードの食い違いは発見していない。
