import sys
sys.dont_write_bytecode = True
from research import *
import sys
urls=sys.argv[1:]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:r=list(ex.map(fetch,urls))
p=OUT/'additional-fetches.json';old=json.loads(p.read_text()) if p.exists() else [];save(p,old+r)
for e in r:
 print(e['sourceUrl'],e.get('status',e.get('error')),e.get('snapshotPath'))
 if 'snapshotPath' in e:
  import re
  t=(ROOT/e['snapshotPath']).read_text(errors='replace')
  for m in re.finditer(r'.{0,100}(?:latitude|longitude|LatLng|data-lat|initlat|!3d|lat:|lat\s*=|lat&quot;).{0,180}',t,re.I):print(m.group(0))
