import json,pathlib,concurrent.futures,sys
sys.path.insert(0,str(pathlib.Path(__file__).parent));from fetch import fetch,D
old=json.load(open('data/evidence/national/locations-north-tohoku/cache-manifest.json'))+json.load(open('data/evidence/national/locations-north-tohoku/manifest.json'));ok={r['url'] for r in old if r.get('status')==200};add=json.load(open('data/evidence/national/locations-north-tohoku/additional.json'));targets=json.load(open(D/'fetch-targets.json'));done={r['sourceUrl'] for r in json.load(open(D/'fetch-records.json'))};support={i:[u for u in add.get(i,[]) if u in ok and u not in done and not any(s in u for s in ['google','goo.gl','maps.app'])][:3] for i in targets}
(D/'support-targets.json').write_text(json.dumps(support,ensure_ascii=False,indent=2));urls=list(dict.fromkeys(u for us in support.values() for u in us))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:r=list(ex.map(fetch,urls))
(D/'support-records.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(len(r),sum('snapshotPath' in x for x in r))
