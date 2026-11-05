"""Read-only review of source inputs; writes only this review's artifacts."""
import copy, hashlib, html, importlib.util, json, re, subprocess, tempfile
from pathlib import Path
R=Path.cwd(); D=R/'data/evidence/issue5/review-north-kanto'
def read(p): return json.loads((R/p).read_text())
def digest(p): return hashlib.sha256((R/p).read_bytes()).hexdigest()
def save(name,v): (D/name).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
src='data/national/issue5/north-kanto.json'; x=read(src)
ledger=read('data/work/issue5-baseline/ledger.json'); full=read('data/work/issue5-baseline/full.json')
inv={r['facilityId']:r for r in read('data/evidence/issue5/north-kanto/inventory.json')}
meta=read('data/evidence/issue5/north-kanto/candidate-revalidation.json')
refs={r['snapshotPath']:r for r in read('data/evidence/issue5/north-kanto/fetch-records.json')+read('data/evidence/issue5/north-kanto/fetch-additional-records.json') if 'snapshotPath' in r}
paths={u['evidence']['snapshotPath'] for u in x['updates']}
paths.update(e['snapshotPath'] for r in meta for e in r['identityEvidence'])
paths.add('data/evidence/issue5/north-kanto/4dc6346baede4109ac63.html')
terms=['配布場所・時間','同じ建物','水道お客様センター','桜川市役所 真壁庁舎','川島町役場1階','川島町役場までの交通アクセス','著作権について','下水道課']
proof=[]
for p in sorted(paths):
 raw=(R/p).read_text(); txt=html.unescape(re.sub('<[^>]+>',' ',raw));txt=re.sub(r'\s+',' ',txt)
 excerpts=[]
 for term in terms:
  i=txt.find(term)
  if i>=0: excerpts.append({'term':term,'text':txt[max(0,i-80):i+650]})
 links=[]
 for m in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>',raw,re.S):
  if any(t in m[1] for t in ['36.305','36.278','35.992','139.484']): links.append({'label':html.unescape(re.sub('<[^>]+>','',m[2])),'href':html.unescape(m[1])})
 h=digest(p);assert h==refs[p]['snapshotSHA256']
 proof.append({'sourceUrl':refs[p]['sourceUrl'],'snapshotPath':p,'snapshotSHA256':h,'hashMatches':True,'originalFetchedAt':refs[p]['fetchedAt'],'reviewMethod':'保存原本を独立再読。再取得時刻ではない。','excerpts':excerpts,'coordinateLinks':links})
save('source-review.json',proof)
expected=[(36.3052692,139.9794245)]*2+[(36.2783968826407,140.091696381569),(35.9925196,139.4844419)]
for u,(lat,lng) in zip(x['updates'],expected):
 assert u['coordinate']==dict(lat=lat,lng=lng)
 raw=(R/u['evidence']['snapshotPath']).read_text()
 needle=(f'!3d{lat}!4d{lng}' if 'chikusei' in u['evidence']['sourceUrl'] else f'q={lat},{lng}' if 'sakuragawa' in u['evidence']['sourceUrl'] else f'!1d{lng}!2d{lat}')
 assert needle in raw
spec=importlib.util.spec_from_file_location('assembler',R/'tools/national/assemble.py'); mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
before,audit=mod.apply_locations(ledger,x['updates'],R)
clean=copy.deepcopy(x['updates']); corrections=[]
for i,u in enumerate(clean):
 old=u['evidence'].pop('fetchedAt'); corrections.append({'targetFile':src,'operation':'remove','path':f'/updates/{i}/evidence/fetchedAt','old':old,'facilityId':u['facilityId'],'coordinateChange':False,'applyTo':'新規の統合用コピーのみ。元候補を変更しない。','preserveIn':['data/evidence/issue5/north-kanto/fetch-records.json','data/evidence/issue5/north-kanto/fetch-additional-records.json','data/evidence/issue5/review-north-kanto/original-evidence.json']})
after,_=mod.apply_locations(ledger,clean,R)
save('original-evidence.json',[{'facilityId':u['facilityId'],'evidence':u['evidence']} for u in x['updates']])
save('proposed-location-updates.json',{'schema':1,'updates':clean})
# Exercise exact production type declarations and decodeLedger without modifying code.
go=(R/'cmd/builddata/ledger.go').read_text(); declarations=go[go.index('type Evidence struct'):go.index('func cardSourceHash')]
probe='package main\nimport("bytes";"encoding/json";"fmt";"io";"os")\n'+declarations+'\nfunc main(){b,_:=os.ReadFile(os.Args[1]);var l PlaceLedger;if e:=decodeLedger(b,&l);e!=nil{fmt.Println(e);os.Exit(1)};fmt.Println("decodeLedger: OK")}\n'
results=[]
with tempfile.TemporaryDirectory() as tmp:
 p=Path(tmp);(p/'probe.go').write_text(probe)
 for label,value in [('original',before),('proposed',after)]:
  (p/'ledger.json').write_text(json.dumps(value)); run=subprocess.run(['go','run',str(p/'probe.go'),str(p/'ledger.json')],capture_output=True,text=True)
  results.append({'case':label,'returncode':run.returncode,'stdout':run.stdout.strip(),'stderr':run.stderr.strip()})
