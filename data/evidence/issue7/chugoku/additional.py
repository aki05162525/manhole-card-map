import runpy,json,sys,concurrent.futures
m=runpy.run_path('data/evidence/issue7/chugoku/research.py');D=m['D'];fetch=m['fetch'];dump=m['dump']
items=json.load(open(sys.argv[1])); existing=json.load(open(D/'fetches.json')); known={x['url'] for x in existing}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: out=list(ex.map(fetch,[(u,ids) for u,ids in items.items() if u not in known]))
dump(D/'fetches.json',existing+out)
for x in out:print(x)
