"""Offline checks and render reproduction; never fetch or overwrite investigation sources."""
import argparse,hashlib,json,math,re,sys
from pathlib import Path
from shapely.geometry import shape,Point
sys.path.insert(0,'tools/national')
from research_common import decode_tile,combine_tiles,render_svg,rounded_coordinate
from location_lifecycle import digest
from assemble import evidence,coordinate
D=Path(__file__).resolve().parent;ROOT=Path.cwd().resolve()
p=argparse.ArgumentParser();p.add_argument('--output',default='data/work/kanto-prefecture/chiba/next-batch/visitor-five/reproduced');args=p.parse_args();OUT=Path(args.output).resolve();assert OUT.is_relative_to(ROOT/'data/work'), 'output must stay in ignored data/work';OUT.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def focus(c,box,font_size=24):
 x,y,size,_=box;svg=render_svg(c);svg=re.sub(r'viewBox="[^"]+"',f'viewBox="{x} {y} {size} {size}"',svg);svg=svg.replace('</title>',f'</title><rect x="{x}" y="{y}" width="{size}" height="{size}" fill="white"/>',1);labels=[]
 for f in c['features']:
  if f['sourceLayer']!='BldA':continue
  g=shape(f['geometry']);q=g.representative_point()
  if x<q.x<x+size and y<q.y<y+size and g.area>3000:labels.append(f'<text x="{q.x}" y="{q.y}" font-size="{font_size}" fill="red">{f["layerFeatureIndex"]}</text>')
 return svg.replace('</svg>',''.join(labels)+'</svg>')
index=read(D/'index.json');assert len(set(index['facilityIds']))==5
scope=read(ROOT/'data/national/kanto-prefecture/chiba/scope.json')
# Saved baseline and parent scope compare recursively regardless scope collection name.
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
objects=list(walk(scope));baseline={b['facilityId']:b for b in read(D/'baseline.json')}
for b in baseline.values():
 assert any(x==b['place'] for x in objects),'baseline place differs from saved scope'
 for rel in b['relations']:assert any(x==rel for x in objects)
 for e in [b['place']['evidence']]+[r['evidence'] for r in b['relations']]:assert sha(ROOT/e['snapshotPath'])==e['snapshotSHA256']
for r in read(D/'rights.json')['reusedSources']:assert sha(ROOT/r['path'])==r['sha256']
count=0
for td in sorted(D.glob('*/tile-inputs.json')):
 info=read(td);group=td.parent.name;tiles=[]
 for item in info['inputs']:
  rawp=td.parent/Path(item['path']).name;assert sha(rawp)==item['sha256'];decoded=decode_tile(rawp.read_bytes());features=[];tile=item['tile'];count+=1
  for layer in ['BldA','RdCL']:
   for i,f in enumerate(decoded.get(layer,{}).get('features',[])):features.append({**f,'id':f'{tile["x"]}-{tile["y"]}-{layer}-{i}','sourceLayer':layer,'layerFeatureIndex':i})
  tiles.append({'tile':tile,'extent':4096,'features':features})
 c=combine_tiles(tiles);assert c==read(td.parent/'combined.json');od=OUT/group;od.mkdir(exist_ok=True)
 svg=render_svg(c);assert svg==(td.parent/'all.svg').read_text();(od/'all.svg').write_text(svg)
 # JSON integers reserialize as 2500; original script generated integer size as well.
 box=info['focusBox'];s=focus(c,box);assert s==(td.parent/'focus.svg').read_text();(od/'focus.svg').write_text(s)
 if group=='togane':
  east=focus(c,[7500.0,7100.0,2500.0,2500.0],20);assert east==(td.parent/'east-focus.svg').read_text();(od/'east-focus.svg').write_text(east)
 if (td.parent/'calculation.json').exists():
  calc=read(td.parent/'calculation.json');f=next(x for x in c['features'] if x['id']==calc['feature']['id']);assert f==calc['feature'];r=rounded_coordinate(f['geometry'],c['baseTile'],calc['pointXY']);assert r==calc['result'];g=shape(f['geometry']);assert g.is_valid and g.contains(Point(r['roundedTileXY']))
  coordinate(r['coordinate']);assert not r['identityApproved'] and not r['crsApproved']
  (od/'rounded-check.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
  print(group,f['id'],r['coordinate'],'strict interior',calc['areaM2Approx'],'m2 approx')
 print(group,'tiles',len(tiles),'features',len(c['features']),'all/focus SVG reproduced')
updates=read(D/'locations-proposed.json')['updates'];bindings=read(D/'lifecycle-proposed.json')['bindings'];sels=read(D/'selection-proposed.json');assert len(updates)==len(bindings)==len(sels['candidateOnly'])==4;assert not sels['locations']['approved'] and not sels['locationLifecycle']
for u,b,s in zip(updates,bindings,sels['candidateOnly']):
 fid=u['facilityId'];old=baseline[fid];assert b['facilityId']==s['facilityId']==fid;assert b['adoption']==u;assert b['adoptionSHA256']==s['sha256']==digest(u);assert s['bindingSHA256']==digest(b);assert s['expectedOldPlaceSHA256']==digest(old['place']);assert s['expectedOldRelationsSHA256']==digest(old['relations']);assert s['expectedOldCoordinate']==old['place'].get('coordinate') is None
 assert b['identity']=={k:old['place'][k] for k in ('name','address')};evidence(ROOT,u['evidence']);print('binding/old-value/evidence hash OK',fid)
print('PASS:',count,'tile hashes, 4 rounded strict-interior candidates; 5 baseline identities; no suite/approval claim')
