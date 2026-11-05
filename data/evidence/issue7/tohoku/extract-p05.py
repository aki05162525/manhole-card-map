"""Reproduce P05 candidate search from the existing national ZIP; no downloads."""
import json,pathlib,zipfile,io,difflib
D=pathlib.Path('data/evidence/issue7/tohoku');z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');records=[]
for code in range(2,8):
 outer=f'P05-22_{code:02}_GML.zip';member=f'P05-22_{code:02}.geojson';sub=zipfile.ZipFile(io.BytesIO(z.read(outer)));fc=json.loads(sub.read(member))
 for n,f in enumerate(fc['features']):records.append({'locator':outer+'!'+member+'#/features/'+str(n),'feature':f})
(D/'p05-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
ids=json.load(open('data/work/issue7-baseline/assignments.json'))['tohoku'];ledger=json.load(open('data/work/issue7-baseline/ledger.json'));places={p['id']:p for p in ledger['places']};out=[]
for i in ids:
 codes={r['cardId'][:6].replace('-','') for r in ledger['relations'] if r['placeId']==i};rows=[r for r in records if r['feature']['properties']['P05_001'] in codes]
 def score(x):
  p=x['feature']['properties'];return difflib.SequenceMatcher(None,places[i]['address'],p['P05_004']).ratio()+difflib.SequenceMatcher(None,places[i]['name'],p['P05_003']).ratio()
 out.append({'facilityId':i,'candidates':sorted(rows,key=score,reverse=True)[:3]})
(D/'p05-candidate-search.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
