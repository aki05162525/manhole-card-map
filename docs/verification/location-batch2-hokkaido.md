# 第2弾・北海道（Issue33）

基準は `f66b7e994ef250fadee78f396d22fdfc40ba6a83`、評価日は2026-11-05。北海道の全残件38施設から8施設を選定した。札幌市下水道科学館1施設をOpusの独立レビュー後に採用し、7施設は保留。[最終レビュー記録](../../data/national/location-batch2/hokkaido/review.json)に採否と指摘対応を保存した。

[selection.json](../../data/national/location-batch2/hokkaido/selection.json)を調査前に保存し、Issue24のoriginalRef、batch1 baseline、現assembleを照合。38件すべてが未位置で、既採用の混入なし。全件の障害分類・既存レビュー参照・非選定理由を保持した。稚内新庁舎2施設はIssue20の保留を維持。第1弾integration/followups、Issue25〜27の保留対象は今回8IDと重複しない。同住所だけで窓口を統合していない。全国未位置608は開始時の台帳集合で、生成全体の未位置件数ではない。

## 8施設の到達点

個別ID・出典参照・停止/再開条件・地域共有の実測秒数は[outcomes.json](../../data/national/location-batch2/hokkaido/outcomes.json)。共有資料の取得待ちを含むwall clockを8施設へ重複配賦しない。準備・後続検証・Gemini・PR作業はその計測外。

| 対象 | 件数 | 今回の別資料・別手法と判断 |
| --- | ---: | --- |
| 古平かなえーる2階建設水道課・1階管理室 | 2 | 国交省ZEB事例集の名称付き平面とGSI南隣タイルを照合。矩形外形候補は得たが、道路・周辺建物との対応が不足。旧P05点を流用しない。 |
| 東神楽町役場建設水道課・守衛室 | 2 | 町パンフレットで中央庁舎・円環状回廊・中庭を区別。GSI旧役場点付近の外形は現図全体と対応付けられず。完成後外形の根拠待ち。 |
| 大通西7丁目ショップ | 1 | 市公共施設一覧に管理事務所(便所併設)、管理者本文にショップ併設。座標列なし。概略図のアイコンから接するGSI小外形56/57のどちらかを選ばない。 |
| 大通西3丁目観光案内所 | 1 | 管理者図の北側案内所と南側トイレを区別。探索タイル内の小棟を一意に選べず、詳細な外形図/名称付きGIS待ち。不存在とは主張しない。 |
| 札幌市下水道科学館 | 1 | 令和4年5月の市工事配置図とGSIの円弧棟・貯留管施設など周辺施設を照合。独立した建物対応を根拠に重心を採用。 |
| 北斗市観光案内所（本館1階） | 1 | 市の2015年会議資料と現市施設案内を照合。旧計画の2階案内施設を根拠に現配布記録1階を書き換えない。ホテル別館・駅全体点を代用しない。 |

札幌公共施設一覧は一般会計の建物が対象で、企業会計を除く。科学館の独立原典にはならず、市工事図へ切り替えた。検索に現れた令和6年度工事PDFは404、別の令和4年度原本を取得した。未取得資料を確認済みと扱っていない。

## 科学館の採用

対象IDは `facility:north-53b2b9df9a8da2705261`。市の配布案内を2026-11-05に取得し、現配布先を確認。2022年5月の工事配置図1頁は、創成川水再生プラザの端に科学館を名称付き円形棟として描く。方位を補正すると科学館円形棟の北側部分がGSI BldA外形476/13に対応する。接する貯留管施設は185/186、融雪監視室は187、雨水ポンプ施設は189/190に対応する。図自体に「創成川通」という名称表示があるとは主張しない。旧H25施設点は探索範囲のヒントにのみ用い、採用座標を転記しない。

採用点は緯度43.1170659・経度141.3425854。[原外形・仕様](../../data/evidence/location-batch2/hokkaido/candidate-input.json)、[派生計算](../../data/evidence/location-batch2/hokkaido/derived-candidate.json)、[再現スクリプト](../../data/evidence/location-batch2/hokkaido/derive.py)を保存。北タイルの外形はy=4126まででバッファ切断線y=4176より内側に収まり、南隣タイルの同形部分13も照合した。ただしGSI外形は科学館円形棟の北側部分で、南東部を含まない。点が科学館棟内にあることと全棟外周の完全性を区別する。別棟185/186を結合しない。重心・7桁丸め後とも内包を検査。

GSIの2026-07-01版PMTilesから取得。個別建物の測量日は不明。国内JGD2011のWeb Mercatorタイル格子から逆投影し、測地系変換なしでlat/lngへ対応する。小数7桁は出力精度で、入口・室内位置の測量精度ではない。最適化Vectorは基本測量成果と位置付けない試験公開で、PDL1.0と出典・加工表示を確認した。ラスターと同じ条件と推定していない。

