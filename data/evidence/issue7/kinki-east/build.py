"""Offline regeneration/validation. Does not fetch or write inputs."""
from investigate import ROOT,BASE,read,save,sha,A,P,U
from decisions import P05,NOTES
from read_html import parse
import json,zipfile,io,datetime,pathlib,re,subprocess
CHECKED='2026-11-05'
ZIP='data/evidence/issue5/chubu/P05-22_GML.zip'
ZM=read(ZIP+'.source.json'); ZHASH=sha((ROOT/ZIP).read_bytes());assert ZHASH==ZM['sha256']
Z=zipfile.ZipFile(ROOT/ZIP);records=[]
for pref in ['24','25','26']:
 inner='P05-22_'+pref+'_GML.zip';s=zipfile.ZipFile(io.BytesIO(Z.read(inner)));name='P05-22_'+pref+'.geojson';d=json.loads(s.read(name))
 assert d['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
 for i,f in enumerate(d['features']):records.append(dict(pref=pref,index=i,feature=f,member=inner+'!'+name))
R={(r['pref'],r['index']):r for r in records}
logs=sum([read('data/evidence/issue7/kinki-east/'+n) for n in ['fetch-log.json','follow-log.json','extra-log.json']],[])
byurl={r['sourceUrl']:r for r in logs};targets={}
for n in ['follow-targets.json','extra-targets.json']:
 for keys,urls in read('data/evidence/issue7/kinki-east/'+n).items():
  for k in keys.split():targets.setdefault(k,[]).extend(urls)
oldNational={x['facilityId']:x for x in read('data/national/location-updates/kinki.json')['unresolved']}
oldSources={x['snapshotPath']:x for x in read('data/evidence/issue5/kinki/reused-sources.json')}
updates=[];unresolved=[];audit=[];refs={};selected=[]
def source_ref(x):
 path=x['snapshotPath'];assert (ROOT/path).is_file(),path
 digest=sha((ROOT/path).read_bytes());assert digest==x['snapshotSHA256'],path
 refs[path]={'snapshotPath':path,'snapshotSHA256':digest,'sourceUrl':x.get('sourceUrl',x.get('url')),'fetchedAt':x.get('fetchedAt'),'retrievalTimeKnown':x.get('fetchedAt') is not None}
 return refs[path]
for l in logs:
 if 'snapshotPath'in l:
  ref=source_ref(l);ref['fetchedAtDefinition']='HTTP request start UTC, logged at retrieval; completion time not recorded'
for name in ['p05-catalog','p05-terms']:
 source_ref(read('data/evidence/issue5/chubu/'+name+'.source.json'))
refs[ZIP]={'sourceUrl':ZM['url'],'snapshotPath':ZIP,'snapshotSHA256':ZHASH,'fetchedAt':ZM['fetchedAt'],'retrievalTimeKnown':True,'metadataPath':ZIP+'.source.json'}
# These old decisions/reviews were reread, not fetched again.
reviewPaths=['data/national/issue5/kinki.json','data/national/issue5/kinki-reviewed.json','data/national/issue5/reviews/kinki.json','data/national/location-updates/kinki.json','data/evidence/issue5/kinki/README.md','data/evidence/issue5/review-kinki/README.md']
for a in A:
 k=a.removeprefix('facility:kinki-');assert (k in P05) != (k in NOTES),a
 p=P[a];old=U[a];oe=old['distributionEvidence'];om=oldSources.get(oe['snapshotPath'],{})
 source_ref(dict(oe,fetchedAt=om.get('fetchedAt')))
 oldText=parse((ROOT/oe['snapshotPath']).read_bytes()).txt()
 new=byurl[oe['sourceUrl'].replace('http:','https:')];assert 'snapshotPath'in new
 newText=parse((ROOT/new['snapshotPath']).read_bytes()).txt()
 extra=[byurl[u] for u in targets.get(k,[])];attempts=[]
 for r in [new]+extra:
  attempts.append(dict(kind='new-http-retrieval',sourceUrl=r['sourceUrl'],fetchedAt=r['fetchedAt'],result=r.get('error','HTTP '+str(r.get('status'))),**{f:r[f] for f in ['snapshotPath','snapshotSHA256','finalUrl'] if f in r}))
 attempts.append({'kind':'new-p05-search-of-reused-original','snapshotPath':ZIP,'snapshotSHA256':ZHASH,'sourceUrl':ZM['url'],'result':'全国ZIP内24/25/26の全レコードを名称・住所で新規探索。選択/除外の個別理由はfindingとp05Candidates。原本の再ダウンロードではない。'})
 if k in P05:
  pref,index,reason=P05[k];r=R[pref,index];props=r['feature']['properties'];lng,lat=r['feature']['geometry']['coordinates'];selected.append({'facilityId':a,**r})
  e={'sourceUrl':ZM['url'],'snapshotPath':ZIP,'snapshotSHA256':ZHASH,'sourceLocator':f"{r['member']} / features[{index}] (0-based) / P05_001={props['P05_001']}; P05_003={props['P05_003']}; P05_004={props['P05_004']}; geometry.coordinates=[{lng},{lat}]。{reason} 現配布原本: {new['snapshotPath']} (SHA256 {new['snapshotSHA256']})。",'checkedAt':CHECKED,'actorType':'ai','verificationMethod':'AIが国土数値情報P05-22の施設点を原本ZIPから抽出し、新規取得の公式配布案内の名称・住所・庁舎指定と照合。現建物の代表点として提案。JGD2011十進度を変更せず採録。入口・室内窓口の測量ではない。Google地図本体・住所代表点・蓋位置・viewportは不使用。'}
  updates.append({'facilityId':a,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':e})
  category='原典不足（P05追加照合で解消）';nextSource=None;decision='candidate'
 else:
  category,reason,nextSource=NOTES[k];decision='unresolved'
  unresolved.append({'facilityId':a,'reasonCategory':category,'reason':reason,'nextSource':{'url':extra[-1]['sourceUrl'] if extra else new['sourceUrl'],'task':nextSource},'investigationStatus':'new-investigation-attempted; coordinate-unresolved','attempts':attempts})
 def excerpt(t):
  keyword=re.split('[ （(]',p['name'])[0];i=t.find(keyword,100)
  if i<0:i=t.find('配布場所')
  if i<0:i=t.find('現在位置')
  return t[max(i,0):max(i,0)+1500]
 audit.append({'facilityId':a,'name':p['name'],'address':p['address'],'oldReason':old['reason'],'oldReasonCategory':'原典不足' if '現住所に結びついた' in old['reason'] else '未確認の数値用途・原典不足','oldRecordRead':{'issue5':'data/national/issue5/kinki.json','national':'data/national/location-updates/kinki.json' if a in oldNational else None,'review':'data/national/issue5/reviews/kinki.json (region review; no individual coordinate acceptance for this ID)'},'oldDistributionSource':oe,'oldDistributionExcerpt':excerpt(oldText),'newDistributionSource':new,'newDistributionExcerpt':excerpt(newText),'decision':decision,'reasonCategory':category,'finding':reason,'nextInvestigation':nextSource,'attempts':attempts})
assert len(updates)==16 and len(unresolved)==38
# Explanation-only correction proposal, no ledger address/relations mutation.
a='facility:kinki-129ffa1ab731e3dda85e'
corr={'facilityId':a,'targetPath':'data/national/issue5/kinki.json','targetLocator':f'unresolved[facilityId={a}].reason','old':U[a]['reason'],'new':NOTES['129ffa1ab731e3dda85e'][1],'reason':'旧説明は分庁舎2を現住所と呼んでいるが、現行の公式窓口案内は本庁舎5階。旧施設の関係を保存し、再開時の配布窓口指定が未確認であることと区別する。名称・住所・relation状態の自動変更は提案しない。','evidence':[dict(byurl['https://www.city.nagaokakyo.lg.jp/0000007110.html']),dict(byurl['https://www.city.nagaokakyo.lg.jp/0000000225.html'])]}
for e in corr['evidence']:
 for field in list(e):
  if field not in {'sourceUrl','snapshotPath','snapshotSHA256'}:e.pop(field)
 e.update(sourceLocator='下水道施設課の現窓口: 本庁舎5階。分庁舎2の現用途と区別。',checkedAt=CHECKED,actorType='ai',verificationMethod='新規取得した公式配布記事・庁舎案内をAIが再読し、旧説明との差を確認。配布状態・台帳住所は変更しない。')
out={'schema':1,'updates':updates,'unresolved':unresolved,'corrections':[corr]}
ids=[x['facilityId'] for x in updates+unresolved];assert len(ids)==len(set(ids)) and set(ids)==set(A)
assert not set(P05)&set(NOTES)
for group,assigned in read('data/work/issue7-baseline/assignments.json').items():
 if group!='kinki-east':assert not set(A)&set(assigned),group
expected={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
for u in updates:
 assert set(u['evidence'])==expected
 r=next(r for r in selected if r['facilityId']==u['facilityId']);assert r['feature']['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
 assert u['scope']=='building' and -90<u['coordinate']['lat']<90 and -180<u['coordinate']['lng']<180
hashes=read('data/work/issue7-baseline/hashes.json')
for n,h in hashes.items():assert sha((ROOT/'data/work/issue7-baseline'/n).read_bytes())==h,n
save('selected-p05-records.json',selected);save('classification.json',audit);save('source-provenance.json',list(refs.values()))
reviewHashes={p:sha((ROOT/p).read_bytes()) for p in reviewPaths}
save('input-checksums.json',{'fixedInputs':hashes,'hashesFileSHA256':sha((ROOT/'data/work/issue7-baseline/hashes.json').read_bytes()),'readOldRecords':reviewHashes})
path=ROOT/'data/national/issue7/kinki-east.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
# Existing tracked originals/code cannot be changed; untracked parallel workers are irrelevant.
changed=subprocess.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines();ownPrefixes=('data/evidence/issue7/kinki-east/','data/national/issue7/kinki-east.json')
save('validation.json',{'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'assigned':len(A),'updates':len(updates),'unresolved':len(unresolved),'corrections':1,'allIdsClassifiedExactlyOnce':True,'allEvidenceSevenFields':True,'rawZIPHashVerified':True,'coordinatesReextractedFromOriginalZIP':True,'newHTTPAttempts':len(logs),'newHTTPSuccess':sum('snapshotPath'in l for l in logs),'newHTTPFailures':sum('error'in l for l in logs),'oldAndNewSourceHashesVerified':len(refs),'fixedInputHashesVerified':True,'trackedChangesObserved':changed,'trackedChangesOutsideOwnPaths':[p for p in changed if not p.startswith(ownPrefixes)],'scope':'Structural/hash/numeric validation; semantic building identification is AI judgment awaiting parent independent review.'})
print(json.dumps({'updates':len(updates),'unresolved':len(unresolved),'attempts':len(logs),'sources':len(refs),'trackedChanges':changed},ensure_ascii=False))
