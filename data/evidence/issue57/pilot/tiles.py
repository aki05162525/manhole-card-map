"""Bounded GSI acquisition and full building/road rendering; no adoption."""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import time
from pmtiles.reader import Reader
import cairosvg

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools/national'))
from research_common import fetch_cached,read_verified,adjacent_tiles,decode_tile,combine_tiles,render_svg
E=Path(__file__).resolve().parent
W=ROOT/'data/work/issue57/pilot'
if (E/'tile-inputs.json').exists():
 raise SystemExit('Recorded pilot exists; verify offline or use a new evidence directory.')
URL='https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles'
records=[]
cache={}
generation=None

def get_bytes(offset,length):
 global generation
 if (offset,length) in cache:return cache[offset,length]
 start=time.monotonic()
 raw,r=fetch_cached(URL,W/'range-cache','issue57-pilot-2026-11-05',headers={'Range':f'bytes={offset}-{offset+length-1}'})
 r['elapsedSeconds']=round(time.monotonic()-start,6)
 for field in ('rawPath','responseRawPath'):
  if r.get(field):r[field]=str(Path(r[field]).relative_to(ROOT))
 records.append(r)
 (E/'range-retrievals.json').write_text(json.dumps({'schema':1,'records':records},ensure_ascii=False,indent=2)+'\n')
 if raw is None:raise ValueError(r['error'])
 current=(r['etag'],r['lastModified'])
 if not all(current):raise ValueError('source generation headers missing')
 if generation is None:generation=current
 if generation!=current:raise ValueError('PMTiles generation changed between ranges')
 cache[offset,length]=raw
 return raw

reader=Reader(get_bytes)
rows=[]
old=json.loads((ROOT/'data/evidence/location-batch2/south-kanto/vector-inspection.json').read_text())
for r in old['tiles']:
 if r['key'].startswith('shiroi'):
  read_verified(ROOT/r['snapshotPath'],r['sha256'])
  rows.append({'group':'shiroi','tile':r['tile'],'path':r['snapshotPath'],'sha256':r['sha256'],'provenanceRef':'data/evidence/location-batch2/south-kanto/vector-inspection.json','acquisition':'historical-reuse'})
# A deliberately coarse exploration seed, not a claimed building point.
lat,lng=35.495,137.502
seed={'z':16,'x':math.floor((lng+180)/360*2**16),'y':math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**16)}
for group,center in [('atami',{'z':16,'x':58085,'y':25937}),('nakatsugawa',seed)]:
 start=time.monotonic()
 for tile in adjacent_tiles(center):
  raw=reader.get(tile['z'],tile['x'],tile['y'])
  if raw is None:raise ValueError(f'missing tile {group} {tile}')
  path=E/f"{group}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz"
  if path.exists() and path.read_bytes()!=raw:raise ValueError('immutable tile changed')
  path.write_bytes(raw)
  rows.append({'group':group,'tile':tile,'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'provenanceRef':'data/evidence/issue57/pilot/range-retrievals.json','acquisition':'new-range-extraction'})
 print(group,'acquisition seconds',time.monotonic()-start,flush=True)
report={'schema':1,'sourceURL':URL,'generation':{'etag':generation[0],'lastModified':generation[1]},'processing':'mapbox-vector-tile==2.2.0 y_coord_down=True; every BldA and RdCL geometry, no centroid or area filtering; research_common combine_tiles/render_svg','seeds':{'atami':{'tile':{'z':16,'x':58085,'y':25937},'source':'historical tokai/vector-inputs.json','purpose':'search window only'},'nakatsugawa':{'lat':lat,'lng':lng,'source':'investigator coarse city-centre exploration window','purpose':'search window only; never evidence of building identity or adoption'}},'rows':rows,'renders':[]}
for group in ['shiroi','atami','nakatsugawa']:
 start=time.monotonic();tiles=[];layer_counts={}
 for r in rows:
  if r['group']!=group:continue
  decoded=decode_tile(read_verified(ROOT/r['path'],r['sha256']))
  features=[];extent=None
  for layer in ('BldA','RdCL'):
   obj=decoded.get(layer)
   if obj is None:continue
   extent=obj['extent']
   layer_counts[layer]=layer_counts.get(layer,0)+len(obj['features'])
   for i,f in enumerate(obj['features']):features.append({**f,'id':f"{r['tile']['x']}-{r['tile']['y']}-{layer}-{i}",'sourceLayer':layer,'layerFeatureIndex':i})
  if extent is None:raise ValueError('no building or road layers')
  tiles.append({'tile':r['tile'],'extent':extent,'features':features})
 combined=combine_tiles(tiles)
 (W/f'{group}-combined.json').write_text(json.dumps(combined,ensure_ascii=False)+'\n')
 svg=render_svg(combined)
 (E/f'{group}-all.svg').write_text(svg)
 cairosvg.svg2png(bytestring=svg.encode(),write_to=str(W/f'{group}-all.png'),output_width=1800,output_height=1800)
 report['renders'].append({'group':group,'path':str((E/f'{group}-all.svg').relative_to(ROOT)),'sha256':hashlib.sha256(svg.encode()).hexdigest(),'layerCounts':layer_counts,'extent':combined['extent'],'tiles':combined['tiles'],'tileBoundaryTouched':sum(f['tileBoundaryTouched'] for f in combined['features']),'outerBoundaryTouched':sum(f['outerBoundaryTouched'] for f in combined['features']),'orientation':'north up, x right, y down','renderSeconds':round(time.monotonic()-start,6),'identityApproved':False})
 print(group,layer_counts,flush=True)
(E/'tile-inputs.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
