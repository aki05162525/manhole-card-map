"""Independent integration comparison; run from repository root after /tmp Go build."""
import json, hashlib, pathlib, collections, sys
ROOT=pathlib.Path.cwd(); OUT=ROOT/'data/evidence/issue7/review-final'
sys.path.insert(0,str(ROOT/'tools/national'))
import assemble

def read(p): return json.loads(pathlib.Path(p).read_text())
def save(n,d): (OUT/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def digest(d): return hashlib.sha256(json.dumps(d,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def diff(a,b,path=''):
 if isinstance(a,dict) and isinstance(b,dict):
  return sum((diff(a[k],b[k],path+'/'+k) if k in a and k in b else [dict(path=path+'/'+k,old=a.get(k),new=b.get(k),oldExists=k in a,newExists=k in b)] for k in sorted(a.keys()|b.keys())),[])
 if type(a)!=type(b) or a!=b: return [dict(path=path,old=a,new=b)]
 return []
def rowsdiff(a,b,key):
 aa={key(x):x for x in a};bb={key(x):x for x in b};assert aa.keys()==bb.keys()
 return {k:diff(aa[k],bb[k]) for k in aa if diff(aa[k],bb[k])}
m=read('tools/national/manifest.json'); ledger,audit=assemble.assemble(ROOT,m)
base=read('data/work/issue7-baseline/ledger.json'); current=read('web/public/data/full.json'); fullbase=read('data/work/issue7-baseline/full.json')
changes=rowsdiff(base['places'],ledger['places'],lambda x:x['id']);save('ledger-all-field-diff.json',changes)
assert base['relations']==ledger['relations'];assert base['schema']==ledger['schema']
updates={u['facilityId']:u for s in m['locations'] if '/issue7/' in s['path'] for u in read(s['path'])['updates'] if u['facilityId'] in {r['facilityId'] for r in s['approved']}}
patches=[p for s in m['patches'] if '/issue7/' in s['path'] for i,p in enumerate(read(s['path'])[s['collection']]) if i in s['indexes']]
expected=json.loads(json.dumps(base)); byid={p['id']:p for p in expected['places']}
for p in patches:
 row=byid[p['match']['id']];assert row[p['field']]==p['old'];row[p['field']]=p['new']
for fid,u in updates.items():
 assert 'coordinate' not in byid[fid];byid[fid]['coordinate']=u['coordinate'];byid[fid]['evidence']=u['evidence']
assert expected==ledger
fullchanges=rowsdiff(fullbase['places'],current['places'],lambda x:x['id']);save('full-all-field-diff.json',fullchanges)
assert fullbase['relations']==current['relations'];assert fullbase['cards']==current['cards']
for k in current.keys()-{'places','relations','cards','pins'}: assert current[k]==fullbase[k]
assert set(fullchanges)==set(changes)
for fid,ds in fullchanges.items():
 allowed={'coordinate','evidence'} if fid in updates else set()
 allowed|={p['field'] for p in patches if p['match']['id']==fid}
 assert all(d['path'].split('/')[1] in allowed for d in ds)
cp={p['id']:p for p in current['places']}
for fid,u in updates.items():
 assert cp[fid]['coordinate']['lat']==u['coordinate']['lat'] and cp[fid]['coordinate']['lng']==u['coordinate']['lng']
 assert cp[fid]['evidence']==u['evidence']
for p in patches: assert cp[p['match']['id']][p['field']]==p['new']
bpins={p['id']:p for p in fullbase['pins']};npins={p['id']:p for p in current['pins']}
assert bpins.keys()<=npins.keys();assert all(p==npins[k] for k,p in bpins.items())
added=[npins[k] for k in npins.keys()-bpins.keys()];assert len(added)==198
assert {p['id'] for p in added}==set(updates)
regions=['hokkaido','tohoku','north-kanto','south-kanto','koshin','hokuriku','tokai','kinki-east','kinki-west','chugoku','shikoku','kyushu-okinawa']
original={u['facilityId']:u for r in regions for u in read(f'data/national/issue7/{r}.json')['updates']}
deferred=set(original)-set(updates);extras=set(updates)-set(original)
assert len(original)==202 and len(deferred)==6 and len(extras)==2
for fid in deferred: assert fid not in {p['id'] for p in current['pins']} and 'lat' not in cp[fid]['coordinate']
save('selection.json',dict(originalCount=len(original),selectedCount=len(updates),deferred=[dict(facilityId=f,name=cp[f]['name']) for f in sorted(deferred)],additional=[dict(facilityId=f,name=cp[f]['name']) for f in sorted(extras)],patches=patches))
reviewdiff={}
for r in ['hokkaido','koshin','kyushu-okinawa']:
 a=read(f'data/national/issue7/{r}.json'); b=read(f'data/national/issue7/{r}-reviewed.json')
 reviewdiff[r]=rowsdiff(a['updates'],b['updates'],lambda x:x['facilityId'])
 for ds in reviewdiff[r].values(): assert all(d['path'] in ({'/evidence/verificationMethod'} if r=='hokkaido' else {'/evidence/checkedAt','/evidence/verificationMethod'} if r=='koshin' else {'/evidence/checkedAt'}) for d in ds)
assert len(reviewdiff['hokkaido'])==26
save('reviewed-copy-diff.json',reviewdiff)
files=[]
for p in sorted(pathlib.Path('/tmp/issue7-final-review-generated').iterdir()):
 if p.is_file():
  h=hashlib.sha256(p.read_bytes()).hexdigest();match={str(d):p.read_bytes()==(d/p.name).read_bytes() for d in [pathlib.Path('web/public/data'),pathlib.Path('web/dist/data')]}
  if p.name=='manifest.json':
   for d in ['web/public/data','web/dist/data']:
    a=read(p);b=read(pathlib.Path(d)/p.name)
    a['inputs']['/tmp/issue7-final-ledger.json']=a['inputs'].pop('/tmp/issue7-final-review-ledger.json')
    assert a==b
  else: assert all(match.values())
  files.append(dict(file=p.name,sha256=h,byteMatches=match,normalizedMatch=True,normalization='only ledger input pathname' if p.name=='manifest.json' else None))
save('generated-file-comparison.json',files)
disc=[]
for p in sorted(pathlib.Path('data/national/issue7/reviews').glob('*.json')):
 d=read(p)
 for k,v in d.items():
  if (any(s in k.lower() for s in ['discrepanc','mismatch']) or (p.stem=='south-kanto' and k=='findings')) and v: disc.append(dict(source=str(p),field=k,value=v))
save('regional-discrepancies.json',disc)
summary=dict(ledgerDigest=digest(ledger),locationTotal=audit['locationsApplied'],patchTotal=audit['patchesApplied'],issue7Locations=len(updates),issue7PatchFields=len(patches),changedLedgerPlaces=len(changes),changedFullPlaces=len(fullchanges),ledgerRelationsUnchanged=True,fullRelationsUnchanged=True,cardsUnchanged=True,existingPinsUnchanged=True,addedPins=len(added),diffPaths=dict(collections.Counter(d['path'].split('/')[1] for ds in changes.values() for d in ds)),generatedMatchesPublicAndDist=True)
assert summary['ledgerDigest']=='d89e788b0998fd625ea3d2b06e4cae6ff85c1c30f1526bc18c6bd8908702a5ff'
save('summary.json',summary);print(json.dumps(summary,ensure_ascii=False,indent=2))
