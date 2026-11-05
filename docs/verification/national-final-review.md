# 全国統合・PR前独立レビュー

2026-11-05。指定された未コミットの builddata / listdiff / municheck と tools/national 全体を確認した。子起動、コード・台帳・原本の編集、commit、push、PR作成はしていない。リポジトリへの書き込みは本報告のみ。再現出力は `/tmp/national-independent-final-*20261105*` に置いた。

結論：現manifestの統合結果について、新しいP0/P1、過去3修正の回帰、非採用位置の混入は確認しなかった。以下に再現できた文書手順の不一致と、原文関係重複が詳細UIに現れる既知の制約を記す。通常ビルドへの全国反映、証拠ファイルの収録方法、未追跡ファイルの整理は親の別作業であり、本レビューの重大指摘にはしていない。全国の未確定情報を全件確定と評価するものではない。

## 指摘

### P2：統合手順の掲載コマンドが現在の入力では失敗する

- 箇所：`docs/national-integration.md:76` の `-places data/work/national-input/places.json -place-fragments 'data/overrides/regions/*.json'`。実装は `cmd/builddata/national.go:15` 以降の厳密merge。
- 再現：掲載コマンドの現一覧を `data/evidence/national/list-source/gkp-20261105.html`、出力を `/tmp/national-independent-final-documented-command-20261105` に変更して実行。
- 結果：`conflicting relation 13-214-D001 / facility:kokubunji-hikari`、終了コード1。
- 影響：全国整備の手順として読んだ人が、必要なexactパッチ適用前にmergeして停止する。現manifestを使う実装の不具合ではない。
- 最小修正案：同文書の全国再現コマンドを `python3 -B tools/national/assemble.py --out /tmp/national-assembled.json` の後に `builddata -places /tmp/national-assembled.json` を実行する形へ更新し、旧fragment直結手順は初期段階の記録として区別する。厳密mergeを緩和しない。

### P3・非阻害：原文関係重複が詳細UIで同じ窓口を繰り返し表示する

- 箇所：`cmd/builddata/ledger.go:318` 以降はaliasをcanonical IDへ変換しても原文関係行を保持する。`web/src/app.tsx:118` と `:149` はその全行を個別の施設sectionとして描画する。監査集計も `cmd/builddata/national.go:101` 以降で行単位。
- 入力再現：最終生成 `full.json` の `09-201-A001` には `facility:kanto-north-67107257814c51043efa` が2行あり、双方とも「宇都宮市上下水道局2階 経営企画課」、条件「平日（年末年始を除く）」、active。詳細UIでは同じ窓口が2回表示される。ブラウザー操作はしておらず、データと描画コードによる確認。
- 同一cardId/placeIdの重複は5組・余分な行5件：`01-234-A001`、`07-214-B001`、`09-201-A001`、`24-215-A001`、`28-481-A001`。先頭の北広島は異なる季節条件を含むので単純削除不可。確認済みcanonical関係の重複は後ろ4組。
- 影響：詳細表示の重複と、監査の「確認済み関係」が独立窓口数より多くなる。1825は原文を保持した関係行数で、cardId/placeIdの組数は1820。確認済み関係1674行も独立した確認済み組数1670とは区別する。施設ピンは施設単位、cardIdsも集合化されており、739ピンを重複で水増ししてはいない。
- 最小対応案：原文行を保持したまま、詳細表示だけ同一施設の同一条件をまとめる。条件が異なる場合は同施設内に併記する。監査は現状の行数として扱い、独立窓口数へ読み替えない。本件は原文保持方針に伴う表示上の制約で、統合台帳の原文削除を要求するものではない。

## 再現検証

次をリポジトリrootで実行し、すべて成功した（上記の旧文書手順の失敗再現を除く）。

```sh
go test -count=1 ./...
python3 -B -m unittest discover -s tools/national
python3 -B tools/national/assemble.py \
  --out /tmp/national-independent-final-ledger-20261105.json \
  --audit-out /tmp/national-independent-final-audit-20261105.json
go run ./cmd/builddata \
  -places /tmp/national-independent-final-ledger-20261105.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2026-11-05 \
  -audit-out /tmp/national-independent-final-build-audit-20261105 \
  -out /tmp/national-independent-final-build-20261105
go run ./cmd/builddata \
  -places /tmp/national-independent-final-ledger-20261105.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -as-of 2027-01-12 \
  -out /tmp/national-independent-final-expiry-20261105
go run ./cmd/listdiff \
  -before data/raw/gkp-list-20261021.html \
  -after data/evidence/national/list-source/gkp-20261105.html \
  -checks data/work/municheck.json \
  -local data/work/national-input/full.json \
  -out /tmp/national-independent-final-listdiff-20261105.json
```

