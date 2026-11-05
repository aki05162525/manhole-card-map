import json,sys,math,time
from pathlib import Path
sys.path.insert(0,'tools/national');from research_common import fetch_cached,adjacent_tiles,decode_tile,combine_tiles,render_svg
from pmtiles.reader import Reader
D=Path('data/work/kanto-prefecture/saitama/groups/tourism');E=Path('data/evidence/kanto-prefecture/saitama/groups/tourism');records=[];t=time.time();name=sys.argv[1]
url='https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles'
def getbytes(o,n):
 b,r=fetch_cached(url,D/'cache','optbv-saitama-2026-11-05',headers={'Range':f'bytes={o}-{o+n-1}'})
 records.append(r);(E/(name+'-vector-retrievals.json')).write_text(json.dumps(records,indent=2)+'\n')
 if b is None:raise ValueError(r)
 if len({(a.get('etag'),a.get('lastModified')) for a in records})!=1:raise ValueError('mixed version')
 return b
reader=Reader(getbytes);lat,lon=map(float,sys.argv[2:4]);z=16
center=dict(z=z,x=int((lon+180)/360*2**z),y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z));tiles=[]
for tile in adjacent_tiles(center):
 b=reader.get(tile['z'],tile['x'],tile['y']);rawpath=E/f"{name}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz";rawpath.write_bytes(b);d=decode_tile(b);features=[]
 for layer in ['BldA','RdCL','RdEdg','WA','WL']:
  for i,f in enumerate(d.get(layer,{}).get('features',[])):features.append({**f,'layer':layer,'layerFeatureIndex':i})
 tiles.append({'tile':tile,'extent':4096,'features':features})
c=combine_tiles(tiles);(D/(name+'-combined.json')).write_text(json.dumps(c));(D/(name+'.svg')).write_text(render_svg(c));(E/(name+'-vector-window.json')).write_text(json.dumps({'centerUsedForAcquisitionOnly':center,'tiles':c['tiles'],'elapsedSeconds':time.time()-t,'startedEpoch':t,'endedEpoch':time.time(),'featureCount':len(c['features'])},indent=2)+'\n');print('features',len(c['features']))
import cairosvg
cairosvg.svg2png(url=str(D/(name+'.svg')),write_to=str(E/(name+'-all.png')),output_width=1400,output_height=1400,background_color="white")
