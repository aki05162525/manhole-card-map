import json,re,hashlib,html
from pathlib import Path
from bs4 import BeautifulSoup
S=Path('data/evidence/national/locations-north-hokkaido');R=Path('data/evidence/national/review-north-hokkaido')
ds=sorted(json.load(open(S/'decisions.json')),key=lambda d:d['facilityId']);ts={t['id']:t for t in json.load(open(S/'targets.json'))};ms={m['url']:m for m in json.load(open(S/'manifest.json'))};ps={p['facilityId']:p for p in json.load(open(S/'provenance.json'))}
def txt(p):return BeautifulSoup(Path(p).read_bytes(),'html.parser').get_text(' ',strip=True)
out=[]
for i,d in enumerate(ds):
 t=ts[d['facilityId']];pages=[ms[d['sourceUrl']]]+ps[d['facilityId']]['officialLinkSources']+[t['evidence']];findings=[]
 for e in pages:
  if '.csv' in e.get('url',e.get('sourceUrl','')):continue
  raw=Path(e['snapshotPath']).read_text(errors='replace');s=txt(e['snapshotPath']);terms=[d['name'].split(' ')[0],re.sub('北海道','',d['address']), '配布場所','南大通','338','施設概要','所在地','住所','案内所','観光物産','本庁舎']
  spans=[]
  for term in terms:
   for match in list(re.finditer(re.escape(term),s))[:3]:
    spans.append(s[max(0,match.start()-70):match.end()+180])
  findings.append({'url':e.get('url',e.get('sourceUrl')),'path':e['snapshotPath'],'sha256':hashlib.sha256(Path(e['snapshotPath']).read_bytes()).hexdigest(),'excerpts':list(dict.fromkeys(spans))[:12]})
 out.append({'index':i,**d,'pages':findings})
(R/'inspection.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
import sys
lo=int(sys.argv[1]) if len(sys.argv)>1 else 0;hi=int(sys.argv[2]) if len(sys.argv)>2 else 24
for x in out[lo:hi]:
 if '.csv' in x['sourceUrl']:continue
 print('\n',x['index'],x['name'],x['address'])
 for p in x['pages']:print(p['url'], '\n'+'\n'.join(p['excerpts'][:6]))
