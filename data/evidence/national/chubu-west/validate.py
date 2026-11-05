import pathlib,json,hashlib,re,sys
from collections import Counter
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from decisions import C
R=pathlib.Path('data/evidence/national/chubu-west')
def load(p):return json.loads(pathlib.Path(p).read_text())
x=load('data/work/national-input/full.json');q=load('data/work/national-input/quality.json');l=load('data/overrides/regions/chubu-west.json');a=load('data/national/regions/chubu-west.json');m=load(R/'manifest.json')
expected={c['id'] for c in x['cards'] if c['id'][:2] in ('21','22','23')};actual=[c['cardId'] for c in a['cards']]
assert set(actual)==expected and len(actual)==len(set(actual))==123
rawrels={(r['cardId'],r['placeId']) for r in x['relations'] if r['cardId'] in expected}
auditrels=[(c['cardId'],r['legacyPlaceId']) for c in a['cards'] for r in c['relations']]
assert set(auditrels)==rawrels and len(auditrels)==len(set(auditrels))==165
ps={p['id']:p for p in l['places']};assert len(ps)==len(l['places'])
alias={pid:p['id'] for p in l['places'] for pid in p['legacyIds']};assert len(alias)==sum(len(p['legacyIds']) for p in l['places'])
rr=[(r['cardId'],r['placeId']) for r in l['relations']];assert len(rr)==len(set(rr))
assert set(ps)=={r['placeId'] for r in l['relations']}
for r in l['relations']:
 assert r['sourceHash']==q['sourceHashes'][r['cardId']]
 assert any((r['cardId'],pid) in rawrels for pid in ps[r['placeId']]['legacyIds'])
for item in l['places']+l['relations']:
 e=item['evidence'];assert e['actorType']=='ai' and e['checkedAt']=='2026-11-05'
 assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
for item in m:
 if 'snapshotPath' in item:assert hashlib.sha256(pathlib.Path(item['snapshotPath']).read_bytes()).hexdigest()==item['snapshotSHA256']
for p in l['places']:
 if 'coordinate' not in p:continue
 c=C[p['legacyIds'][0]];assert p['coordinate']=={k:c[k] for k in ['lat','lng']}
 raw=pathlib.Path(p['evidence']['snapshotPath']).read_text(errors='replace')
 assert all(str(c[k]) in raw for k in ('lat','lng'))
 assert 'q' in c['locator'] or 'GeoCoordinates' in c['locator'] or 'google.maps.Marker' in c['locator']
 assert -90<=c['lat']<=90 and -180<=c['lng']<=180
# Text search is an integrity check, not coordinate approval: each locator was manually reviewed in decisions.py.
report={'result':'passed','auditCards':123,'auditRelations':165,'uniqueFacilities':len(ps),'uniqueRelations':len(rr),'coordinateFacilities':sum('coordinate' in p for p in ps.values()),'snapshotHashesChecked':sum('snapshotPath' in e for e in m),'checks':['全割当カード・関係の網羅性','重複・孤立IDなし','不変quality.jsonのsourceHash','全取得原本と採用根拠のSHA256','承認座標数値の原典内存在・明示locator','新規窓口proposalを旧関係に混入しない']}
(R/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
