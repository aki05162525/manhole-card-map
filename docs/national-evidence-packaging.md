採用した収録方針（親、2026-11-05）

GitHub APIで本リポジトリが非公開であることを確認した。今回のPRは既存の非公開リポジトリ内に原本・調査記録をそのまま収録する案Aを採用する。公開への切替・サービスへの証拠配信は行わない。原本の改行変換を.gitattributesで無効化し、実行キャッシュは除外する。公開再配布の許諾を確認済みという意味ではない。圧縮・重複排除は後続の保存形式変更として扱う。

以下は選定前の読取調査記録。指摘①旧パッチ件数、③旧統合コマンドは親で修正済み。CIはレビューJSON・置換前pilot証拠も収録して検証する。

全国証拠のPR収録案（2026-11-05、調査のみ）

親への提案は、公開可能と確認できた原本について「既存テストの最小依存を元path・元bytesで置き、残りをSHA256単位の圧縮保存にする」案C。全原本を圧縮する案Bより約109MB大きいが、展開せず現行Goテストの証拠依存を満たせる。原本の転載可否が未確認の段階では、この案をそのまま公開PRへstageしない。先に保全manifestと許諾確認済み成果を収録し、未確認原本をアクセス管理された保存先に保持する案Dになる。その間、公開clean clone単独で既存証拠テストを通す要件は未達と明示する。圧縮やprivate CIは転載許諾の代替ではない。

本調査は実装・stage・commit・push・PR作成・deployを行っていない。子も起動していない。指定されたこの文書と `data/work/evidence-packaging-report.json` だけを書いた。既存原本・既存コード・未追跡作業ファイルは変更も削除もしていない。ユーザーによるPR公開の許可と、サービスdeployの未許可は別に扱う。

採取時のmanifest SHA256は `a3677ad709d6e86d93461dc0e3af82399ce4279e376c8884fe84a7f6859b365b`。15入力台帳、7パッチファイル98操作、承認位置605件から、施設1,586・関係1,670を生成した。正規化出力SHA256は `f2f4e1282aaa4f1bab34669fca4adff62700c660896f366a51ac83fa14067ec3`。共有作業中に568件から605件へ追補が進んだため、最終測定は605件のmanifestに合わせた。親がさらに採用を増やしたら再計算が必要。

以下の容量はbytesの論理合計で、Git packサイズ・ディスク使用量・clone転送量ではない。MBは10^6 bytes。`du -sh`の729Mには割り当て単位の差もある。全国原本の集計は実行キャッシュ `__pycache__` を除く。除外した全pathと容量もJSONに記載し、削除していない。

|収録・検査集合|ファイル数|bytes|意味|
|---|---:|---:|---|
|全国証拠全体|10,417|741,477,354|未採用・候補・調査スクリプトも含む|
|現行テスト用最小追加集合|1,636|190,133,412|既存のコード・test fixture・依存lockfile等は別途必要|
|選択行のsnapshotPath|1,654|187,834,198|置換前入力・選択patch/updateも含む|
|文字列参照も辿った採用証拠|1,733|194,811,705|既存pathとして解決できた推移閉包|
|独立レビューと参照先|4,960|507,604,274|全レビューをrootにした保守的な閉包|
|全調査記録と参照先の保全候補|10,547|1,612,963,483|元全国証拠に加えwork/raw等まで広く辿る|
|基準入力・番号採用の再現材料|12|9,167,296|12ファイル。全調査再実行用データとは区別|

`all_records_and_reference_closure` の約1.61GBすべてをPRへ入れる提案ではない。大半の追加量は自治体照合の再実行用 `data/raw/N03-20260101_GML.zip`（803,201,348 bytes）。既存builddataは保存済みmunicheckと入力hashを読み、現在のGoテストと全国assemblerはこの境界ZIPを必要としない。これを全国原本と混ぜて一括stageすると、50MB・100MB超のファイルが1つ増える。全国原本だけの閾値リストは **>50,000,000 bytes: 空、>100,000,000 bytes: 空**。50MiB/100MiBでも空。最大は `proposals-north/e4c9d029a9ba2e1ada38.pdf` の37,439,676 bytes。

