# Issue7 PR収録・再現性の独立点検

2026-11-05。private repository・外部公開保留という依頼の前提で点検した。公開許諾の調査、調査内容・採否の再審査はしていない。ファイルのAGENTS.mdは祖先ディレクトリおよび対象のdocs/data/tools配下に見つからず、依頼に添付されたAGENTS指示を適用した。書込みは本文と `data/work/issue7-packaging-report.json` のみ。原本変更・削除、子起動、branch/commit/push/PR操作はしていない。

## 判定

収録案は「既存追跡物を再利用し、Issue7原調査・レビュー・採用用ファイル・原本を元path/元bytesでprivate PRに追加する」が現実的。ただし最終manifest固定後に必須一覧を再計算し、別checkoutで実検証すること。現在の作業ツリーで成功したことをclean clone検証と呼ばない。

採取開始manifest SHA256は `2c5ce8509f1396c662289ccbc6731a753899fcdf584065bf1edbaa1ca24046c9`。JSONの `manifestSnapshot` にその内容を保存した。CLIが実際に読んだmanifestも同hash。集計終了時は `a28cc314d648695a5f08f52355d6f108f27497e24b9b87754ccf260d7c68260f` に変化した。採取したIssue7ファイルの再hash変更は0件だったが、全ファイルの同時スナップショットではない。以下の件数は開始snapshotの評価であり、最新統合への合格判定ではない。

## 必須参照と再現性の境界

開始snapshotでassemblerをメモリ内実行し、1,586施設・1,670関係・位置810件を生成できた。CLIは39入力JSONを読み、assemblerは1,702個の異なるファイルを読んだ。両方の観測読取にwork依存はない。CLIは原本検証を行わず、assemblerは置換前の施設・関係証拠と選択位置証拠まで読む。この差を必須集合に反映した。

JSONの `observedReads` は実際に読んだbytesのhash、`cliInputSHA256` はCLI自身の記録、`requiredFiles` は実行入力とコード・直接テスト入力等を合わせた1,714ファイルの一覧。既存リポジトリの通常コード・Go/frontend依存・lockfile一式を別途維持する前提であり、全CIの厳密最小集合ではない。全Pythonテスト、Go、frontendの動的読取までは測定していない。`requiredFiles` の再hashは読取後なので、実行時の証拠には `observedReads` を使う。

未追跡必須は54件。manifestと `test_assemble.py` の変更だけを収録しても再現しない。原候補13地域・固定assignment-baselineもCLIが直接読むため、採用followupだけに絞らない。新CLI・テスト・説明文書を含め、末尾に全件列挙した。原調査・未採用候補・独立レビューの保存には、実行最小集合を超えて `issue7Files` の全件を保持する。

`referenceClosure` は全Issue7成果・コード・文書から、repo相対文字列と同階層JSON参照を推移走査した保守的な資料集合。動的path・basename・文章中の部分式は完全解決しない。未解決tokenは欠損ファイルの断定ではなく、workへ到達した41件もCLIの必須入力ではない。古い全国資料のREADMEからさらにraw/workへ広がるので、この集合を丸ごとstageしない。

研究・レビュー生成器の再実行には `data/work/issue7-baseline/{assignments,ledger,full,hashes}.json` が必要で、4ファイルは合計9,554,032 bytes。現baselineはignoreされている。CLI用のassignment-baselineだけでは旧ledger/fullは復元できない。再実行をPR要件にするなら、これらをhash付きの限定されたprivate保全物として収録・復元するか、当時のmanifest・生成入力・コマンドを固定する。現manifestから再生成して当時のbaselineだと扱わない。全workを追加する必要はない。

`review-shikoku/fetches.json` の7件は `/home/akihiro/...` の絶対snapshotPath。`review-shikoku/review.py:10` は現在cwdに対してrelative_toするため、異なるcheckout位置では失敗する。原記録を変更せず、旧root→repo相対の明示mappingを別途用意する必要がある。全件の位置は `absoluteJSONPaths`、work利用行は `scriptWorkAbsoluteReferences` に保存した。調査fetch/buildスクリプトは原本や成果へ書き込むため、検証のつもりで共有ツリー上で再実行しない。

## 容量と保存方式

Issue7の2ディレクトリは2,415ファイル・330,793,869 bytes（論理bytes、Git packや転送量ではない）。最大は東北PDFの37,439,676 bytes。50,000,000 bytes超・100,000,000 bytes超とも0件。Issue5の巨大P05 ZIPは現pathを参照しており再複製不要。既存追跡済み証拠を含む全依存の容量をこの331MBと取り違えない。

