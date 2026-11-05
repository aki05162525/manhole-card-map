import research as r,sys,urllib.parse,json,concurrent.futures
urls=[u.strip() for u in open(sys.argv[1]) if u.strip() and u.strip() not in r.done]
for u in urls:r.locks.setdefault(urllib.parse.urlsplit(u).netloc,r.threading.Lock())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for m in ex.map(r.fetch,urls):
  r.manifest.append(m);(r.ROOT/'manifest.json').write_text(json.dumps(r.manifest,ensure_ascii=False,indent=2));print(m['url'],m.get('status',m.get('error')),flush=True)
