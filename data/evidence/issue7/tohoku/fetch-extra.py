import json,pathlib,concurrent.futures
from fetch import fetch,D
previous=json.load(open(D/'extra-records.json')) if (D/'extra-records.json').exists() else [];done={r['sourceUrl'] for r in previous};urls=list(dict.fromkeys(u for us in json.load(open(D/'extra-targets.json')).values() for u in us if u not in done))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:r=list(ex.map(fetch,urls))
(D/'extra-records.json').write_text(json.dumps(previous+r,ensure_ascii=False,indent=2));print(len(r),sum('snapshotPath'in x for x in r))
