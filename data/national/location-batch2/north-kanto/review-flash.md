# Gemini Flash独立レビュー原文記録

対象head: a3a9e92764bd29df5ee29830c8a7887b45654058。以下はレビュー時点の報告であり、件数・仮統合状態は当時の値。最終判断・統合値はoutcomes.json。

# PR #51 独立再レビュー報告（北関東第2弾）

## 1. レビュー対象・HEAD確認

- **対象PR**: [PR #51](https://github.com/aki05162525/manhole-card-map/pull/51)
- **対象checkout**: `/home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353`
- **実HEAD SHA**: `a3a9e92764bd29df5ee29830c8a7887b45654058`
- **PR headRefOid**: `a3a9e92764bd29df5ee29830c8a7887b45654058`（**完全一致を確認**）
- **Base (main) SHA**: `65e7b2f7bc0f3ee9429a39e97d169c4e662fbf41`（北海道PR #56・近畿西PR #45統合済み）
- **作業ツリー状態**: clean（変更なし）

---

## 2. 候補ごとの採否（日立・羽生2仮統合と保留6件）

### 採用候補（2施設）: **承認（Approve）**

| 施設ID | 施設名 | 候補座標（lat, lng） | 形状・面積 | 採否判断 |
| :--- | :--- | :--- | :--- | :--- |
| `facility:kanto-north-2e945c5e9faf1a16c8d7` | 日立市役所下水道課 | `36.5991526, 140.6503817` | 矩形（index 241）<br>約2,788.3 m² | **採用承認** |
| `facility:kanto-north-c73669beeeb24f667599` | 羽生市三田ヶ谷農林公園 キヤッセ羽生「ムジナモ市場」 | `36.1716201, 139.6014386` | 縦長多角形（index 26）<br>約415.9 m² | **採用承認** |

#### 独立採否の根拠
1. **日立市役所下水道課**:
   - **原本読解**: 2025年5月市報9頁および案内図より、西側に高層本庁舎、中央に大屋根広場、東側に多目的ホール棟、東端に国道6号、西側に市道・水路が配置されていることを確認。現配布先は「本庁舎6階海側下水道課」を指定。
   - **GSI外形同定**: 国土地理院ベクトルタイル（PMTiles z16/58372/25599）から3地物を独立同定。
     - 西側の堅ろう建物矩形（index 241, vt_code 3102, 約2,788 m²）＝**本庁舎**
     - 中央の内孔付き無壁舎（index 274, vt_code 3111, 約4,661 m²）＝**大屋根広場**
     - 東側の普通建物（index 275, vt_code 3101, 約656 m²）＝**多目的ホール棟**
   - **競合解消と派生検証**:
     - 旧P05点（`36.59916, 140.64821`）は約200m西の旧庁舎跡地方面で外形外。
     - 市HTMLのGoogleマップリンクq（`36.59915, 140.65045`）はindex 241内包（約15m差）。
     - 本庁舎外形（index 241）の重心 `36.5991526, 140.6503817` を派生し、小数7桁丸め後の点も外形内に完全内包（`roundedPointWithin: true`）されることを検証。
     - 敷地内の他棟（ホール・大屋根）と明確に分離された本庁舎代表点として妥当。

2. **キヤッセ羽生「ムジナモ市場」**:
   - **原本読解**: 園内配置図より、敷地内に4つの主要建物が存在することを確認。現市配布案内は「ムジナモ市場」を指定。
   - **GSI外形・周辺実照合**: 国土地理院ベクトルタイル（PMTiles z16/58181/25696）の建物（BldA）・道路（RdEdg, RdCL）・水部（WA, WL）を独立デコードして照合。
     - 北西・斜め建物（index 24, 約942.4 m²）＝キヤッセバーガー
     - 北東・斜め建物（index 32, 約657.0 m²）＝事務棟・体験棟
     - 南西・縦長建物（index 26, 約415.9 m²）＝**ムジナモ市場**
     - 南東・横長建物（index 28, 約697.3 m²）＝農畜産物加工棟
     - 西外周道路の北側入口／南側出口、中央を縦断する水路、東側周回路と円形丘の幾何配置が園内図と完全整合。
   - **派生検証**: ムジナモ市場外形（index 26）の重心 `36.1716201, 139.6014386` を派生し、丸め後も外形内に内包（`roundedPointWithin: true`）されることを確認。単なる敷地代表点ではなく配布施設棟代表点として妥当。

---

### 保留（6施設）: **保留支持（Hold維持）**

| 施設ID | 施設名 | 保留理由と停止・再開条件の妥当性 |
| :--- | :--- | :--- |
| `facility:kanto-north-00d6ef3c990590c41abf` | 土浦市立一中地区公民館 | 室内平面図のみで方位・周辺道路がなく、隣接する学校敷地（外形4387）と矩形外形4384等の中から公民館外形を一意に同定する独立根拠が不足。旧地図マーカーの内包のみによる選定を避けた判断は妥当。 |
| `facility:kanto-north-14336e747375e6550de3` | まちの駅 新・鹿沼宿 | 本館案内処と物産館の区別は把握されたが、営業案内画像は配置図でなく、Google埋込地図からの抽出を排除したため本館外形対応が未成立。保留妥当。 |
| `facility:kanto-north-1c3ab1ee8ca76b7c99e0` | 一般社団法人 矢板市観光協会 | 市PDF24999と運営者館内図により宿泊棟と観光協会受付の別は把握されたが、数値外形892（北棟）・900（南棟）への割り当てに必要な道路・河川等の地理的接続根拠が不足。初回404のみの停止理由を正しく訂正しており妥当。 |
| `facility:kanto-north-95b116c7383dbf61b3b4` | 熊谷駅観光案内所内 | 案内所は駅構内コンコースにあるが、数値外形7981（アズ本館＋北側駅舎）と平台屋根7982の境界が概略構内図では確定できず、商業ビル全体重心を安易に流用しない判断は妥当。 |
| `facility:kanto-north-f45d3f2e581350eedec5` | 道の駅かわもと 深谷市物産館 | 物産館（1280-1）とJA直売所（1279-2）が敷地内に並立するが、2026年10月移転後の配布先棟を外形に対応付ける配置根拠が不足。駅全体点の流用を避けた判断は妥当。 |
| `facility:kanto-north-shiraoka-temporary-shoko` | 白岡市役所仮設本庁舎 商工観光課 | Issue16の広報28頁を再利用して照合したが、2026年版GSIタイル上に「はぴすしらおか東・来庁者駐車場南」の大型仮設棟外形が未収録。旧本庁舎や小外形の流用を拒否した判断は妥当。 |

※保留6件の条件はいずれも入口・室内測量を要求するものではなく、AGENTS.mdの「建物代表点基準（別棟・敷地内他施設との区別）」に合致しており、不当に厳しくないことを確認。

---

## 3. 旧Opusレビュー（thread:2133bd4f）全指摘と対応の照合

| # | 旧Opus重大/任意指摘 | HEAD `a3a9e927` での対応・現況 | 照合結果 |
| :--- | :--- | :--- | :--- |
| 1 | **日立市役所の保留**: 照合で競合解消可能なのに未実施で停止していた | 市報9頁とGSI外形（本庁舎・大屋根・ホール）を照合し、index 241の重心を算出して仮統合へ変更。競合解析は [hitachi-conflict.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/evidence/location-batch2/north-kanto/hitachi-conflict.json) に分離。 | **解消済み** |
| 2 | **羽生キヤッセの保留**: 3棟誤認、道路・水部未照合、条件過剰 | 4主要棟（バーガー・体験棟・市場・加工棟）の形状・面積と、外周道路・出入口・水部・円形丘の一致を検証。ムジナモ市場（index 26）の重心を算出して仮統合へ変更。 | **解消済み** |
| 3 | **未実施手法と定型停止文**: 公開CSV等が取得記録にないのにnewMethodに記載 | [outcomes.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/national/location-batch2/north-kanto/outcomes.json) で未実施手法を「（公開CSVは未実施）」と明記。停止条件も定型文から施設固有の具体的不足（外形未収録、対応根拠不足等）に修正。 | **解消済み** |
| 4 | **Issue16保留の引き継ぎ漏れ**: 白岡・吉岡がcheckedSources/holdRefから脱落 | [coverage.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/national/location-batch2/north-kanto/coverage.json) の `checkedSources` に `data/national/issue16/group-a-outcomes.json` を追加し、白岡（`/outcomes/8`）を `allowedReopened`、吉岡（`/outcomes/3`）を `holdRef` に明記。 | **解消済み** |
| 5 | **CRS仕様の根拠不足**: JGD2011/Web Mercatorの原本根拠なし | 地理院タイル一次仕様書（`siyou.html`）および実験仕様書（`vt_expt.html`）を取得して [retrievals.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/evidence/location-batch2/north-kanto/retrievals.json) に追加、[source-conditions.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/evidence/location-batch2/north-kanto/source-conditions.json) に `crsRefs` と根拠を明記。 | **解消済み** |
| 6 | **source-noveltyの比較範囲**: Issue5/7のみの比較で新規性誤読 | `data/national` および `data/evidence` の既往全テキスト（13,754ファイル）のスキャンへ拡大。 | **解消済み** |
| 7 | **vector-scan.pyのキャッシュ再実行失敗**: records空でassert失敗 | provenance復元・hash検証・混在版拒否処理を実装。`check-cache.py` による無通信再利用・改竄拒否テストを追加。 | **解消済み** |
| 8 | **verify.pyのmanifestUnchanged固定値出力** | 実マニフェストと履歴マニフェストの差分判定に基づく動的判定へ修正。 | **解消済み** |

---

## 4. 指摘事項（重大・任意）

### 重大指摘（Blockers）: **なし**
データ破壊、テスト失敗、座標の誤導出、ライセンス違反等のマージ阻害要因はありません。

### 任意指摘（Advisory / Minor）

1. **レビュー完了に伴うステータス昇格の推奨**
   - **箇所**: [outcomes.json:144, 204](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/national/location-batch2/north-kanto/outcomes.json#L144), [review-response.json](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/data/national/location-batch2/north-kanto/review-response.json)
   - **内容**: 日立・羽生の `stopCondition` に「独立再レビュー未了の間は仮統合。重大指摘が残れば採用しない」とあり、`review-response.json` にはプロバイダー上限による失敗履歴が記録されています。本レビューにより重大指摘がなく両候補の採用が承認されたため、親エージェントによる本マージ作業時に、`status: "adopted"` への昇格と再レビュー完了記録の反映を行うことを推奨します。
2. **Issue #35 クローズの前提確認**
   - **箇所**: PR #51 説明文（`Closes #35`）
   - **内容**: PRマージにより親Issue #35が自動クローズされます。Issue #35が求めていた「独立再レビューの完了と採用承認」が本レビューをもって充足されたことを確認した上でマージを行ってください。

---

## 5. 実施した検証と未確認の範囲

### 実施した検証
1. **検証スクリプトの再実行**:
   - `verify.py`: 成功 (`{"population": 91, "selected": 8, "integrated": 2, "held": 6, "nationalUnlocated": 603, "parentUnlocated": 605, "manifestUnchanged": false, "rawFilesChecked": 0, "fullLedgerCompared": false}`)
   - `verify.py --with-work`: 成功（159件の生ファイル・Range・タイル・ハッシュの完全一致を確認）
   - `check-cache.py`: 依存パッケージ（`pmtiles`, `mapbox-vector-tile`, `pillow`）をロードして実行し、`PASS: cached reuse; missing provenance rejected; bad hash rejected; no network` を確認。
   - `derive.py`: 依存パッケージ（`mapbox-vector-tile`, `shapely`）をロードして実行し、日立（index 241）と羽生（index 26）の重心算出・小数7桁丸め後内包（`roundedPointWithin: true`）の完全一致を確認。
2. **テストスイートの全件実行**:
   - `python3 -B -m unittest discover -s tools/national`: **全96テスト PASS**（OK）
   - `go test -count=1 ./...`: **全テスト PASS**（OK）
   - `https://github.com/aki05162525/manhole-card-map/blob/590fe84ce57b0c9a6f3ff28b41e888820a2168fb/tools/national/test_location_batch2_north_kanto.py`: マニフェスト差分2件、バインディング、および他6件・他地域・関係の不変性を確認。
3. **原本読解・数値外形・権利検証**:
   - 日立市報9頁、キヤッセ羽生園内図、白岡広報28頁、矢板アクセス案内PDF等を直接読解し、建物配置・方位・面積・道路水部との関係を検証。
   - 国土地理院最適化ベクトルタイルのPDL1.0準拠、出典・加工明示、Git上へのPBF2タイルのみの保存（一般資料は `data/work` に隔離）を確認。

### 未確認の範囲
- 現地でのマンホールカードの当日在庫および実際の配布窓口オペレーション
- 今回非選定となった83件の各施設詳細調査
- 一般Web/PDF原本の再配布許諾（リポジトリへコミットせずwork隔離されているため、アプリ配布への影響はありません）
- 実ブラウザー上での地図画面遷移操作（コード変更がなく、Mapsリンク検証スクリプト `maps-check.json` により正常性を確認済み）

---

## 6. ドキュメントとコードの不一致

1. **テスト失敗数の履歴記述**
   - **箇所**: [docs/verification/location-batch2-north-kanto.md:42](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/docs/verification/location-batch2-north-kanto.md#L42)
   - **記述**: `採用差分テストはmanifest追加前に3failure、追加後に成功。`
   - **現コード**: [test_location_batch2_north_kanto.py](file:///home/akihiro/.t3/worktrees/manhole-card-map/t3-b8a6e353/https://github.com/aki05162525/manhole-card-map/blob/590fe84ce57b0c9a6f3ff28b41e888820a2168fb/tools/national/test_location_batch2_north_kanto.py) に定義されているテストメソッドは `test_two_buildings_have_derived_points_and_bindings` と `test_exact_delta_and_six_nonadoptions` の2件です（subTestを含む開発初期の失敗数言及と思われますが、現コードのメソッド数とは表記上異なります）。
2. **その他整合性確認**:
   - 全国の未位置件数（605 → 603）、地域未位置（91 → 89）、配布ピン（981 → 983）、母集団91件、選定8件、仮統合2件、保留6件の数値は、文書・台帳・コード間で完全に一致していることを確認しました。

---

## 7. 結論

**PR #51 の仮統合2件（日立市役所下水道課、キヤッセ羽生「ムジナモ市場」）の採用を承認（Approve）し、保留6件の判断を支持します。**
旧Opusレビューにおける全指摘事項は適切に解消されており、重大なブロッカーは存在しません。マージおよびDraft解除に進むことを推奨します。
