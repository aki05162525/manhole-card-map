from research import *
def walk(x):
 if isinstance(x,list):
  if len(x)>=3 and isinstance(x[0],str) and x[0].startswith('0x') and isinstance(x[1],str) and isinstance(x[2],list) and len(x[2])==2:yield x[:3]
  for y in x:yield from walk(y)
for l in json.load(open(ROOT/'embedded-links.json')):
 m=cache.get(l['url']);
 if not m or m.get('status')!=200:continue
 t=pathlib.Path(m['snapshotPath']).read_text();z=re.search(r'initEmbed\((\[.*?\])\);',t,re.S)
 if z:
  try:ds=list(walk(json.loads(z[1])))
  except:continue
  for d in ds:print(l['source'],'=>',d[1],d[2])
