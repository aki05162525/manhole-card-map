"""Keep exact re-fetched bytes by reference when already present; never modify originals."""
import pathlib,json,hashlib
D=pathlib.Path('data/evidence/issue7/chugoku')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
refs={}
for x in json.loads((D/'prior-audit.json').read_text()):
 for e in x['priorEvidence']:refs[e['snapshotSHA256']]=e['snapshotPath']
fs=json.loads((D/'fetches.json').read_text());n=0
for f in fs:
 if not f.get('snapshotPath'):continue
 p=pathlib.Path(f['snapshotPath']); h=f['snapshotSHA256'];assert sha(p)==h
 if h in refs and str(p).startswith(str(D)+'/'):
  target=pathlib.Path(refs[h]);assert sha(target)==h
  f['snapshotPath']=str(target);f['storageNote']='今回実取得したbytesが旧原本と完全一致。重複bytesは保存せずrepo相対パスで参照。fetchedAtは今回の実取得時刻。'
  p.unlink();n+=1
 elif p.read_bytes().startswith(b'%PDF') and p.suffix!='.pdf':
  target=p.with_suffix('.pdf');p.rename(target);f['snapshotPath']=str(target)
 f['facilityIds']=sorted(set(f['facilityIds']))
(D/'fetches.json').write_text(json.dumps(fs,ensure_ascii=False,indent=2)+'\n')
print('same-byte re-fetches referenced:',n)