Issue7内部の同一bytes重複余剰は1,196,776 bytes。既存追跡済みdata/evidenceと同一bytesのIssue7ファイルは1,043件・126,656,900 bytes。この2数値は重なるので足さない。`duplicates` と `existingIdentical` にhashと全pathを保存した。

今回の収録は元pathのままが最も変更が少ない。容量削減を別途採用するなら、既存objectも含めSHA256→bytesを共有し、path→hash mappingからテスト前に全参照pathを復元する。元ファイルを消したり参照を黙って差し替えたりしない。圧縮archiveの容量は未測定で、今回圧縮器や復元器を実装したわけではない。復元機構なしで原本を圧縮物だけに置き換える案は、現在のassemblerの読取りに適合しない。

## 秘密・Cookie・権利

Issue7全ファイルを既知token形・秘密鍵・認証ヘッダ形で検査し該当0件。JSONキーの構造走査では `south-kanto/reused-source-index.json` のresponseHeadersにSet-Cookieが4件あった（行2031/2059/2104/2184）。既存Issue5のjebl・yokohamastationcity・at-yokohama原本の再利用取得記録。Cookie値は本報告にも出力にも転載していない。ほかのCookie文字列検出はHTML中のコードまたはfetch.pyの除外条件だった。リクエストCookie/Authorizationの構造キーは検出しなかった。匿名公開応答の記録と考えられるが、任意形式の秘密不存在の証明ではない。元記録は保持し、公開保留の範囲に含める。

privateであることは原本全体の再配布許可を意味しない。自治体HTML/PDF・GKP・第三者ページ・P05の座標/属性・取得応答ヘッダは、それぞれの保存目的と公開条件を分ける。数値座標の利用条件をHTML全文転載の許諾へ拡張しない。既存の出典URL、版、取得日時、hash、帰属・利用条件記録を保全し、条件未確認原本は外部公開保留を継続する。本レビューは原本の一括ライセンス認定を行わない。

## Web配信とGo探索

Viteはbuild時publicDir=false。prepare.mjsは通常buildでpublic/dataを再帰コピーするので、そこへ原本を混ぜない運用が必要。fixtureは人工データを生成し、CI artifactはdist-fixtureとブラウザ画像に限定される。コードにはIssue7証拠ディレクトリをコピーする処理がない。

現web/public・dist・dist-fixtureとIssue7の同一bytesを照合した結果、空OCRテキストと空のmaplibre-gl-shared.mjsの2一致だけだった（0 bytesの一致で原本混入ではない）。非空原本の同一bytes混入は検出しなかった。ビルド再実行や変換済み内容の完全追跡は未実施であり、将来の配信物を保証する結果ではない。

Issue7にはbuild除外のないpackage mainのGo probeが8ファイルある。data/evidenceもmodule配下なので `go list ./...` / `go test ./...` の通常探索対象になる構成。各ディレクトリは別packageのためmain同士の衝突は見られない。ただしgo testはmainを呼ばず、probe内の原本検査を実行しない。probeはEvidence構造体/検証処理を複製しており、本体関数を直接呼ぶ回帰テストではない。保存するならこの意味を記載し、任意実行はrepo rootから明示したgo runで行う。今回go list/go testは実行していない。

## 文書とコードの相違・検証範囲

1. `docs/national-assembly.md` の選択patch表はIssue5までで、開始snapshotのIssue7住所patch等が未掲載。必須入力は現manifest/assembleのコードに従った。位置の追加履歴も最終選択全体を表す一覧として使わない。
2. `docs/verification/issue5-packaging-review.md` の「CIがPython監査を実行していない」は過去記録。現 `.github/workflows/ci.yml` はPython unittest discoveryを実行する。Issue7の未対応事項として引き継がない。

新CLIの説明と確認した読取コードには、収録判断を変える相違は見つからなかった。地域READMEの「親レビュー前」は原調査時点の履歴であり、現在の採用判定には使用しない。

実施したのはコード読取、SHA256/容量/参照走査、メモリ内CLI・assembler実行。allowlist検査、clean clone、全テスト、Go probe実行、build、ネットワーク取得は未実施。親はmanifestを固定した後、必要物を収録した別checkoutでPython/Goテストとfixture buildを実行し、未追跡workに頼らず成功することを確認する。本JSONはignore配下なので、収録する場合はこの1ファイルだけを明示対象とし、data/work全体を強制追加しない。

## 採取時の未追跡必須ファイル全件

