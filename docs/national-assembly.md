# レビュー済み全国台帳のオフライン統合

`tools/national/assemble.py` はPython 3.9以降の標準ライブラリだけを使う。ネットワーク、全国raw原本、`data/work`内の入力コピー・手動合成台帳は不要。元台帳・パッチ・位置追補・証拠を変更せず、新しいPlaceLedger schema 1を出力する。

リポジトリrootから実行する。

```sh
python3 -B tools/national/assemble.py \
  --out /tmp/national-assembled.json \
  --audit-out /tmp/national-assembly-audit.json
python3 -B -m unittest discover -s tools/national -v
go test -count=1 ./...
```

`--out`を省略すると標準出力。親ディレクトリは既存のものを指定する。入力検査が失敗すると非ゼロ終了し、台帳出力に進まない。`data/work`を除く`data`配下への出力は拒否する。`--root`でリポジトリroot、`--manifest`でroot相対の選択manifestを指定できる。

## 適用順序と承認範囲

`tools/national/manifest.json`が入力を明示する。globやディレクトリの自動走査はしない。

1. `data/overrides/places.json`、8地域、6つの`data/overrides/proposals/{kanto-south,kinki,west-south,north,kanto-north,chubu}.json`を読み込む。
2. 入力のメモリ上のコピーへexactパッチを適用する。対象行は一意、旧値は完全一致が必要。フィールドの不在とnullを区別し、重複・同一行への全体置換とフィールド置換の重複も拒否する。
3. 施設ID、関係のcardId/placeIdが同じ行は、全内容が一致するときだけ重複排除する。異なる値、legacy alias衝突、存在しない施設を参照する関係は失敗する。
4. 全施設・関係の証拠bytesのSHA256、URL・確認主体・確認日などを検査する。
5. 統合後にだけ承認済み位置605件を追補する。未存在施設、重複座標パッチ、既存coordinateの上書きを拒否する。lat/lngは両方必須の有限数値で、文字列・真偽値・null・範囲外を拒否する。座標追補の証拠SHA256も検査する。

パッチは次の7ファイル・98操作を選択している。

| ファイル | 操作数 | 選択 |
| --- | ---: | --- |
| kanto-south-integration.json | 52 | replacements全件 |
| kinki.json | 9 | patches全件。deferredCorrectionsは対象外 |
| west-south.json | 3 | patches全件 |
| north.json | 16 | 元north地域ファイルへの変更のみ。生成full削除5件は保留 |
| kanto-north.json | 13 | patches全件 |
| chubu.json | 4 | replace-relationのみ。見出し除外3件は保留 |
| chubu-west-reviewed-closure.json | 1 | 家康館の再確認期限追加。現在active維持 |

SouthKantoの`sourceFile=data/work/national-input/places.json`だけは、明示的に`data/overrides/places.json`へ対応付ける。旧値の照合を省略する例外ではない。それ以外のworkパスの読み替えはしない。

パッチ選択はファイルhashと配列indexで固定する。位置選択はfacilityIdと選択行全体の正規化JSONのSHA256で固定する。これにより既存ファイルへの未レビュー追記も自動採用されない。初期位置選択は千葉`scope=building`35件、`chubu-east-south.json`41件だけ。その後、神奈川のbuilding/office-entrance 21件、東京77件、近畿31件、東北59件を親レビュー後に追加した。北海道は独立レビュー `data/national/reviews/north-hokkaido.json` の無修正採用27件のみ追加し、要訂正4件・保留41件は対象外。中部西部は独立レビューのaccepted 29件のみ追加し、住所feature等は採用しない。九州沖縄は独立レビューaccepted 61件と、原本CSVの菊水ロマン館行に訂正した1件を追加。誤った緑彩館の行と保留3件は採用しない。東北の花巻本庁舎・新館共通点2件と処理場2件は建物同定待ちで保留。千葉・神奈川の保留施設代表点と中部北部は `facility-point-scope.json` の独立レビューaccepted 50件を追加。scopeの単語だけで判定せず原典の対象建物を確認した。中国四国・埼玉は独立レビューaccepted 136件を追加。CSの原本絶対パスは元提案を残し、採用用追補でrepo相対パスへ変換した。茨城・栃木・群馬は独立レビューaccepted 37件を追加。P05競合・住所feature・棟未特定・ORIGAMI原典座標差は保留。残る保留・要訂正地点とofficial-facility-indexは対象外。