内容SHA256で一致した重複の余剰は106,770,699 bytes。全国原本の一意bytes合計は634,706,655 bytes。GKP現一覧は994,391 bytesの同一内容が5pathにあり、余剰3,977,564 bytes。URL・ファイル名ではなくbytesのSHAで判定した。原pathを削除・書き換えるのではなく、復元manifestの複数pathを同一objectへ対応させる。全重複group・各pathはJSONの `duplicates.groups` に列挙した。

|方式|実測・概算bytes|展開なしの既存テスト|留意点|
|---|---:|---|---|
|A: 全国原本をそのまま|741,477,354|最小集合の全国外pathもあれば可|レビューしやすいが容量と重複が残る|
|B1: 全pathをtar+gzip|277,333,265|不可|CIの前に元pathへ完全展開する実装が必要|
|B2: SHAごとにgzip|256,918,702|不可|object実測合計。復元manifestのサイズは別|
|C: 最小原本＋残りの一意gzip|365,537,576|依存集合上は可|全国外の追加保全物とmappingのbytesは別|
|参考: 最小集合のみtar+gzip|83,542,639|不可|全レビュー・未採用候補の保全要件を満たさない|
|参考: 採用証拠推移閉包tar+gzip|85,269,861|不可|全入力台帳や全レビューを含むパッケージではない|

各pathを個別gzipした総量は282,827,728 bytes。Cの残りobjectは7,037個・175,404,164 bytesで、一意hashが最小原本にある場合はそのbytesを再利用する計算。gzip level 6、mtime=0、filename空、tarはpath順・USTAR・mode 0644・uid/gid 0・mtime 0で全入力をストリーム処理して実測した。アーカイブファイルは作っていない。巨大単体tarにするなら、例えば32MiB単位へ分割して全体SHA・各part SHA・順番を固定する（全国tar.gzは9part）。圧縮率はこれ以上の改善を約束しない。

収録対象の具体的manifestはJSONの `package_file_manifest`。各行に元path・bytes・SHA256・展開なしCIへの要否・圧縮object名案・公開保留状態・app配布禁止を記録した。`sets.*.paths` が各案の集合を完全列挙し、`files` が元bytes/hashと追跡状態、`reference_edges` が確認できた参照辺を持つ。このJSON自体は `data/work` のignore対象なので、親が成果を収録する際は本レポートだけ明示して扱う。`git add -f data/work` のような一括追跡化はしない。

最低限、次を原本と一緒に保存する。承認済み行だけを抜き出して元ファイルを加工すると、patchファイルhashや未採用候補の履歴が失われるため、元ファイル単位で保持する。

- `tools/national/{manifest.json,assemble.py,test_assemble.py}`、既存Goコード・テストと通常のソース一式。manifestの15入力・7patch・位置追補は下記の全path。
- `data/national/regions/`、`data/national/reviews/`、未選択行を含むpatch/locationファイル全体、および全国証拠内のreview・manifest・decisions・provenance・未解決候補・検査結果。JSONの全保全集合にこれらを含めた。レビューだけが存在する関東北部ITGの証拠ディレクトリも保持する。
- GKP現原本 `data/evidence/national/list-source/gkp-20261105.html` と同 `manifest.json`、旧原本 `data/raw/gkp-list-20261021.html`。現原本のSHAは `ad9d5072b1e99c7b44edd51336219a535b9a8d5c6b94dfed0f3acfd37016f2cc`。同一内容の他pathも復元対応を残す。元manifestの取得時刻nullを補完しない。
- 番号採用の `docs/verification/national-id-reconciliation.json`、`data/overrides/cards.json`、保存済み `data/work/municheck.json`、その入力の `ocr.json`・`geocoded-c.json`・`addresses-sources.json`、`national-input/{full,quality,places}.json`。10件の例外番号だけでなく1,313枚の既存採用照合を再現する材料を保持する。カード画像の再OCR・人の再目視まで再現したという主張はしない。画像の権利確認・保存は別途必要。

manifest指定の全入力path（測定時点）:

