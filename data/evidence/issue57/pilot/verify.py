"""Offline pilot integrity and arithmetic; not an independent building review."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools/national'))
from research_common import read_verified,decode_tile,combine_tiles,render_svg,validate_observation,rounded_coordinate
E=Path(__file__).resolve().parent


def validate_summary(selection,outcomes):
    selected=[r['facilityId'] for r in selection['rows'] if r['selected']]
    ids=[r['facilityId'] for r in outcomes['rows']]
    if (len(selected)!=len(set(selected)) or len(ids)!=len(set(ids)) or set(ids)!=set(selected)
            or len(selected)!=selection['selected'] or len(selection['rows'])!=selection['population']):
        raise ValueError('pilot selection/outcome coverage mismatch')
    if outcomes['adopted']!=0 or any(r['decision']!='held' or r['adoptedCoordinate'] is not None for r in outcomes['rows']):
        raise ValueError('research-only pilot cannot silently adopt')


def check_generation(records):
    generations={(r.get('etag'),r.get('lastModified')) for r in records}
    if len(generations)!=1 or any(not v for pair in generations for v in pair):
        raise ValueError('PMTiles generation mismatch or missing provenance')


def main():
    from shapely.geometry import shape,Point
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw',action='store_true')
    args=parser.parse_args()
    def read(path):return json.loads((ROOT/path).read_text())
    selection=read('data/national/issue57/pilot-selection.json')
    outcomes=read('data/national/issue57/pilot-outcomes.json')
    validate_summary(selection,outcomes)
    read_verified(ROOT/'data/national/issue57/pilot-selection.json',outcomes['selectionSHA256'])
    original=json.loads(read_verified(ROOT/selection['indexPath'],selection['indexSHA256']))
    assert {r['facilityId'] for r in original['facilities']}=={r['facilityId'] for r in selection['rows']}
    for r in outcomes['rows']:validate_observation(r['observation'])
    tile_inputs=read('data/evidence/issue57/pilot/tile-inputs.json')
    ranges=read('data/evidence/issue57/pilot/range-retrievals.json')['records']
    check_generation(ranges)
    assert {r['etag'] for r in ranges}=={tile_inputs['generation']['etag']}
    assert {r['lastModified'] for r in ranges}=={tile_inputs['generation']['lastModified']}
    for r in ranges:
        a,b=map(int,r['requestHeaders']['range'].split('=')[1].split('-'))
        assert r['bytes']==b-a+1 and r['httpStatus']==206
        assert r['contentRange'].startswith(f'bytes {a}-{b}/')
        if args.raw:read_verified(ROOT/r['rawPath'],r['sha256'])
    combined={}
    for group in ['shiroi','atami','nakatsugawa']:
        tiles=[]
        for r in tile_inputs['rows']:
            if r['group']!=group:continue
            decoded=decode_tile(read_verified(ROOT/r['path'],r['sha256']))
            features=[];extent=None
            for layer in ('BldA','RdCL'):
                obj=decoded.get(layer)
                if obj is None:continue
                extent=obj['extent']
                for i,f in enumerate(obj['features']):features.append({**f,'id':f"{r['tile']['x']}-{r['tile']['y']}-{layer}-{i}",'sourceLayer':layer,'layerFeatureIndex':i})
            tiles.append({'tile':r['tile'],'extent':extent,'features':features})
        combined[group]=combine_tiles(tiles)
        output=render_svg(combined[group]).encode()
        record=next(r for r in tile_inputs['renders'] if r['group']==group)
        assert output==read_verified(ROOT/record['path'],record['sha256'])
    calculations=read('data/evidence/issue57/pilot/calculations.json')
    for r in calculations['rows']:
        data=combined[r['group']];f=data['features'][r['combinedFeatureIndex']]
        assert f['id']==r['sourceFeatureId'] and f['layerFeatureIndex']==r['layerFeatureIndex']
        assert hashlib.sha256(json.dumps(f['geometry'],sort_keys=True).encode()).hexdigest()==r['geometrySHA256']
        calculated=rounded_coordinate(f['geometry'],data['baseTile'],r['pointInCombinedTileXY'],data['extent'])
        assert all(r[k]==v for k,v in calculated.items())
        g=shape(f['geometry']);assert g.is_valid
        assert g.contains(Point(r['pointInCombinedTileXY'])) and g.contains(Point(r['roundedTileXY']))
        assert r['identityApproved'] is False and r['crsApproved'] is False
    for r in read('data/evidence/issue57/pilot/rights.json')['reusedSources']:read_verified(ROOT/r['path'],r['sha256'])
    if args.raw:
        for r in read('data/evidence/issue57/pilot/retrievals.json')['records']:
            if r['status'] in ('acquired','cached'):read_verified(ROOT/r['rawPath'],r['sha256'])
    print(json.dumps({'selected':len(outcomes['rows']),'adopted':0,'tileFiles':len(tile_inputs['rows']),'svgReproduced':len(combined),'hypothesisArithmetic':len(calculations['rows']),'rawChecked':args.raw,'buildingIdentityApproval':False}))


if __name__=='__main__':main()
