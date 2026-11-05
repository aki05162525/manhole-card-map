from decisions import *
S=json.load(open(ROOT/'summary.json'));A=json.load(open('data/national/regions/kyushu-okinawa.json'))
t='''# 九州・沖縄 配布場所調査（2026-11-05）

対象は不変入力のカードID40〜47。全120カード・164関係を監査に収録。
全件の調査処理を実施したが、全件確定ではない。AIによる公式情報照合であり、人・現地確認ではない。

## 結果

- 採用137施設・146配布関係。施設座標の確定は7施設のみ（建物代表点）。
- 配布条件保留18関係。位置未確定157関係。両者は重複する。
- カード状態: verified 1、partial 106、pending 10、ended 3。endedにも未定位施設を含む。
- 原典にない追加窓口等のproposal 18件。自動的な既存窓口の付替えは行っていない。
- 個別URL取得260件、HTTP200は237件。画像などの補助資料・一般施設ページも含むため237件を「公式配布確認件数」とは呼ばない。
- 完全に位置も条件も確定したカードは42-202-A001。状態のみ採用した関係や配布時刻未記載の関係はpartial。

## 出力と再現

- `data/overrides/regions/kyushu-okinawa.json`: schema1台帳fragment。
- `data/national/regions/kyushu-okinawa.json`: 全120カード、164元関係の監査、取得attempts、個別保留理由、追加関係proposal。
- `manifest.json`: HTTP取得URL・実取得時刻・レスポンス状態・原本パス・SHA256。エラー応答も原本保存。TLS失敗には原本を捏造していない。
- `gkp-manifest.json`, `gkp-rows/`: 統合担当取得済み `/tmp/gkp-current-design.html` の当該行バイト列。親原本SHAと取込時刻を記録。HTTP取得時刻は親manifest参照（取込時刻と混同しない）。地域班はGKP全件を取得していない。
- `decisions.py`: AIが読み取って採否を決めた明示的判断。manifest配列の添字を参照するため、manifestは並べ替え禁止。
- `research.py`: URLキャッシュ、同一ホスト逐次・約1秒間隔、TLS検証あり。キューJSONで追加取得。`build_fragment.py` はネットワークなしで2つのJSONを再生成。`validate.py` は被覆・ID・根拠hash・座標原本literalを検証。
- HTMLは既存 `.gitattributes` の `data/evidence/**/*.html -text` 対象。画像・PDF・ZIPも原本bytesのまま保存。ZIPは取得した補助資料で台帳根拠には使っていない。

```sh
python data/evidence/national/kyushu-okinawa/build_fragment.py
python data/evidence/national/kyushu-okinawa/validate.py
go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments data/overrides/regions/kyushu-okinawa.json -out data/evidence/national/kyushu-okinawa/build-check -as-of 2026-11-05
```

上記検証成功。Go出力はカード1313・場所1679・対応1725・配布ピン20（既承認13＋本担当7）。検証生成物build-checkは納品から除いた。

## 統合上の注意

既承認台帳は変更していない。IDは元legacyの一意部分を使う `facility:kyushu-*` を恒久IDとして割当。今後名称やsourceHashが変わっても再採番しない。藤崎台球場の2個の元legacyは公式同一窓口なので1施設に統合。それ以外の名称類似だけでの統合はしていない。別カードで共用する窓口でも配布関係はカードごとに独立。

熊本県立総合体育館D/Hの休止は2026-11-05〜11-17、reviewUntil=2026-11-17。太宰府Cの入力窓口は10/1〜12/22移転中、reviewUntil=2026-12-22。配布終了のvalidToに変換しない。移転先はproposal。期限後の状態はビルド実装によりunknownへ戻す。

施設名・住所の抽出誤りは小林市平日窓口を公式の第2別館2階下水道グループ・細野300へ補正。宜野座住所は施設公式1633、GKP1646-4と相違を残して公式を採用（座標なし）。薩摩川内Aの電話は公式0996-23-9889。宮崎市カードページ内のGoogle Mapsリンクは別店舗を指すため座標に使用していない。住所検索リンクやGoogle埋込の表示中心は承認しない。

白石・有田・中城は配布施設/状態を採用し、明記されていない配布時刻は未確認と記載。一般営業時間を流用していない。季節・年末年始等の例外が別ページにしかない可能性は残るため、公式確認先を保持。

文書とコードの契約不一致は今回読んだ範囲では検出なし。GKP/旧入力と公式配布案内の相違は以下および全件監査に記録。

## 配布条件の保留

'''
for c in A['cards']:
 pending=[r for r in c['relations'] if r['distributionState']=='pending']
 if pending:t+=f"- {c['cardId']} ({len(pending)}関係): {c['remainingReason']}\n"
t+='\n## 公式照合での相違・注意事項\n\n'
for cid,n in sorted(NOTES.items()):t+=f'- {cid}: {n}\n'
t+='\n## 追加窓口proposal（関係を自動追加しない）\n\n'
for cid,ns in sorted(PROPOSALS.items()):
 for n in ns:t+=f'- {cid}: {n} 根拠は監査の当該カードsourceUrlsおよび採用関係evidence。\n'
(ROOT/'README.md').write_text(t)