- `data/evidence/issue7/chugoku/0b660662b4408b7e75dd.html`
- `data/evidence/issue7/chugoku/49e5f34f6d0f6c62c098.html`
- `data/evidence/issue7/chugoku/5c5ea335d9e0d8dd110c.html`
- `data/evidence/issue7/chugoku/6fa73a33230f872d62d5.html`
- `data/evidence/issue7/chugoku/7a85bd1b3ca90c368403.html`
- `data/evidence/issue7/chugoku/b2fd58c06571e3e79cee.html`
- `data/evidence/issue7/hokuriku/663faf3aea8fa6657394.html`
- `data/evidence/issue7/koshin/ed1740151091441ae784.html`
- `data/evidence/issue7/kyushu-okinawa/52deb1a5e97008c86ef93511.html`
- `data/evidence/issue7/kyushu-okinawa/5620e96f3a2a22bcbaf9a33c.html`
- `data/evidence/issue7/kyushu-okinawa/daf037a730652526782cf5f5.html`
- `data/evidence/issue7/north-kanto/1ee9e78986a8db5cecee3bb8.html`
- `data/evidence/issue7/sakuragicho/japan47go.html`
- `data/evidence/issue7/shikoku/04dde3cc2fd81f7758a201d59766ed6107299680d521844b5b9d961a71608d57.html`
- `data/evidence/issue7/shikoku/2ebedb40be28232e797455ab1c6e8af1cdc18a7b44002d1e3080fbae6a808c47.html`
- `data/evidence/issue7/shikoku/4a9380d6dd03263d406a6b2c53d20e7c6c762ba8a10ccc12e48c65659e281269.html`
- `data/evidence/issue7/shikoku/b00c37518b3d009a5d6a67f3883ddbdb6173ccc0e86fbe875e5cf27451036536.html`
- `data/evidence/issue7/shikoku/b72af19567b8517c27b6472cdb6fd1b3a5d1f78d15b5c22f9a33eeda4abb14ac.html`
- `data/evidence/issue7/shikoku/b835d36777ee5421c07b20d117f8abc4cd2d5796ecc5588208e01c75c905e396.html`
- `data/evidence/issue7/shikoku/bac92932fb9eb83505a8a5cfa626cc0494c4bde0e336c74f03ad37f543c256c4.html`
- `data/evidence/issue7/shikoku/cf4bdaa8793e552dbccf93f37bce9c53a092bffb7c5492031cfab219b1195711.html`
- `data/evidence/issue7/south-kanto/2fd39eb2e8c14f37566f0115.raw`
- `data/evidence/issue7/south-kanto/594df656136ae6cb185a9b16.raw`
- `data/evidence/issue7/south-kanto/8ad872cbf7eebae0db271544.raw`
- `data/evidence/issue7/south-kanto/9e1fa2f9b4f28dfb07c27fbf.raw`
- `data/evidence/issue7/south-kanto/bb7a6698c08b1974e6607a10.raw`
- `data/evidence/issue7/south-kanto/bc9e265d32a9b60738a3a58f.raw`
- `data/evidence/issue7/tohoku/originals/b15205e39cf4cca8975cef24387c3b6f387efa8da677b167356d30bb648b138f.html`
- `data/evidence/issue7/tokai/0c45dc50adbc5456ed70.html`
- `data/evidence/issue7/tokai/ab548fdcccd6faf9a553.html`
- `data/evidence/issue7/tokai/f6bc175ab9f7279ed939.html`
- `data/national/issue7/address-reviewed-patches.json`
- `data/national/issue7/assignment-baseline.json`
- `data/national/issue7/chugoku-reviewed-patches.json`
- `data/national/issue7/chugoku.json`
- `data/national/issue7/hadano-reviewed.json`
- `data/national/issue7/hokkaido.json`
- `data/national/issue7/hokuriku.json`
- `data/national/issue7/kinki-east.json`
- `data/national/issue7/kinki-west.json`
- `data/national/issue7/koshin-reviewed.json`
- `data/national/issue7/koshin.json`
- `data/national/issue7/kyushu-okinawa-reviewed.json`
- `data/national/issue7/kyushu-okinawa.json`
- `data/national/issue7/north-kanto.json`
- `data/national/issue7/sakuragicho-followup.json`
- `data/national/issue7/sakuragicho.json`
- `data/national/issue7/shikoku.json`
- `data/national/issue7/south-kanto.json`
- `data/national/issue7/tohoku.json`
- `data/national/issue7/tokai.json`
- `docs/issue7-audit.md`
- `tools/national/issue7_audit.py`
- `tools/national/test_issue7_audit.py`