```text
data/overrides/places.json
data/overrides/regions/north.json
data/overrides/regions/kanto-north.json
data/overrides/regions/kanto-south.json
data/overrides/regions/chubu-east.json
data/overrides/regions/chubu-west.json
data/overrides/regions/kinki.json
data/overrides/regions/chugoku-shikoku.json
data/overrides/regions/kyushu-okinawa.json
data/overrides/proposals/kanto-south.json
data/overrides/proposals/kinki.json
data/overrides/proposals/west-south.json
data/overrides/proposals/north.json
data/overrides/proposals/kanto-north.json
data/overrides/proposals/chubu.json
data/national/patches/kanto-south-integration.json
data/national/patches/kinki.json
data/national/patches/west-south.json
data/national/patches/north.json
data/national/patches/kanto-north.json
data/national/patches/chubu.json
data/national/patches/chubu-west-reviewed-closure.json
data/national/location-updates/kanto-south-chiba.json
data/national/location-updates/chubu-east-south.json
data/national/location-updates/kanto-south-kanagawa.json
data/national/location-updates/kanto-south-tokyo.json
data/national/location-updates/kinki.json
data/national/location-updates/north-tohoku.json
data/national/location-updates/north-hokkaido.json
data/national/location-updates/chubu-west.json
data/national/location-updates/kyushu-okinawa.json
data/national/location-updates/kyushu-okinawa-reviewed-corrections.json
data/national/location-updates/chubu-east-north.json
data/national/location-updates/chugoku-saitama-reviewed.json
data/national/location-updates/kanto-north-ibaraki-tochigi-gunma.json
```

採用根拠の追跡は `snapshotPath` キーだけに限定していない。選択済みinput/正規化patch/update全体の文字列からrepo pathを取り、JSON・文章・スクリプト内の引用先を反復走査した。例として `facility:chubu-east-07f787d6ebaa93bc9835` は `locations-chubu-east-south/94bc87f112360b0cc500f9ff.html` に加え `6a98f0508a11c7f955879a4a.html` も説明文で参照する。直接snapshotPathの1,654ファイルから閉包は1,733ファイルとなり、6,977,507 bytes増えた。未採用行は採用集合へ自動昇格させないが、全保全集合には残す。

この閉包は既存pathで解決できた範囲の保守的算定であり、意味上の厳密最小集合を証明したものではない。相対pathは同階層または一意basenameで解決し、HTMLの外部リンク先画像をローカル証拠と誤認しない。参照manifest全体を辿ると未採用の隣接原本も入る。動的に組み立てるpath、曖昧なbasename、生成予定のpathは完全には解決できない。`unresolved_path_tokens` の112件はディレクトリや部分式を含むため「欠損原本112件」と読まない。全原本保全を併用して、この探索の限界による候補記録の消失を防ぐ。

圧縮方式を採用する場合の実装要件は、親の別タスクで次の順に満たす。

1. 既存pathごとのbytes・SHA256を固定し、SHA256ごとのgzip objectとpath→object対応を保存。原本の改行・文字コード・HTML本文・JSON整形を変えない。archive hashと復元後raw hashを別々に記録する。
2. clean cloneのCIで復元をテストより前に行う。許可root外・絶対path・`..`・symlink/hardlink・重複entryを拒否し、展開先に異なるbytesがあれば上書きせず失敗する。同一bytesなら再利用可。gzipを読むために既存Evidence検証を緩めない。
3. 復元後は各元pathのbyte数とSHA256を全件照合し、既存assembler・Pythonテスト・`go test -count=1 ./...` を実行する。全レビューや候補のarchiveを含め、indexにあるobjectが欠ければ失敗する。必要物をネットワークで再取得して置き換えない。
4. 展開先を `data/evidence` と必要な `data/work`/`data/raw` に限定し、証拠archiveも元原本も `web/public`・`dist`・app artifactへコピーしない。既存 `web/vite.config.ts` のbuild時publicDir無効、`web/scripts/prepare.mjs` の明示コピーとfixture出力を維持する。証拠専用CIとfixtureビルドのartifactを混ぜない。

再現性は3段階に分ける。現行assemblerとGoの全国テストはraw全国データ不要だが、原本証拠を普通のファイルとして読む。Pythonの `facility-point-scope.json` 直接読取と、Goのpilot台帳全証拠チェックもあるため、最小集合には置換後に使わなくなった `data/evidence/distribution-20261105/{zushi-card.html,yokosuka.html}` も含めた。圧縮だけを置いて復元なしでは現在のコードは動かない。

