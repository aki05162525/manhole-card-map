# 埼玉 tourism 8施設の調査引継ぎ

基準日2026-11-05を保持。全8施設で現公式案内・既往履歴・原本の記載範囲・9近傍タイルを実調査した。採用未承認、manifest未反映。候補4件はlocations/location-lifecycle/selection-proposal.json。outcomes.jsonは旧place/relationsとdigest、全履歴、取得metadata、施設別画像読解範囲、数値対応、残る理由を保持する。

|施設|結果|
|---|---|
|ぱりっせ|公式館内図のコミュニティ棟と西側外形4139を照合、候補|
|野老澤町造商店|現移転先・店舗外観・商店街A/B/C地図を確認。模式図/正面写真と独立外形の対応未確定|
|日高市浄化センター|公式配置図の管理本館1476。配布棟は親経由の利用者回答として分離、候補|
|熊谷駅観光案内所内|2025移転後構内図と駅舎/ホーム屋根を比較。旧びゅうプラザの外郭区分が未確定|
|飯能観光協会|建築事例集の西棟1F観光協会とU形4004を照合、候補。数値601.6㎡と建築面積544.76㎡差は残す|
|Yotteco|2023/2024公式航空写真・建物写真と比較。取得GSI版は再開発前道路/小棟配置で現棟を対応できず|
|吉見百穴|洞穴写真・資産表120.20㎡管理事務所と現案内を取得。利用者回答で正門券売管理事務所と判明。数値1257等との対応が残る（回答待ちではない）|
|越谷観光協会|北記号/縮尺付き公式町名図の独立棟と池南東岸の湾曲外形2226/2544、国交省外観写真を比較、候補|

数値原典は同一ETag/Last-ModifiedのPMTiles Range取得。8施設×9タイル計72 PBFを保存。各geometry.jsonにsourceTile/BldA index/properties/rawhash/面積/7桁丸め前後内包を保存。越谷の2fragmentは重複bufferをunionすると単一Polygon、約446.88㎡。西側fragment内点を候補にし、隣棟を結合していない。面積はWeb Mercator緯度補正の外形面積で、建築/床面積と同一扱いしない。製品固有CRSの適用解釈は県common-followup参照、独立承認未実施。

原本一般rawはignored work/cacheのみ。retrievals.jsonに原本hash・取得URL・実取得日時、成功/404/403を残す。HTML/PDF本体をGit/配信に混ぜない。数値PNGはGSI加工図で、一般原本画像ではない。研究用render.pyは内孔を白抜きする。局所PNG/SVG/combined.jsonはignored workにあり、数値geometryとPBFで再現可能。

施設別実作業intervalはevidence側timing.jsonに開始/終了時に記録。共有整形・計算・検証は施設へ後付け配賦しない。intervalにはコンテキスト圧縮/親との連絡も入り得るので純粋作業秒数とは言わない。

吉見の開場時間改定とカード案内の不一致、熊谷現公式同士の住所差、吉見敷地324/管理棟327の差はrelationship-proposals.jsonへ分離。配布関係の自動修正なし。飯能建築事例集の本文延床755.1㎡と巻末738㎡の原本内差も残す。現時点で文書と共通実装の新たな不一致は発見していない。

ローカル検証はevidence側validate.py、validation.log、validation.json。8ID一致、原本hash、旧値digest、候補binding、72 PBF decode/hash、Range応答範囲、同一版、丸め内包を検証し終了0。validation.jsonのheadは検証時HEADで研究未commit差分はinputSHA256に固定。原本同定・CRS承認・全suite/フック・独立レビューはこの検証で代替しない。県親が統合検証を行う。子ではcommit/push/共有ファイル変更なし。

吉見の2026-11-06利用者回答はreportedAtを別フィールドで記録し、研究基準日2026-11-05を置換していない。回答後に69頁の施設計画を検索し、120.20㎡木造管理事務所を再確認、数値5棟の面積/道路を再比較。最も面積が近い1257を自動選択しない。用途の再質問は不要。
