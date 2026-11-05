# 岐阜・静岡・愛知の配布窓口調査（2026-11-05）

対象は不変入力 `data/work/national-input/full.json` のカードID先頭21～23、123カード・165配布関係。全件を現在GKP行・リンク取得結果と照合し、カードごとの採否と未解決事項を記録した。**全件確定ではない。** AIによる原典照合であり、人・現地確認ではない。

## 成果と確定範囲

- 現在GKP行の照合：123/123カード。配布時間の文字列は空白差を除いて基礎入力と一致。
- 公式配布案内から台帳採用：72カード、89関係、87施設。
- 公式目的地座標を採用：16施設（16関係）。建物代表点。室内の課・当直室そのものの座標ではない。
- 配布情報の監査：76関係verified、13関係partial、76関係pending。89採用関係には時間不明や原典間の注記を保持する13関係を含む。
- カード全体の監査：10 verified、62 partial、51 pending。位置・配布条件を合わせて未解決なのは113カード。座標未確定149関係。
- 独立取得238 URL、HTTP 200は168、その他70。すべてのレスポンス原本238件をハッシュ付き保存。HTTP 403/404原本も取得結果の証拠として保持し、承認には使わない。

## ファイルと再現

- `data/overrides/regions/chubu-west.json`：schema 1台帳fragment。
- `data/national/regions/chubu-west.json`：123カード・165関係の全件監査。実際のURL・取得結果・原本・未解決理由・検索補助記録・新窓口proposalを収録。
- `manifest.json`：実際のネットワーク取得開始日時（UTC）、要求URL、最終URL、HTTP結果、原本の保存先・SHA256。
- ハッシュ名 `.html`：取得レスポンスbytes。その隣の `.txt` は読み取り用の派生テキストで原本ではない。HTMLは既存 `.gitattributes` の `-text` 対象で改行変換なし。
- `gkp-current-design.html`：指示で提供された `/tmp/gkp-current-design.html` の原本コピー。地域班からGKPへ再取得していない。親の取得日2026-11-05を記録し、地域班が把握していない取得時刻を捏造しない。`gkp-rows.json` にSHA256・123行・取得由来を保存。
- `search-*.json`：代替公式資料を探した検索結果。個別取得時刻未保存。検索スニペットは原典として承認せず、確認すべき不一致の手掛かりに限定。
- `decisions.py`：カード別の明示的採否、訂正、保留理由、目的地座標locator。
- `build_fragment.py`：不変入力と明示判断からfragmentと全件監査を再生成。`python data/evidence/national/chubu-west/build_fragment.py`。
- `validate.py`：全件網羅、重複・孤立ID、sourceHash、238原本SHA256、座標の原典内存在を検証。`python data/evidence/national/chubu-west/validate.py`。結果は `validation.json`。
- `collect.py`：URLキャッシュ、ホスト内1.1秒間隔、原本保存。`uv run --with requests --with beautifulsoup4 python .../collect.py [URL ...]`。キャッシュ済みURLは再取得しない。
- `read_source.py`、`dossier.py`、`maps.py`、`follow.py`、`gkp_extract.py`：調査補助。`uv run --with beautifulsoup4 python SCRIPT` で実行。

## 主な訂正と統合時の注意

- 御殿場：令和8年度分終了、令和9年度再開予定。恒久終了ではなくsuspended、`reviewUntil: 2027-03-31`。配布期間のvalidToにはしていない。
- 裾野：11月14・15日の将来休止。現在はactive、条件へ休止日を明記し、`reviewUntil: 2026-11-13`。熱海観光協会は11月18・19日および元日休業の施設公式告知を補足し、`reviewUntil: 2026-11-17`。
- 八百津：町8月4日案内10～16時と施設8月14日案内9:30～16:30が相違。新しい施設のカード配布明記を採用。町原本を休館日の補足として保持。
- 海津さぼう遊学館：土日祝だけでなく平日も配布。池田町：配布・休日予約受付を9～16:30へ。長泉A：町公式の短縮9～16:30を平日へ反映、休日の日直室は適用を独立確認できず採用保留。
- 関：北庁舎1階守衛室は休日だけでなく平日開庁時間外にも配布。公式配布案内に具体時刻の明記がなく「開庁時間内／外」と記録し、GKP時刻を偽承認しない。
- 飛騨神岡：公式に17時までと「現在は16時まで」の注記が併存。双方を保持して訪問前確認。伊東：市の配布終了20:30と施設の最終入館20:00・元日休館に差があり、カード時刻は市明示を保持して要確認。
- 富士C：窓口WEBアンケートを各本人が回答。施設への問合せ不可、市の指定確認先へ。静岡・沼津・熱海の建物・階と、郡上の住所、浜松の区名、中津川B総合案内窓口などの訂正は `decisions.py` のP参照。
- 高山中橋、垂井駅観光案内所、美濃加茂市役所分庁舎、磐田福田支所、南伊豆オーシャンパーク、吉田役場、富士宮臨時市役所は、入力にない追加・代替窓口として監査のproposalに残す。既存legacyを別施設へ転用していない。親で新関係を明示的に統合する必要あり。
- 愛知の多数の市町公式配布ページがHTTP403。独立した観光協会・施設ページや公式資料の検索を確認したが、現在のカード配布条件を確定できないものは未承認。特に大口・大治の在庫なし、豊明の時刻差、碧南の窓口差、豊橋の旧版終了／新版開始、豊山の休日予約窓口は検索段階の警告であり、原本未取得なので訂正採用していない。
- 三島旧案内は404。下水道課の現行一覧から5716.htmlへ到達し、2026年8月5日再開・9～16時配布を原本確認して採用。蓋座標・住所ジオコード・Googleマップ表示中心を代用していない。

既承認台帳のfacility aliasは再利用する実装。今回の87施設は既承認対象との重複なし。施設IDはlegacy ID由来の永続 `facility:chubu-west-*`。`sourceHash` は不変quality.jsonの値をそのまま使用し、fingerprint更新だけで承認維持していない。GKP原本と入力を変更していない。

## 検証

Python検証を通過。既存Goビルダーでも次の構成で成功：

```sh
go run ./cmd/builddata -places data/work/national-input/places.json \
  -place-fragments data/overrides/regions/chubu-west.json -as-of 2026-11-05 \
  -out data/evidence/national/chubu-west/build-check
```

結果：カード1313、場所1680、対応1725、蓋ピン1309、配布ピン29（既承認分込み）。検証用生成物は削除済み。文書とコードの食い違いとして新たに特定した事項はない。共有ブランチ、他担当ファイル、Go/UI、pilot台帳を変更せず、commit・push・PRは実行していない。
