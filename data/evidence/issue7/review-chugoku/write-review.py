import json,pathlib,hashlib
R=pathlib.Path('data/evidence/issue7/review-chugoku')
def read(p):return json.loads(pathlib.Path(p).read_text())
d=read('data/national/issue7/chugoku.json');p=read('data/evidence/issue7/chugoku/coordinate-proof.json'); places={p['id']:p for p in read('data/work/issue7-baseline/ledger.json')['places']}
reasons=[
'P05原featureの固有名称と矢掛2639が町配布案内・運営者案内に一致。古民家施設内の建物代表点として採用。',
'市配布原本が児島駅前1-37の2階を児島商工会議所と明示。P05の児島産業振興センターと同建物。児島駅1-107とは区別。',
'市配布原本が児島産業振興センター1階を明示し、P05固有名称・住所が一致。2階の商工会議所と代表点を共有できるがIDは維持。',
'P05河内140は下松スポーツ公園体育館の固有feature。設備諸元PDF第1頁も同名・河内140・メインアリーナ1698㎡。管理者原本をCP932で読むとトラックワンアリーナ（体育館）、約1700㎡、空調設置令和2年、事務所（体育館内）、体育館窓口配布を確認できる。10140は管理者所在地の表記差として残すが、別体育館や別棟を示す差ではない。地番の法的同一性を証明したとはしない。',
'市施設一覧はJR西条駅2階・西条町西条475番地2・082-430-7701、県観光は同駅2階・西条本町12-3・同電話。同一駅建物の同一案内所として十分。くぐり門17-1は市一覧の別行。住所そのものは訂正しない。',
'県観光の旧柚木家住宅詳細は玉島3-8-25・086-522-0151でq目的地を指定。市配布原本は新倉敷駅の代替窓口を別に記載。混在address/phoneの2訂正と本座標を同時採用する。代替関係はそのまま維持。',
'市施設詳細qが現施設の秋穂東1520-4に対応し運営者所在地と一致。市2026年度会見は令和10年秋（2028年秋）の移転先オープン予定を明記。将来計画を現在の移転完了と解さず現点を採用。開業時に再照合。',
'協会入会案内の地図はLatLngをmarker.positionへ渡すため表示中心だけではない。協会所在地472-10は市配布原本と一致。市はJR新見駅471を別配布先として列挙しており駅には転用しない。',
'運営者原本のseo.contextはbusinessName=米子市観光センター・businessLocationFormatted=皆生温泉3丁目1-1とbusinessLocationCoordinatesを同じcontextに保持。市施設一覧も同住所。汎用サイト表示中心ではなく対象施設の位置情報。',
'公式アクセスの4経路から施設名をBase64復号して終点を照合。経路上の湯原IC付近ENEOS・倉吉駅・三朝温泉と表示中心を除外すると円形劇場の同一placeId、同一数値が4件。アクセス本文の同住所の隣棟（人権文化センター）やP05明倫体育館を用いない。観光協会の円形校舎利用説明と館公式配布記事が対応。'
]
reviews=[]
for u,pr,reason in zip(d['updates'],p,reasons):
 reviews.append({'facilityId':u['facilityId'],'name':pr['name'],'status':'accepted','reason':reason,'target':'places','field':'coordinate','old':places[u['facilityId']].get('coordinate'),'new':u['coordinate'],'evidence':u['evidence'],'supportingEvidence':[{'sourceUrl':s['url'],'snapshotPath':s['snapshotPath'],'snapshotSHA256':s['snapshotSHA256']} for s in pr['supportingSources']], 'numericCheck':'data/evidence/issue7/review-chugoku/numeric-checks.json'})
 if '424799' in u['facilityId']:reviews[-1]['requiresAtomicCorrections']=[{'facilityId':u['facilityId'],'field':f} for f in ['address','phone']]
corrections=[dict(c,status='accepted',reviewReason='固定ledgerのoldと文字列完全一致。市配布原本の各施設欄からnewを照合。配布関係・配布状態は変更しない。') for c in d['corrections']]
deferred=[]
for x in d['unresolved']:
 item={'facilityId':x['facilityId'],'status':'deferred','reviewDepth':'inherited-unresolved-not-independently-deep-reviewed','reason':'本レビューの採用対象外。元成果の保留を維持。','inheritedReason':x['reason']}
 if '85f80ce977bcdf56d4' in x['facilityId']:
  item.update(reviewDepth='focused-relocation-review',reason='広報2023年5月原本で新支所土師288-1・5月8日移転を確認。カードは移転前4月1日から休止との原本に対し新庁舎への継承根拠なし。旧ID・旧所在地・旧配布関係を維持し、新庁舎への住所訂正も座標採用もしない。')
 if '442369a0c345a4ef96' in x['facilityId']:
  item.update(reviewDepth='focused-separation-review',reason='市配布原本でJR新見駅471と観光協会472-10を別施設と確認。今回の協会マーカーを駅へ転用しない。')
 deferred.append(item)
