from bs4 import BeautifulSoup
from pathlib import Path
import json
out=Path('data/evidence/national/review-chugoku-saitama-locations');rows=[]
for region,fn in [('chugoku-shikoku','locations-chugoku-shikoku/facility-audit.json'),('kanto-north-saitama','locations-kanto-north-saitama/decisions.json')]:
 a={r['facilityId']:r for r in json.load(open('data/evidence/national/'+fn))}; m=json.load(open('data/evidence/national/locations-kanto-north-saitama/manifest.json')); byurl={r['url']:r for r in m}
 for i,u in enumerate(json.load(open('data/national/location-updates/'+region+'.json'))['updates']):
  r=a[u['facilityId']];src=r.get('sources',[])
  if region.startswith('kanto'):
   src=[byurl[url] for url in r.get('supportingSourceUrls',[]) if url in byurl]
   f=json.load(open('data/work/national-assembled-tokyo-kinki-locations.json'));fac=next(v for v in f['places'] if v['id']==u['facilityId']);e=fac.get('evidence',{});
   if e.get('snapshotPath'):src.append({'url':e['sourceUrl'],'snapshotPath':e['snapshotPath']})
  sources=[]
  for s in src:
   p=Path(s.get('snapshotPath') or '')
   if not p.is_file() or p.suffix!='.html':continue
   soup=BeautifulSoup(p.read_bytes(),'html.parser')
   for x in soup(['script','style','nav','header','footer']):x.decompose()
   t=' '.join((soup.select_one('main') or soup.select_one('#main') or soup).stripped_strings)
   sources.append({'url':s['url'],'path':str(p.relative_to(Path.cwd()) if p.is_absolute() else p),'text':t})
  rows.append({'region':region,'index':i,'facilityId':u['facilityId'],'name':r['name'],'sources':sources})
(out/'support-extracted.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
