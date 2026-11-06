# 配布場所からカードと蓋を訪ねる

2026-11-05。現行実装に対応する設計と、保存素材を使った再現手順。全国の施設整備完了や外部公開を意味しない。

## 利用の流れ

最初の地図は配布場所を表示する。同じ窓口で受け取れるカードは1つのピンにまとめ、選択後にカードごとの配布時間・条件・公式情報を確認する。Google Mapsで配布場所へ移動し、受け取り後は「このカードの蓋を見る」で対応する蓋へ進む。蓋も一覧表示したい場合は「蓋の位置も表示」を使う。

配布場所が未確定なら、蓋を代わりの配布場所として表示しない。カードは一覧・検索・詳細に残す。地図には確認した場所の一部だけが出ることを常時案内する。蓋座標の `confirmed` は印刷座標の読み取り採用であり、現地確認ではない。

## 保存と採用

バックエンドDBは追加しない。Git管理の `data/overrides/places.json` と地域台帳・承認済み追補を、`tools/national/manifest.json` の明示選択に従って統合し、Go生成処理から静的JSONを作る。利用者の収集記録用DBは別の課題。集計用SQLiteも今は必要ない。

- 施設には `facility:` で始まる永続IDを付ける。元の抽出施設IDを `legacyIds` で対応付ける。同住所でも別窓口を自動統合しない。
- 配布時間・状態・適用期間はカードと窓口の関係に持たせる。施設の営業時間とは別。曖昧な期間や代替先は原文を保持し、日付や関係を捏造しない。
- 施設の位置とカード配布条件には、それぞれ出典URL、保存原本、SHA256、該当箇所、確認日、確認主体、確認方法を残す。今回の調査主体はAIで、現地確認・人による確認とは区別する。
- 現配布先の施設への案内点を採用できる。入口・階・室内窓口の測量は要求しない。公式施設案内の座標に限定せず、P05・PLATEAU・公開GIS等も、現施設との対応、座標の由来、利用条件を照合したうえで使える。単なる地図中心・蓋・旧施設・別の施設は代用しない。既存の有効な根拠は再利用する。
- 配布施設へ案内できれば採用する。候補の棟が同じ施設の敷地内で50m程度に収まり、線路や川などで隔てられていなければ、棟を特定しなくてよい。点は公式情報に最も合う建物に置き、窓口の場所は詳細の文章で案内する。座標系の名称だけが未確定であることを、一律の保留理由にしない。残る不確かさ（原典精度、座標処理、候補の棟との距離等）を記録し、未知の誤差をゼロと扱わない。別の敷地や遠い場所を指すおそれがあるときは採用しない。
- 台帳から通常ピンを作るには、施設位置とそのカードの配布関係の両方が確認済みでなければならない。
- 座標が未確認でも、公式案内に裏付けられた配布休止・終了は訂正できる。施設台帳の座標を省略し、位置未確定のまま配布関係を採用する。地図ピンは生成しない。
- 期間限定の休止は配布期間の終了日と混同せず、確認期限 `reviewUntil` を指定できる。期限を過ぎた基準日で再生成すると要確認に戻し、再開・終了を推測しない。静的ファイルは時間経過だけで更新されない。

原典の配布場所・時間・配布状況欄・リンクを指紋化し、変更時は該当関係を再確認待ちに戻す。そのカードを施設ピンから外し、詳細の古い目的地リンクも止める。URLの内容変更を自動で監視する機能ではない。公式情報の定期取得・再確認はまだ手動である。

施設名・電話番号などが変わり元の抽出IDが消えた場合は、ビルドを停止する。根拠を確認して既存の永続IDに新しい `legacyIds` を追加する。自動的に別施設として作り直さない。実際の移転や窓口統合は同一性を個別に判断する。

位置採用後の再確認・訂正・取り下げは、manifestで選択した `locationLifecycle` のbinding/eventに限って適用する。管理対象のname/addressが採用時identityと一致しなければ `needs-review` とし、座標・ピンを出さない。旧座標を原履歴に残したままreaffirm/correct/withdrawを追補できる。未管理の既存位置にはこのidentity検査は働かない。`reviewDue`は再確認キューであり、一律失効期限ではない。詳細は[位置ライフサイクル](location-lifecycle.md)を参照する。

座標精度の区分と承認状態は同じではない。原追補の `scope` は通常の統合台帳・配信JSONに構造化項目として引き継がれない。Goでは、検証を通った台帳に座標が残っていれば `coordinate.status=confirmed` となり、位置履歴が保留・撤回したものは座標なしの `unconfirmed` になる。`confirmed`だけで入口精度・現地測量済み・在庫ありとは判断できない。精度区分を配信へ構造化して伝える機能は未実装。