保存済み全国build/listdiffの再現は別段階。builddataは `municheck.json` と一覧・OCR・cards override・geocode・address sourceのhashを照合する。上記12ファイルは9,167,296 bytesで、既存コードと採用原本を加えて固定する。listdiffの旧実行例の `/tmp/gkp-current-design.html` は保存済み `list-source/gkp-20261105.html` に置き換えたコマンドを親が用意できる。builddataの `-places` には現行assemblerの出力を渡す。原本を変更する必要はない。

地域調査・レビュー生成スクリプトを最初から再実行する段階は、現状ではclean cloneに閉じていない。97箇所のwork/raw/tmp関連行を `script_work_tmp_raw_references` に記録した。例:

- `kanto-south-integration/build.py`: `data/work/national-input/*`、`/tmp/ks-integration-baseline/quality.json`、`/tmp/gkp-current-design.html` を読む。
- `review-chugoku-saitama-locations/{build_review,validate_review,extract}.py`: `data/work/national-assembled-tokyo-kinki-locations.json`。
- `review-facility-point-scope/inspect.py`: `national-assembled-kanagawa-locations.json`。
- `review-chubu-west-locations/build-review.py`、`review-kyushu-okinawa-locations/audit.py`: `/tmp/national-parent-assembled.json`。
- `proposals-{north,kinki,kanto-north,chubu}` のbuild/verify: 過去段階の `/tmp/*/full.json`・`quality.json`。最終605件の台帳からこれらを同一bytesとして復元できるとは限らない。
- `official-facility-index` と中国四国追補: `data/work/official-facility-index/P05-22_GML.zip` 等。manifestに同一hashの保存コピーがあっても、元スクリプトの期待pathには復元が必要。`reproduce.py` は再fetchするため、元bytes再現の根拠には使わない。

過去段階のwork入力はhash付きで別保存するか、各時点の選択manifest・生成コマンドを親が固定して再生成する。全workを一括収録・一括削除しない。保存済みレビュー結果の監査可能性と、レビュー生成器の完全な再実行可能性を混同しない。

公開の判定は原本ごとに行う。自治体の公式HTML、Google Maps由来HTML、PDF、GKP原本は「公開URLから取得できる」ことだけで公開PRへの再配布を承認しない。P05等にCC BY表記がある場合も対象ファイル・版・帰属・加工表示を確認する。未確認物はhash・元URL・取得情報・採用/保留理由・保全先の識別情報を残し、原本のアクセスを制御する。非公開原本を必要とするPRに対して匿名clean cloneでCI成功を約束せず、権利確認済み原本の公開、許可された取得手段、または要件見直しが必要と記す。本タスクでは公開の許諾調査や新たな取得を行っていない。

文書と現行コードの差は次の3点。コード側に合わせて本収録案を計算した。

- 末尾に6ファイル97操作の過去記録が残るが、現行選択は7ファイル98操作。現在手順と過去記録を区別する必要がある。（docs/national-assembly.md:67 / tools/national/manifest.json; tools/national/test_assemble.py:92）
- CI必要物の説明はmanifestと採用証拠を中心にしているが、実際はfacility-point-scopeレビューJSONと置換前pilot証拠も直接読む。最小収録に両方を含めた。（docs/national-assembly.md:59 / tools/national/test_assemble.py:99; cmd/builddata/ledger_test.go:138）
- 古い実行例はworkのpilotと地域globを直接統合する。現行の全国統合はexact patch適用後にproposalと承認位置を含めるため、この旧例だけでは現行選択を再現できない。また/tmpの現一覧は保存済みlist-source原本を使える。（docs/national-integration.md 実行 / tools/national/assemble.py; cmd/builddata/fragments_test.go）

検証は実ファイルのSHA256集計、全体gzip/tarのストリーム実測、現行assemblerのメモリ内実行、最小集合以外のファイル読取を拒否するallowlistでの再実行、pilot証拠検証で行った。最終hash再確認の変更pathはJSONの `validation.final_inventory_rehash_changed_paths`。Goテスト・実clone・圧縮展開は実行していない（読み取り専用範囲で、テストの一時ファイルやビルドキャッシュを作らないため）。したがって案Cは依存調査とメモリ内実行で裏付けた提案であり、clean clone CIの実証済み実装ではない。親は権利判断・最終採用の固定後に、選定案の復元とclean clone CIを検証する。
