# Issue38 北陸の位置調査・第2弾

基準 `f66b7e994ef250fadee78f396d22fdfc40ba6a83`、評価日2026-11-05。北陸の残件32施設を分類し、8施設を選定した。数値手掛かり1、採用提案0、採用0、保留8。manifest、台帳、配布関係、既存ピンは変更していない。binding追加なし。

[選定と全32施設の除外理由](../../data/national/location-batch2/hokuriku/selection.json)は実査前に保存した。Issue24のoriginalRefが北陸原記録を指す集合と第1弾baselineを照合し、現assembleでも全32施設が未位置だった。全国608はこの基準manifestの台帳内未位置であり、生成全体の未位置数や他地域PR採用後の見積りではない。地域の内訳はactive30、ended-only1、suspended1（保存済み優先順位の分類）。8選定以外の24施設は旧保留を保持する。既採用の除外は0。全地域の最新在庫を再確認したという意味ではない。

第1弾integration/followups、Issue20と25〜27の停止条件を参照した。これらの特別保留対象との重複はない。Issue7からの北陸保留を、新庁舎竣工資料、公共施設管理資料、再整備配置図、寺院公式配置図、GSI試験Vectorという別資料・手法で調べた。旧P05全走査や配布HTMLの再取得だけを繰り返していない。

## 8施設の到達点

全ID、参照、停止・再開条件は[outcomes.json](../../data/national/location-batch2/hokuriku/outcomes.json)に保存した。以下の名称順はselectionの順序に一致する。

- 佐渡市役所総合案内窓口／宿日直室の2施設：市の竣工案内で第1庁舎と旧庁舎を改修した第2庁舎を区別できた。旧P05点は探索範囲にのみ使用。取得タイルの西端に外形が接し、新庁舎全体の結合・独立対応は未完。西隣タイルと竣工配置・道路配置の照合が次工程。室内窓口測量を求める保留ではない。
- 佐和田市民センター／佐渡中央会館の2施設：管理計画から中央会館の離島開発総合センターと旧圏民センターの区別が得られた。P05周辺の外形は取得したが、旧GISとの約500m競合は解消できない。法テラスの移転工事仕様書は直接取得404。棟名付き配置資料と旧GISの対象説明を待つ。
- 輪島市上下水道局：市の別施設詳細から、地図中心とは異なるmarkerInfosの数値を発見した。[数値候補](../../data/national/location-batch2/hokuriku/candidates.json)に原桁数で保存。CRS・作成方法と独立した建物対応が未確認で、Vectorへの包含を採用根拠にしない。
- 一乗谷朝倉氏遺跡復原町並：公式ポータルのマップはGoogle埋込、市の別周辺図は広域図だった。南北のチケット売場棟の特定には不足。遺跡中心・駐車場の点で代用しない。
- 朝日みどりの里物産会館：整備前と整備後の配置図、運営者の渡廊下案内を取得。旧物産会館と新販売棟を区別できたが、現況外形との地理参照は未完。計画棟を現在の配布先にしない。
- 勝興寺：寺院公式の伽藍配置図は文化財13棟を区別するが、拝観受付棟を明記しない。本堂・総門・境内中心で代用せず、受付棟を明示する管理者資料を待つ。

佐渡、村上等の新資料は原調査を上書きするものではない。関係・住所の訂正を裏付ける確定的な新旧対応は今回得ていないため、exact patchも追加しない。

## 原本・利用条件・検証

[証拠README](../../data/evidence/location-batch2/hokuriku/README.md)、[取得記録](../../data/evidence/location-batch2/hokuriku/retrievals.json)、[事実抽出](../../data/evidence/location-batch2/hokuriku/facts.json)にURL、取得UTC、hash、版、頁、加工、制約を記載した。一般HTML/PDF/画像の原本はignored workに保持。Gitには事実抽出と取得hash、および出典・利用条件を確認したGSIの圧縮3タイルのみを収録する。基本測量成果ではない試験VectorとPDL1.0の出典・加工表示を確認し、ラスターと同じ条件とは推測していない。

地域共有の調査実測は[timing.json](../../data/national/location-batch2/hokuriku/timing.json)の388.884秒。選定保存から結果記録までのwall clockで、初期読込・後続検証・独立レビュー・PR作業は含まない。施設ごとへの重複加算、全国への所要時間外挿はしていない。

`verify.py --raw` で原本等26ファイルのhash/bytes、全32施設の母集団、選定8ID、旧JSON参照、現assembleと開始時台帳の全フィールド一致、manifest不変を検査した。`verify.py` はignored原本を要求しない再現検査。`check-vector.py` は3タイルの復号・extent・地物数（佐渡53、佐和田302、輪島406）と未採用を照合する。

研究のみの変更で、アプリ・生成処理の挙動やmanifestを変更していない。追加検証としてPython全国テスト92件が成功した。commit時の必須フックを省略せず、`mise exec --` 環境の `go test -count=1 ./...` も成功。実データのGo builddata再生成、全国生成監査、full/details/pins・Mapsのブラウザー確認、UI全体テストは再実行していない。現地確認、在庫、サービス上の到達地点、CRS不明マーカーの測位精度は未確認。派生代表点がないため重心・丸め後内包検査は非該当。

既存コードと現行手順の新たな不一致は見つからなかった。過去のレビューにあるAGENTS.md未存在や採用件数は当時の記録として扱い、現在へ持ち越していない。

## Gemini独立レビュー

指定のAntigravity / Gemini 4 Argonへ読み取り専用の独立レビューを依頼したが、期間クォータ上限により失敗した。エラーは `You have reached your Antigravity quota for this period.`。レビューは未完了で、重大指摘0件や承認済みとは扱わない。代替モデルは使用せず、採用0・保留8を維持する。[試行記録](../../data/national/location-batch2/hokuriku/review.json)を保存した。クォータ回復後の独立レビューが残るためPRはdraftとする。