標準画面はreferenceピンを除外する。生成CLIの `-reference-places` は比較用で、通常の採用基準を緩めるオプションではない。出典説明に残る参考位置の文言は[#3](https://github.com/aki05162525/manhole-card-map/issues/3)の表示整理で扱う。

## 手順

保存済みの全件素材がある環境で、リポジトリのルートから実行する。以下は2026-10-21取得一覧と2026-11-05確認一覧・評価日の再現例であり、今日の最新状態を取得する手順ではない。

```sh
python3 -B tools/national/assemble.py --out /tmp/national-distribution-ledger.json
mise exec -- go run ./cmd/builddata \
  -places /tmp/national-distribution-ledger.json \
  -list data/raw/gkp-list-20261021.html \
  -date 2026-10-21 \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05
cd web
mise exec -- bun run build
# サーバー起動前に既存プロセス・使用ポートを確認する
mise exec -- bun run preview
```

単独の `go run ./cmd/builddata` は既定の `data/overrides/places.json` を使うため、全国manifestの採用結果を反映するには上の統合と `-places` 指定が必要。

`-date` は一覧の取得日で、この再現例の基礎資料は2026-10-21。`-as-of` は配布期間を判定する日で、省略すると取得日になる。新しい台帳を使う際は判定日を明示する。現在日時を暗黙に使わず再現可能にし、出力に `evaluatedAt` を残す。日々の自動再生成は未導入。

`data/work/internal-data/quality.json` に全国件数、座標の確認状態、配布関係の確認状態、対応のないカード、原典指紋を出力する。確認した原典指紋を台帳の `sourceHash` に設定する。指紋だけ更新して承認を持ち越さず、原文と公式情報を再確認する。

一覧差分は保存HTML同士で検査できる。通信や配信データの更新は行わない。

```sh
mise exec -- go run ./cmd/listdiff \
  -before data/raw/gkp-list-20261021.html \
  -after /path/to/new-list.html \
  -out /tmp/list-diff.json
```

この比較のキーは画像URLであり公式カードIDではない。追加・削除は画像差し替えでも生じるため、印刷カード番号との同一性照合が必要。行番号の変化は無視するが、時間・配布状況欄・リンクを含む全フィールドの変更と前後の値を残す。重複URLや空URLは取りこぼさずエラーにする。

## 試行と残る作業

代表カードの調査状態は `data/overrides/distribution-pilot.json`、根拠は `data/evidence/distribution-20261105/` と `data/evidence/distribution/tokyo-extra/` を参照する。未確認も含む調査台帳であり、選定したカードをすべて承認したものではない。期間限定移転のような事例は、旧施設の座標を流用せず確認待ちに残す。

レビュー済み台帳では1組のカード・窓口に期間付きの1関係を持てるが、同一ペアに複数期間を持つ承認モデルや代替先の構造化は未対応。抽出されたfullには期間別・完全一致の関係行が複数あるため、生成物まで一律に「1ペア1行」と仮定しない。

新設窓口や移転先の配布関係は、根拠と原文を持つ `change.kind=addition` で明示追加できる。移転専用の種別ではなく、移転と通常の追加を機械的に区別しない。旧関係の自動削除・旧窓口の自動終了も行わない。施設位置の訂正に使うlocationLifecycleの `reasonType=relocation` は、配布関係のadditionとは別の契約である。

統合手順は [national-assembly.md](national-assembly.md)、全国の不足・再確認対象は [監査・出典条件](audits.md) を参照する。未確認の全国データは既存の抽出値・原文で閲覧できる。全施設の確認、現地検証、週次更新の自動運用、実機での性能評価は未完了。

## 公開データと内部データ

`tools/build-real-data.py` は公開用を `web/public/data/`、監査用を Git 管理外の `data/work/internal-data/` に生成する。`cmd/builddata -out` は公開用、`-internal-out` は内部用（web配下と公開先との重複は拒否）。内部には従来の full/details/pins/manifest と quality を保存し、根拠や inputs を保持する。監査は内部 full を読む。

公開データは `cmd/builddata/public.go` の専用型による許可リストで作る。内部型の埋め込みや RawMessage の転送はしない。

- cards: id, city, pref, series, issued, status, placeText, hours, links, acquired。lid は status/lat/lng/reason。
- places: id, name, address, phone。coordinate は status/lat/lng、locationReview は status/addressStatus/reason。
- relations: cardId, placeId, condition, periodRaw, alternativeRaw, hours, status, validFrom, validTo, review。evidence は sourceUrl/checkedAt。
- pins: pref, id, cardIds, kind, status, lat, lng, reference。
- full/details の管理情報は schema/updated/evaluatedAt。details の pins は null。pins.json は schema/updated/pins/detailsSHA256、manifest は schema/updated/files（公開3ファイルのSHA-256）のみ。

施設の evidence、座標の source/review/level（施設の reason も）、カードの municipality/reviewSourceHash、override、関係の change/reviewUntil/raw/alternativeTo/interpretation/addressBorrowed、位置レビューの decisionId/reviewedAt/reviewDue/sourceVersion、reviewSource、manifest の inputs/referencePlaces/evaluatedAt は内部に残す。画面用の説明文も内部パスが含まれれば公開前検査で失敗する。表示内容を機械的に削ったり書き換えたりはしない。

`web/scripts/prepare.mjs` は許可した4ファイルだけを検査してdistへコピーし、`check-deploy.mjs` は全公開JSONを再帰検査する。quality は内部用であり、既存の公開先に残った旧ファイルは再生成時に除去する。新しい公開項目は表示用途を確認して型と検査を更新する。
