"""Rebuild the official-page -> embedded-map/link evidence chain without fetching."""
import json,pathlib,urllib.parse,html
R=pathlib.Path(__file__).parent
man=json.load(open(R/'manifest.json'));dec=json.load(open(R/'decisions.json'))
result=[]
for d in dec:
 u=d['sourceUrl'];sources=[]
 if 'google.' in u or 'goo.gl' in u:
  for e in man:
   if not e.get('snapshotPath') or 'google.' in e['url'] or 'goo.gl' in e['url']:continue
   raw=pathlib.Path(e['snapshotPath']).read_bytes().decode('utf-8','replace')
   if u in html.unescape(raw):sources.append({k:e[k] for k in ['url','snapshotPath','snapshotSHA256','fetchedAt']})
  assert sources,d['facilityId']
 result.append({'facilityId':d['facilityId'],'coordinateSourceUrl':u,'officialLinkSources':sources})
(R/'provenance.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print('official provenance chains checked',sum(bool(x['officialLinkSources']) for x in result))