- Go全パッケージ成功、Pythonは12テスト成功。Pythonを呼ぶGoの全国fragment検査も実行された。
- 独立組立台帳は1586施設・1670関係。親の `/tmp/national-reviewed-itg.json` と正規化JSONが一致。SHA256は両方 `f2f4e1282aaa4f1bab34669fca4adff62700c660896f366a51ac83fa14067ec3`（`json.dumps(..., sort_keys=True, ensure_ascii=False)`）。
- 独立生成 `full.json` は親の `/tmp/national-reviewed-itg-build/full.json` とJSON全内容一致。1313 cards、1735 places、1825 relations、739 place pins、1309 lid pins。
- 監査は confirmedFacilities=739、verifiedRelations=1674、locatedVerifiedRelations=768。休止・終了・unknownを含む確認件数であり、受取可能件数ではない。
- listdiffは旧・現1313件、追加0、削除0、変更20。採用印刷番号照合1313行、ローカル欠落0・余剰0・現一覧未対応画像0。今回画像を全件再読したという意味ではない。
- `data/work/national-input/{full,quality,places}.json` のSHA256はそれぞれ `6068da023f3bd4cb1e292b3e43877411a1505356e4377bbf02a255a89afb1987`、`8561505b9c8c0426fae93bf35306bd53f324e75527b842986da3d1df7b31012b`、`152bb738c77e95fcbd54702e42a2107cfd5949d614c7e6b4a706c94cba2a41fe`。既存記録と一致し、変更していない。

## 採用範囲と機械検査の限界

manifestは15入力、7パッチファイルの98操作、605位置追補を選択する。パッチはファイル全体hashとindex、位置はfacilityIdと行全体hashで固定。old完全一致、行一意、フィールド不在とnullの区別、同一行への全体・フィールドpatchの重複拒否を実装・テストで確認した。新規ファイルの自動走査はない。基礎入力はmanifest内ではhash固定されず、組立監査の入力hashと統合テストの最終digestで変更を検出する。この違いを「すべての入力をmanifestだけで固定」と表現しない。

独立レビューJSONの採用IDとmanifestの選択IDを集合照合した。

- 北海道 accepted 27件、中部西部29件、facility-point-scope 50件、中国四国・埼玉136件、茨城・栃木・群馬37件：採用漏れ0、各レビューの保留・要訂正集合の混入0。
- 九州沖縄 accepted 61件はすべて採用。要訂正集合から選択されている1件は菊水ロマン館で、元行ではなく `kyushu-okinawa-reviewed-corrections.json` の訂正行を選択。保存CSVを独立に読み、論理レコード24が菊水ロマン館・江田455・32.9733855/130.6022657、25が別施設の緑彩館であることを確認した。他の保留3件は未採用。
- 未採用住所feature、P05競合、棟未特定、ORIGAMI差異等を持つ保留・要訂正IDの混入なし。`official-facility-index.json` はmanifest入力ではない。scope名だけをもって全件採用する実装ではない。
- 太宰府館はsuspended、座標unconfirmed、reviewUntil=2026-12-22。現在の別窓口・太宰府市観光案内所はactiveだが座標unconfirmed。旧施設点を新施設の位置として使っていない。

`assemble.evidence` とGoの `validateEvidence` は保存bytesのhash、URL形式、確認主体、確認日、locator/methodの存在を検査する。ハッシュは保存bytesの一致を保証するが、保存物が実際にそのURLから取得されたこと、locatorの実在、施設名・住所・座標の意味的一致、CRS、原典の最新性、転載条件を自動認証するものではない。採用座標の真正性判断は保存原典の独立レビューに依存する。本レビューも605件すべてを原典から再調査したものではない。以前の地域生成器の「検証成功」を全国全件確定と解釈しない。

## 状態・履歴の回帰確認