[location-proposal.json](../../data/national/location-batch2/hokkaido/location-proposal.json)は提案時点の原記録（pending-geminiや旧証拠表現を含む）として保持し、manifestからは選択しない。[locations-reviewed.json](../../data/national/location-batch2/hokkaido/locations-reviewed.json)が指摘を訂正した承認済みコピー。[location-lifecycle.json](../../data/national/location-batch2/hokkaido/location-lifecycle.json)のbindingは元行全体・identity・hashを固定する。manifestは承認済みコピーの1行を明示選択。全関係、既存ピン、施設名・住所・電話は変更しない。

## 原本と再配布

[取得記録](../../data/evidence/location-batch2/hokkaido/retrievals.json)にURL、UTC、hash、失敗を保存。[事実抽出](../../data/evidence/location-batch2/hokkaido/facts.json)は自作。一般HTML/PDF/GIFは再配布条件未確認のためignored `data/work/location-batch2/hokkaido/`のみ。GitにはGSI科学館PBFを出典・加工表示付きで保存。探索した他タイルとrange原本もworkに保持し、[range/hash記録](../../data/evidence/location-batch2/hokkaido/vector-exploration.json)を残す。

## 検証

- 対象施設だけの差分を期待するテストは追加前に失敗、仮統合後に成功。
- Python全93テスト、Go `-count=1` 全テスト成功。レビュー指摘反映後にも全93テストとGo全テストを再実行し成功。ログhashは検査記録に保存。
- 保存一覧20261021、review-list20261105、as-of2026-11-05でassemble→Go builddata→全国監査を実行。親rootの原本/補助入力をコピーしhashを維持、新取得とは呼ばない。
- [検査記録](../../data/national/location-batch2/hokkaido/validation.json)：科学館のcoordinate/evidence/locationReviewだけが台帳差分。全関係と既存ピン不変。full/details同一、pins.detailsSHA256と生成manifest各hash一致。
- 採用後は台帳未位置608→607、北海道38→37、施設ピン978→979。科学館以外の選定7施設は未位置を維持。
- 実データweb buildと型検査成功。MapLibre大チャンク警告は残る。UIコード変更なし。
- 実データブラウザー回帰はfull/splitとも成功。科学館の詳細と確定座標Mapsリンクを両モードで確認した（[記録](../../data/national/location-batch2/hokkaido/browser-verification.json)）。専用4183サーバーは検証後終了。現地・外部Maps上の到達、在庫の全件再確認、スマホ性能、同一origin旧新版保存更新は未確認。

共有ファイル変更はmanifestと `test_assemble.py`。旧844位置・履歴digest・第1弾差分の3テストを、location-batch2の選択/bindingを除いた履歴manifestへ限定した。digestや期待件数を新結果に書き換えていない。北海道固有テストは実manifestから自地域の選択だけを除いた前後差を比較する。

既存文書の第1弾844位置・978ピン・608未位置は履歴値として保持する。今回の採用後の値へ読み替えない。`location-proposal.json` のreviewStatusはassembleが検査するフィールドではなく、仮統合の未レビュー表示は機械的な採用禁止を意味しない。最終manifestは独立承認済みコピーを明示選択する。提案中の「隣接ポンプ施設」「建物全体」などの不正確な表現は承認済みコピーで訂正し、原提案は履歴として保持した。アプリ実装全体と全ドキュメントの網羅照合は実施していない。

## 独立レビューと対応

Gemini 4 ArgonはAntigravityの利用枠上限で起動失敗し、レビューを行っていない。利用者の明示許可を受けClaude providerのOpus 5.5へ切り替えた。[独立レビュー全文](../../data/national/location-batch2/hokkaido/review-opus.md)は候補採用可・7保留妥当と判断し、レビュー状態確定後のPRを承認した。重大指摘なし、中1件・低5件に対応。座標の変更はなく、レビュアーは再レビュー不要・修正後テスト再実行と指定した。

レビュー側は図と外形の方位・形状を独立に比較し、貯留管施設・融雪監視室・雨水ポンプ施設を区別した。証拠文と外形範囲を訂正して行hash・binding・manifest hashを更新。探索記録の採用なし表現と北斗GSI調査の定型文を訂正し、共通資料を優先した選定理由と旧snapshotフィールドの意味、規約/仕様へのJSON pointerを追記した。

最終再生成後にブラウザー回帰10ケースと科学館詳細/Maps2ケースを再実行し成功。ログはworkに保存し、browser-verification/validationにhashを記録。専用4183サーバーは終了済み。
