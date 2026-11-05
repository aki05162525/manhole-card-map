"""Run from repository root. Never mutate shared inputs or regional fragments."""
import json, pathlib, subprocess, tempfile, hashlib, collections
root=pathlib.Path('data/evidence/national/proposals-chubu')
load=lambda p:json.loads(pathlib.Path(p).read_text())
ledger=load('data/overrides/proposals/chubu.json');patch=load('data/national/patches/chubu.json')
work=pathlib.Path(tempfile.mkdtemp(prefix='chubu-proposals-'))
fragments=work/'fragments';fragments.mkdir()
for region in ['chubu-east','chubu-west']:
    path='data/overrides/regions/'+region+'.json';data=load(path)
    for op in patch['operations']:
        if op['op']!='replace-relation' or op['file']!=path:continue
        indexes=[i for i,r in enumerate(data['relations']) if all(r[k]==v for k,v in op['match'].items())]
        assert len(indexes)==1
        i=indexes[0];assert data['relations'][i]==op['old'],op['match'];data['relations'][i]=op['new']
    (fragments/(region+'.json')).write_text(json.dumps(data,ensure_ascii=False))
(fragments/'proposals.json').write_text(json.dumps(ledger,ensure_ascii=False))
results=[]
for day in ['2026-11-05','2026-11-01','2027-07-01']:
    dest=work/day
    command=['mise','exec','--','go','run','./cmd/builddata','-places','data/work/national-input/places.json','-place-fragments',str(fragments/'*.json'),'-review-list','/tmp/gkp-current-design.html','-as-of',day,'-out',str(dest)]
    p=subprocess.run(command,capture_output=True,text=True);assert p.returncode==0,p.stderr
    data=load(dest/'full.json');relations={(r['cardId'],r['placeId']):r for r in data['relations']}
    checks={}
    def check(c,p,s):
        actual=relations[(c,p)]['status'];assert actual==s,(day,c,p,actual,s);checks[c+' / '+p]=actual
    check('15-202-C001','facility:chubu-east-a2a5f539ca9876bcbc10','upcoming' if day=='2026-11-01' else 'active')
    check('15-208-D001','facility:chubu-east-2a3c4c27a70d89172634','ended')
    check('20-217-D001','facility:chubu-saku-terakoya','unknown')
    check('20-217-D001','facility:chubu-east-6759197c3df3f90f5bd7','unknown')
    check('22-215-A001','facility:chubu-west-6174b986d89b31577298','unknown' if day=='2027-07-01' else 'suspended')
    check('16-209-B001','facility:chubu-oyabe-water-counter','unknown' if day=='2027-07-01' else 'active')
    if day=='2026-11-05':
        check('15-213-B001','facility:chubu-east-97553bd65da2ea0b1ed8','active')
        check('15-202-C001','facility:chubu-east-b7d939284218814b6bba','ended')
        for r in ledger['relations']:
            actual=relations[(r['cardId'],r['placeId'])];assert actual['review']=='verified',actual
    results.append({'asOf':day,'command':command,'stderr':p.stderr.strip(),'checks':checks,'cards':len(data['cards']),'relations':len(data['relations'])})
evidence={}
for obj in ledger['places']+ledger['relations']+[o['new'] for o in patch['operations'] if o['op']=='replace-relation']:
    e=obj['evidence'];digest=hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest();assert digest==e['snapshotSHA256'];evidence[e['snapshotPath']]=digest
summary={'checkedAt':'2026-11-05','ledgerPlaces':len(ledger['places']),'ledgerRelations':len(ledger['relations']),'addedRelations':sum('change' in r for r in ledger['relations']),'patchOperations':len(patch['operations']),'headingExclusionsApplied':False,'headingExclusionsReason':'現在のPlaceLedgerには関係除外機能なし。親で生成側の実装が必要。','builds':results,'evidenceSHA256':evidence}
(root/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['ledgerPlaces','ledgerRelations','addedRelations','patchOperations']},ensure_ascii=False));print(work)