承認範囲を追加するときは原本と競合をレビューしてからmanifestの選択を追加し、テストの件数・基準digestも再検証して更新する。位置行hashは `sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode())`。パッチhashはファイルの元bytes。追補ファイルを置くだけで承認される仕組みはない。

## 時刻と再現検証

位置証拠の`checkedAt`がタイムゾーン付きtimestampなら、その表記の暦日へ正規化する。元の位置追補ファイルを変更せず、任意の監査出力にも`originalEvidence`としてtimestampをそのまま保存する。置換前の施設証拠は`previousEvidence`に記録する。タイムゾーンのないtimestampは失敗する。監査出力には入力ファイルhashと適用件数も含む。

親の手動基準`data/work/national-assembled-reviewed-itg.json`との一度限りの比較で、施設1,586件・関係1,670件、全フィールド一致を確認した。比較は施設ID・cardId/placeIdで配列を整列する。CIはこのworkファイルを読み込まず、比較済み正規化JSONのSHA256を回帰テストに固定している。

```text
f2f4e1282aaa4f1bab34669fca4adff62700c660896f366a51ac83fa14067ec3
```

テストは実装前のImportError（RED）から実装後の成功（GREEN）を確認した。旧値不一致、不在行、不在フィールド条件、重複・重複範囲パッチ、同ID異値、alias衝突、不在施設参照、未承認削除非適用、位置上書き・重複・型違反、証拠hash不一致、timestamp、manifestの変更を検査する。統合テストは入力hashが実行前後で変わらないことも検査する。

## CIと残る範囲

`cmd/builddata/fragments_test.go`がPython統合コマンドと単体テストを実行する。既存のGoによる厳密デコード、mergeLedgers、全関係の施設参照、relationStatus、全証拠hash検査を維持する。`.github/workflows/ci.yml`の`go test ./...`から実行される。CIの`ubuntu-latest`が提供する`python3`を使い、欠落時はskipせず失敗する。GoのテストキャッシュがPythonの編集を検知しない場合があるため、ローカル再検証には`-count=1`を使う。

CIに必要なのは選択manifest、台帳・パッチ・位置追補、それらの採用証拠が参照する保存原本、テストが読むfacility-point-scopeレビューJSON、置換前pilotの証拠。実装時点では親作業中の新規ファイルがGit未追跡なので、親の変更にこれらを収録する必要がある。本作業はstage・commitをしない。

カードの原本への存在確認、sourceHashと最新原本の照合、`change.previousPlaceIds`が旧カード関係に属するかの確認は、既存builddataの全国rawを使う検証に残る。previousPlaceIdsは未採用の旧place IDも合法に含むので、承認済み施設一覧への参照として誤って拒否しない。raw無しの本処理は台帳の施設参照と保存証拠を確認するもので、全国の未解決調査が完了したことを意味しない。

## 見つかった記述の差

- 初期依頼文の「完成済みパッチ7ファイル」に対し、当時の列挙と実ファイルは6つで、初期実装は6ファイル97操作だった。現在は家康館の再確認期限パッチを加えた7ファイル98操作。
- `data/evidence/national/proposals-chubu/README.md`が指摘する、初期地域記録の「入力外のため新規関係を登録できない」は現在のGoの`change.kind=addition`対応と一致しない。現在のコードに従い、レビュー済みproposalを統合する。
- 千葉位置追補の`checkedAt`はtimestampだが、既存GoのEvidence検証は日付のみを受け付ける。元証拠を保持して出力を日付へ正規化した。
- 変更前のfragmentsテストは未補正のpilot＋全地域を直接mergeしており、各追補READMEの「exact patchを先に適用する」手順と一致していなかった。厳密mergeを維持したまま適用順序を修正した。