- **現一覧変更・台帳未登録**：`TestCurrentSourceChangeInvalidatesUnregisteredCardAndLid` が関係あり／なし双方で旧activeの失効を検査して成功。現指紋で再承認した場合のsuspended維持テストも成功。実データの11-242-B001、13-214-E001、22-215-A001、38-202-B001はすべてsuspendedで、旧activeは残っていない。
- **複数住所**：`validateAddressSource` は生成側の ` / ` 分割住所の要素と完全一致で比較する。分割住所を受理し、部分住所・別住所・空文字を拒否する回帰テスト成功。
- **追加履歴**：入力の旧IDを保ったまま出力previousPlaceIdsをcanonicalへ正規化するテスト成功。実生成データの全previousPlaceIdsも出力placesへ解決した。追加の理由・原文・証拠・同カード旧関係の検証を迂回する経路は確認しなかった。
- **旧窓口ended**：activeとendedの確認済み関係を併せ持つ12-221-A001、15-202-C001、28-207-B001、28-207-C001、29-205-A001はいずれもカード全体active。旧関係の存在・終了だけで全体endedにはならない。
- **unknownと位置**：739施設ピンのうちunknownは11件。4施設は配布状態そのものがunknown（福岡県庁は2カード）、残る7施設はカードごとの状態混在。unknownはactiveへ昇格しない。足立区産業振興課、福岡県庁、木古内・当別の道の駅はverified関係とconfirmed位置によりunknownのままピン表示される現仕様。位置確認を配布可能の証明とは扱っていない。
- **reviewUntil**：家康館は2026-11-05生成時active/verified、期限2027-01-11。2027-01-12で再生成するとunknown/needs-reviewとなり、その施設ピンは消えた。期限当日は有効、翌日から失効するコード。静的JSONは時間経過だけでは再評価されず、UIもreviewUntilで独自更新しない。これは設計文書どおりであり、公開・更新運用では基準日を進めた再生成が必要。

## 文書とコードの差の全記録

本レビューで直接確認した差は以下。コードに従って評価し、既存文書は変更していない。

1. 上記P2の `docs/national-integration.md:76` の旧fragment直結手順と、現在必要なexactパッチ先行・manifest統合手順の差。
2. `docs/national-assembly.md:67` の「実ファイルは6つ。6ファイル97操作を採用」は旧段階の記録。現在のmanifest・テスト・同文書前半は家康館期限patchを含む7ファイル98操作。履歴だと明記しないと同文書内で食い違う。
3. `tools/national/assemble.py` の出力ガード直前コメント「Never write any source/evidence path」は実装より強い。実装はdata/workを許可し、data外ではmanifest自身以外の任意パスも許可する。`docs/national-assembly.md` の「data/workを除くdata配下への出力を拒否」は実装どおり。本レビューでは一時出力のみ使用し、上書き事故は起きていない。コメントの限定でよく、今回新たな出力承認フローは不要。

既存の独立レビューJSONに記録されている不一致も採否確認時に参照した。以下は新しいP1として重複計上しない。

- 中部西部：READMEの「施設名付き建物同定」と、生成器の住所部分文字列・座標検査だけでは保証できない範囲。該当非採用行は除外済み。
- 北海道：古い施設DBの一律現施設照合・棟同定・CRS/出典説明、釧路に留萌の説明を流用、千歳の部署名差。独立レビューの要訂正4件・保留41件を採用していない。
- 九州沖縄：一律名称住所照合済みという説明に対する菊水の別施設行選択、小郡西別館への市役所一般点の同定不足。前者は訂正追補、後者は保留。太宰府の旧施設点を残す方針は文書・コードの差ではなく、今回の採用条件に対する保留理由。
- 中国四国：統合用と説明された元追補の絶対snapshotPathは `repo_path` で拒否される。採用用 `chugoku-saitama-reviewed.json` の相対パス化により現統合は成功。
- 初期の「原典にない新設・移転は登録できない」は現在の明示addition対応より古い説明。設計本文は更新済み。千葉timestampとGoの日付形式の差は組立時の日付正規化・監査への元timestamp保存で解消済み。

証拠の収録可否・配信規模、通常ビルドへの全国切替、最新の公式情報の再取得は本レビューの完了条件に追加していない。これらを理由に全国全件確定を主張することもない。
