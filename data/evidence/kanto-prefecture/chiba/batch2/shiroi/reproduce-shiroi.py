"""Research derivation, never adoption. Run from repository root; output dir must be new."""
import json, math, sys, re
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.ops import unary_union
sys.path.insert(0, 'tools/national')
from research_common import read_verified, decode_tile, combine_tiles, rounded_coordinate, render_svg
W=Path(__file__).resolve().parent
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=False)
inputs=json.loads((W/'shiroi-tile-reuse.json').read_text());tiles=[]
for r in inputs:
    decoded=decode_tile(read_verified(r['snapshotPath'],r['sha256']));fs=[]
    for layer in ['BldA','RdCL']:
        for i,f in enumerate(decoded.get(layer,{}).get('features',[])):
            fs.append({**f,'id':f'{r["tile"]["x"]}-{r["tile"]["y"]}-{layer}-{i}','sourceLayer':layer,'layerFeatureIndex':i})
    tiles.append({'tile':r['tile'],'extent':4096,'features':fs})
c=combine_tiles(tiles);features={f['id']:f for f in c['features']}
main=features['58264-25781-BldA-112']['geometry']
fragment=features['58264-25782-BldA-20']['geometry']
rows=[]
for suffix,point in [('5724e90e3e451f22eeef',[1550,3970]),('caac2827c5303ba03047',[2110,3760])]:
    result=rounded_coordinate(main,c['baseTile'],point)
    assert result['mechanicalChecksPassed']
    independent=shape(main).contains(Point(result['roundedTileXY']));assert independent
    rows.append({'facilityId':'facility:kanto-south-'+suffix,'pointXY':point,'result':result,'distanceFromPolygonBoundaryMetersApprox':shape(main).boundary.distance(Point(point))*.121,'independentShapelyRoundedWithin':independent})
scale=40075016.68557849*math.cos(math.radians(35.7914))/(2**16*4096)
result={'rows':rows,'unionBuildingAreaM2Approx':unary_union([shape(main),shape(fragment)]).area*scale**2,'scaleMetersPerTileUnit':scale,'areaFormula':'Web Mercator local ground approximation at 35.7914 degrees; union excludes walkway41','sourceFeatures':['58264-25781-BldA-112','58264-25782-BldA-20'],'note':'112/20タイル片のunionは外形面積比較用。庁舎別分割を確定したものではない。PDL1.0/GSI加工、採用未承認。'}
(out/'calculation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(out/'all.svg').write_text(render_svg(c))
print(json.dumps(result,ensure_ascii=False))

svg=render_svg(c)
svg=re.sub(r'viewBox="[^"]+"','viewBox="900.0 3400.0 1900.0 1500.0"',svg)
svg=svg.replace('</title>','</title><rect x="900.0" y="3400.0" width="1900.0" height="1500.0" fill="white"/>',1)
labels=[]
for f in c['features']:
    if f['sourceLayer']!='BldA':continue
    g=shape(f['geometry']);point=g.representative_point()
    if 900<point.x<2800 and 3400<point.y<4900 and g.area>6000:
        labels.append(f'<text x="{point.x}" y="{point.y}" fill="red" font-size="22">{f["layerFeatureIndex"]}</text>')
svg=svg.replace('</svg>',''.join(labels)+'</svg>')
(out/'focus.svg').write_text(svg)
