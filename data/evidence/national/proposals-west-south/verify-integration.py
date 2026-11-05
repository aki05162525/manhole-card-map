"""Build a disposable combined ledger; reject stale patch preconditions.
Run from the repository root. Does not change any original fragment.
"""
import copy,json,pathlib
out=json.load(open('data/work/national-input/places.json'))
patches=json.load(open('data/national/patches/west-south.json'))['patches']
for region in ['chugoku-shikoku','kyushu-okinawa']:
    target='data/overrides/regions/'+region+'.json'
    ledger=json.load(open(target))
    for patch in patches:
        if patch['target']!=target: continue
        matches=[i for i,r in enumerate(ledger[patch['collection']]) if all(r.get(k)==v for k,v in patch['key'].items())]
        assert len(matches)==1,patch['key']
        i=matches[0]
        assert ledger[patch['collection']][i]==patch['old'],('stale patch',patch['key'])
        ledger[patch['collection']][i]=copy.deepcopy(patch['new'])
    for key in ['places','relations']: out[key].extend(ledger[key])
proposal=json.load(open('data/overrides/proposals/west-south.json'))
for key in ['places','relations']: out[key].extend(proposal[key])
pathlib.Path('/tmp/west-south-merged.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('/tmp/west-south-merged.json')
