# 北海道・未位置施設の追加位置調査

2026-11-05。親レビュー用。`north` fragment内でcardIdが01から始まる採用関係に結び付く、座標なし91施設を対象とした。72施設の座標更新候補、19施設の個別未解決理由を `data/national/location-updates/north-hokkaido.json` に出力した。元fragmentや配布関係は変更していない。人・現地による確認ではなくAIによる原典照合である。

## 記録と根拠

- `targets.json`: 元fragmentから抽出した全91施設。永続IDとlegacyIdsを保持。
- `decisions.json`: 数値・原典locator・個別の採用判断。`decide.py`は明示した選択からこれを再生成する。文字列一致だけで施設を自動承認する処理ではない。
- `facility-review.json`: 全91施設の名称、住所、legacy ID、個別結果。
- `manifest.json`: 319 URLの実取得開始日時（UTC）、URL、最終URL、結果、原本pathとSHA256。128 URLは元northのキャッシュを再利用し`reusedFrom`を記載。取得失敗の旧記録は原形を保持。新規191 URLを取得。原本はbytesで保存（CSV/JSもURL由来のhash名 `.html` に保存するのでContent-TypeとURLを参照）。再取得していない原本の取得日時は元manifestの値を保持した。
- `provenance.json`: 地図サービスを位置根拠とする26施設について、公式ページ原本→埋め込み地図／短縮リンク→地図応答原本の接続と各hashを記録。Google一般検索の任意地点を採用したものではない。
- `map-features.json`: 取得した埋め込み応答の施設featureを抜き出した読解補助。feature ID、名称・住所と位置を保存。表示中心は別フィールドとして不採用。
- `public-facilities.json` と `inspection.json`: CSVおよびHTMLからの読解用派生資料。承認根拠は原本。`research.py`で再取得時も同一URLキャッシュを優先し、同一ホストの通信開始を約1.1秒間隔にする。証明書エラーやアクセス拒否を回避する処理はない。

建物内の複数窓口はIDを統合せず、同じ建物代表点をそれぞれの施設に提案した。座標は建物・施設代表点であり室内窓口の精密位置ではない。配布休止・終了等の状態は変更していない。

北海道公開の役場CSV、施設位置DB、富良野市公共施設CSV、奈井江町避難施設CSVも利用した。古い施設点は、現公式原本の名称と住所に照合したものだけを選択した。富良野市役所は旧CSVの点を使わず2025年の市複合庁舎データを採用。古平の浜町40-4と現50、稚内の中央3-13-15と現3-2-1、整備後の棟対応が不足する東神楽は保留した。

## 親が確認すべき保留事項

19施設それぞれのURLと結果は出力JSONにある。特に次の相違を勝手に修正していない。

- はなふるセンターハウス: 元台帳／水道案内823-3に対し施設公式 `https://hanafuru.jp/contact.html` は828-3。公式アクセス経路は別施設の花ロードえにわ817-18を目的地としている。その点は花ロードだけに使用した。
- 道の駅かみしほろ: 施設名付きfeatureに43.2248833,143.2909196が得られた。町公式施設案内と道の駅サイトは227-1、台帳は227番地。住所枝番の照合・修正を親に委ね今回は保留。施設点の原本はmanifestとmap-featuresに保存済み。
- すないる: 施設サイトの短縮リンクから43.4929982,141.9072378が得られたが、遷移先は住所featureで施設名付きPOIではないため不採用。
- 留萌分庁舎: 本庁の経路到着点を別棟の上下水道課へ流用しなかった。市配布ページの数値qはプラザ側の地点である。
- 絵本の館: 公式アクセスの `data-lat` / `data-lng` が空で住所ジオコードを使うため不採用。

今回は採用済み施設の座標提案に限定。追加・移転proposalの施設へ旧facilityの座標を流用していない。新窓口の登録、原監査・pilot・Go/UI・他担当の変更、commit/branch/push/PRは行っていない。

## オフライン再現・検証

リポジトリrootから実行する。

```sh
uv run --with requests --with beautifulsoup4 python data/evidence/national/locations-north-hokkaido/decide.py
python data/evidence/national/locations-north-hokkaido/build.py
python data/evidence/national/locations-north-hokkaido/provenance.py
python data/evidence/national/locations-north-hokkaido/verify.py
```

`decide.py`はネットワークを呼ばない（requests/BeautifulSoupは共通読解モジュールのimport用）。`build.py`以降はPython標準ライブラリのみ。`validation.json`は91件の完全被覆・重複なし・全原本hash・再利用bytesの同一性・ID参照・各座標対が原本の同一局所断片に現れることを検査する。意味上の施設同定は上記個別判断と原典locatorを合わせて親レビューする。数値が原本に存在するだけで同定完了とする検証ではない。

基礎不変入力 `data/work/national-input/*` を変更していない。読んだ設計文書とコードに今回新たな食い違いは見つからなかった。