assert results[0]['returncode']!=0 and 'unknown field "fetchedAt"' in results[0]['stdout'];assert results[1]['returncode']==0
old_corrections=[]
for c in x['corrections']:
 value=read(c['targetFile'])
 for k in c['path'].strip('/').split('/'): value=value[int(k)] if isinstance(value,list) else value[k]
 assert value==c['old'];old_corrections.append(dict(c,oldMatches=True))
save('inherited-exact-corrections.json',old_corrections)
reasons=[
 '配布記事が平日3階下水道課と休日1階総合案内を同じ本庁舎内と明示。本庁舎ラベルの目的地点を採録。0x0:0x0は名前付きPOIではないが建物指定を否定しない。@中心・下館駅の蓋・東側駐車場とは別。旧POI説明は今回候補で解消。P05の386.3m離れた未承認候補は採用根拠にしていない。',
 '同一建物であることは配布記事本文に明示され、総合案内用の別棟点を推定していない。3階窓口と同じ建物代表点の共有が妥当。旧POI説明は今回候補で解消。',
 '配布記事の水道お客様センター＝真壁庁舎2階・飯塚911を、公式公共施設ガイドの真壁庁舎名称・住所・q数値リンクに接続できる。岩瀬・大和庁舎、住所の自動ジオコード、蓋展示点ではない。旧baselineの座標未確認は建物目的地点の原典で解消。',
 '配布本文が役場1階上下水道課でも配布と明示。役場アクセス記事の下八ツ林870-1と、徒歩経路の第2地点（川島町役場）が一致。出発バス停・@中心・さまちか事務所923を除外できる。旧baselineの座標未確認は役場目的地点の原典で解消。']
rows=[]
for i,u in enumerate(x['updates']):
 fid=u['facilityId']; bp=next(p for p in ledger['places'] if p['id']==fid); fp=next(p for p in full['places'] if p['id']==fid)
 assert 'coordinate' not in bp and fp['coordinate']['status']=='unconfirmed'
 rows.append({'facilityId':fid,'name':bp['name'],'decision':'correction-required','coordinateDecision':'accepted','coordinate':u['coordinate'],'scope':'building','reason':reasons[i]+' ただしfetchedAtがGo非対応のため、現状の候補行はそのまま統合不可。','priorReview':inv[fid]['oldReviews'],'baselineCoordinateStatus':fp['coordinate'],'identityEvidence':[{k:e[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']} for e in meta[i]['identityEvidence']],'coordinateEvidence':u['evidence'],'requiredCorrection':corrections[i]})
inputs=[src,'data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','tools/national/assemble.py','cmd/builddata/ledger.go','data/evidence/issue5/north-kanto/README.md']
report={'schema':1,'region':'north-kanto','checkedAt':'2026-11-05','actorType':'ai','reviewMethod':'保存公式原本・リンク・baseline・旧レビューの独立再読。現行Web再取得や現地測量ではない。','summary':{'accepted':0,'deferred':0,'correction-required':4,'coordinateAccepted':4,'unresolvedRetained':112},'reviews':rows,'exactCorrections':corrections,'unresolvedScope':'112件は旧履歴を保持。現行全件再調査済み・解消とは扱わない。','rights':'PRIVATE repo・デプロイなし。建物数値地点の採用判断と原本HTMLの外部公開許諾は別。包括ライセンスを付与しない。筑西の転載制限は原本に確認。桜川・川島の包括許諾は確認していない。','documentCodeDiscrepancies':[{'document':'data/evidence/issue5/north-kanto/README.md','claim':'文書と実装コードの食い違いは、今回読んだ範囲では発見していない','finding':'候補evidence.fetchedAtを生成するがGo Evidenceは7フィールドのみ。assembler evidence()はcheckedAtだけ正規化して未知キーを保持し、apply_locations()がそのままplace.evidenceへ渡す。厳密デコードで失敗を再現。','code':['data/evidence/issue5/north-kanto/assemble.py:39','tools/national/assemble.py:60','tools/national/assemble.py:160','cmd/builddata/ledger.go:17','cmd/builddata/ledger.go:88']}],'historicalEvidenceDiscrepancy':'筑西2件の旧「目的地POI／本庁舎POI」は原本の0x0:0x0と不一致。旧4フィールドのexact old一致を検証、訂正案を保持。','verification':{'inputHashes':{p:digest(p) for p in inputs},'uniqueSourceHashesVerified':len(proof),'coordinateLiteralsVerified':4,'oldCorrectionValuesVerified':len(old_corrections),'decodeProbe':results,'scopeHandling':'scopeはapply_locationsが転記せず、facilityIdでplaceを特定。coordinateとevidenceのみ更新。fetchedAtはevidence内部なので通過。'}}
assert len(x['unresolved'])==112
(R/'data/national/issue5/reviews/north-kanto.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
save('verification.json',report['verification'])
print(json.dumps(report['summary']));print(json.dumps(results))