discrepancies=[{'document':'data/evidence/national/locations-chugoku-shikoku/README.md','code':'tools/national/assemble.py:repo_path','finding':'READMEは統合用・形式上の食い違いなしとするが旧追補101件のsnapshotPathが絶対パス。repo_pathは絶対パスを拒否。今回はrepo相対参照に従う。'}, {'document':'data/evidence/issue5/west-south/README.md','code':'cmd/builddata/ledger.go:Evidence / strict decoder','finding':'READMEは食い違いなしとするが旧訂正EvidenceにfetchedAtが含まれる。現行Evidenceは7フィールド、厳密デコードは未知フィールドを拒否。今回の15 Evidenceは7フィールドだけに従う。'}]
out={'schema':1,'region':'chugoku','reviewedAt':'2026-11-05','input':'data/national/issue7/chugoku.json','inputSHA256':hashlib.sha256(pathlib.Path('data/national/issue7/chugoku.json').read_bytes()).hexdigest(),'scope':'10座標候補と5訂正を独立原本レビュー。残47は保留維持（長船・新見駅の重点照合を除き全深掘りを主張しない）。','acceptedIds':[r['facilityId'] for r in reviews],'acceptedCorrectionKeys':[{'facilityId':c['facilityId'],'field':c['field']} for c in corrections],'reviews':reviews,'corrections':corrections,'deferred':deferred,'correctionRequired':[],'documentCodeDiscrepancies':discrepancies,'sourceConditions':{'p05':'2022個別p05.htmlのコメント外CC_BY_4.0表示を確認。一般規約は2026-03-23施行PDL1.0で個別権利表示を留保。v3_0別カタログと混同しない。出典：国土交通省 国土数値情報 市町村役場等及び公的集会施設 2022年版。原数値抽出・審査：AI。国土交通省の承認を意味しない。','web':'自治体・運営者原本の位置事実を審査した。HTML/PDF全文の無制限な再公開許諾を判定したものではなく、P05条件を他サイトへ適用しない。保存原本参照は検証用。','precision':'建物代表点で十分。P05はJGD2011 EPSG:6668のGeoJSON経度緯度順を転記。他Web原本は緯度経度の用途・軸順を確認するが明示されないEPSGや測量精度を断定しない。'},'unchanged':['manifest','code','fixed baseline','distribution status','distribution relationships','original deliverables'],'validation':'data/evidence/issue7/review-chugoku/validation.json'}
pathlib.Path('data/national/issue7/reviews/chugoku.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(R/'README.md').write_text('''# Issue 7 中国地方 独立レビュー

座標候補10件 accepted、住所電話訂正5件 accepted。判定・採用ID・exact old/newは `data/national/issue7/reviews/chugoku.json`。旧柚木家の座標は同IDの住所・電話分離訂正と同時採用する条件付き。台帳・manifestへの反映は実施していない。

長船は旧ID・旧所在地・旧関係を維持し新庁舎へ移さない。新見協会点をJR新見駅へ転用しない。残47は保留維持であり、全件独立深掘り済みではない。

`verify.py` は入力を変更せず、原ZIPから4候補、HTMLから6候補の原数値・軸順を独立抽出し、原本hash、Go Evidenceの7フィールド、固定ledgerの訂正old値を検査する。`numeric-checks.json` に原feature・CRS・原数値・経路の施設名と表示中心を記録。`identity-excerpts.json` は同定の補助抜粋。下松管理者HTMLはCP932。PDF第1頁の諸元と管理者のアリーナ面積・空調説明を併用した。

ネットワーク再取得はしておらず、新しいfetchedAtを捏造しない。保存原本のhash検証と、独立の取得時刻の立証は異なる。相対snapshotPathのみを使用。原数値抽出と座標利用の判断は、原本全文の公開許諾の判断とは区別する。P05個別CC_BY_4.0と一般PDL1.0は上書き関係として扱わない。

Go検査は現行 `cmd/builddata/ledger.go` からEvidence構造体とvalidateEvidence関数を抽出した `evidence-probe.go` で15件を厳密デコード・検証し、結果を `go-evidence.txt` に保存。

文書コード相違は2件：旧中国四国READMEの統合可能という説明に対し101件の絶対snapshotPathをassemble.pyが拒否すること、旧west-south READMEの相違なしという記載に対し旧訂正EvidenceのfetchedAtを現行Goが未知フィールドとして拒否すること。今回成果はコードに従う。
''')
print('Review written: 10 accepted coordinates; 5 accepted corrections; 47 deferred retained.')
