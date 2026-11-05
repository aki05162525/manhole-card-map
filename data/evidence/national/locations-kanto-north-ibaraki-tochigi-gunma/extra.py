from research import *
import sys
q=json.load(open(ROOT/(sys.argv[1] if len(sys.argv)>1 else 'extra-queue.json')))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for m in ex.map(fetch,list(dict.fromkeys(u for v in q.values() for u in v))):print(m['url'],m.get('status',m.get('error')),flush=True)
