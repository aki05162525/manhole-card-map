import sys,json,hashlib,math
from pathlib import Path
from pmtiles.reader import Reader
import cairosvg
sys.path.insert(0,'tools/national')
from research_common import fetch_cached,decode_tile,adjacent_tiles,combine_tiles,render_svg
def acquisition_output(value):
 p=Path(value).resolve()
 allowed=(Path.cwd()/'data/work').resolve()
 if not p.is_relative_to(allowed):raise ValueError('new acquisition output must be beneath ignored data/work')
 import subprocess
 if subprocess.run(['git','check-ignore','-q',str(p)],check=False).returncode:raise ValueError('output must be git-ignored')
 p.mkdir(parents=True,exist_ok=True)
 return p

if len(sys.argv)!=2:raise SystemExit('usage: tiles.py IGNORED_OUTPUT')
W=acquisition_output(sys.argv[1]);T=W/'tiles';T.mkdir(exist_ok=True);assert not (W/'tile-inputs.json').exists()
url='https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles';records=[];cache={};generation=None

def get_bytes(offset,length):
 global generation
 if (offset,length) in cache:return cache[offset,length]
 raw,r=fetch_cached(url,W/'range-cache','yachiyo-four-2026-11-06',headers={'Range':f'bytes={offset}-{offset+length-1}'})
 records.append(r);(W/'range-retrievals.json').write_text(json.dumps(records,indent=2)+'\n')
 if raw is None:raise ValueError(r['error'])
 current=(r['etag'],r['lastModified']);assert all(current)
 if generation is None:generation=current
 assert generation==current
 cache[offset,length]=raw;return raw
reader=Reader(get_bytes);rows=[];tiles=[]
for tile in adjacent_tiles({'z':16,'x':58272,'y':25797}):
 raw=reader.get(tile['z'],tile['x'],tile['y']);assert raw
 p=T/f"{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz";assert not p.exists();p.write_bytes(raw)
 rows.append({'tile':tile,'path':str(p.relative_to(Path.cwd())),'sha256':hashlib.sha256(raw).hexdigest()});d=decode_tile(raw);fs=[]
 for name in ['BldA','RdCL']:
  for i,f in enumerate(d.get(name,{}).get('features',[])):fs.append({**f,'id':f"{tile['x']}-{tile['y']}-{name}-{i}",'sourceLayer':name,'layerFeatureIndex':i})
 tiles.append({'tile':tile,'extent':4096,'features':fs})
c=combine_tiles(tiles);(W/'combined.json').write_text(json.dumps(c));svg=render_svg(c);(W/'all.svg').write_text(svg)
(W/'tile-inputs.json').write_text(json.dumps({'sourceURL':url,'generation':generation,'rows':rows,'seed':'historical yachiyo tile 58272/25797; search window only','processing':'mapbox-vector-tile 2.2.0 y_coord_down=True; all BldA/RdCL, extent4096; combine_tiles/render_svg; no area filtering','credit':'国土地理院最適化ベクトルタイルを加工、PDL1.0、採用未承認'},ensure_ascii=False,indent=2)+'\n')
print(c['baseTile'],len(c['features']))
