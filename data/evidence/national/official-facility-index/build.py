#!/usr/bin/env python3
"""Candidate-only national public facility join. Python standard library; no geocoder."""
import collections,csv,hashlib,io,json,re,unicodedata,zipfile,sys
from functools import lru_cache
from fetch import E,W,ROOT,fetch

@lru_cache(maxsize=None)
def norm(s):
    s=unicodedata.normalize('NFKC',s or '')
    s=re.sub(r'[\s\u3000]','',s)
    return s.translate(str.maketrans({'−':'-','‐':'-','ー':'ー','―':'-','–':'-'}))
@lru_cache(maxsize=None)
def address(s):
    s=norm(s);s=re.sub(r'^(北海道|東京都|大阪府|京都府|.{2,3}県)','',s)
    # Normalize notation only. Do NOT delete numeric lot components or silently match prefixes.
    s=re.split(r'[（(]',s)[0]
    s=re.sub(r'(\d+)(丁目|番地の|番地|番|号)',r'\1-',s)
    return s.rstrip('-')
def classify(p,row):
    n,m=norm(p['name']),norm(row['name']);a,b=address(p.get('address','')),address(row['address'])
    same=bool(a and a==b)
    contained=min(len(n),len(m))>=4 and (n in m or m in n)
    # Retrieval includes exact names at different addresses to expose moves; no fuzzy-only retrieval.
    city=re.match(r'^(.+?[市区町村])',b)
    if n==m and (same or (city and a.startswith(city[1]))):return (100 if same else 65),'exact',same
    if contained and same:return 90,'contains',same
    return None

def is_confirmed(p):
    c=p.get('coordinate',{})
    return c.get('status')=='confirmed' or (isinstance(c.get('lat'),(int,float)) and isinstance(c.get('lng'),(int,float)))

def inputs():
    manifest=[]; ps={};aliases={}; relations={}
    frozen=json.loads((E/'input-manifest.json').read_text()) if '--frozen' in sys.argv else None
    paths=([ROOT/m['path'] for m in frozen if '/national-input/' in m['path'] or '/overrides/regions/' in m['path']] if frozen else [ROOT/'data/work/national-input/full.json']+sorted((ROOT/'data/overrides/regions').glob('*.json')))
    for path in paths:
        rel=str(path.relative_to(ROOT))
        saved=W/'inputs'/path.name if 'national-input' in rel else W/'inputs/regions'/path.name
        b=(saved if '--frozen' in sys.argv else path).read_bytes();d=json.loads(b);manifest.append({'path':rel,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
        target=W/'inputs'/path.name if 'national-input' in rel else W/'inputs/regions'/path.name
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
        for p in d.get('places',[]):
            for old in p.get('legacyIds',[]):ps.pop(old,None);aliases[old]=p['id']
            ps[p['id']]=p
    report_paths=[ROOT/m['path'] for m in frozen if '/national/regions/' in m['path']] if frozen else sorted((ROOT/'data/national/regions').glob('*.json'))
    for path in report_paths:
        saved=W/'inputs/regions'/('report-'+path.name)
        b=(saved if '--frozen' in sys.argv else path).read_bytes();manifest.append({'path':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
        (W/'inputs/regions'/('report-'+path.name)).write_bytes(b)
        for card in json.loads(b).get('cards',[]):
            for r in card.get('relations',[]):
                key=r.get('facilityId') or aliases.get(r.get('legacyPlaceId'),r.get('legacyPlaceId'))
                if key:relations.setdefault(key,[]).append({'cardId':card['cardId'],**r})
    (E/'input-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return ps,relations

def dataset():
    z=zipfile.ZipFile(fetch('https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','P05-22_GML.zip',True));rows=[]
    for member in sorted(z.namelist()):
        sub=zipfile.ZipFile(io.BytesIO(z.read(member)))
        for name in sub.namelist():
            if not name.endswith('.geojson'):continue
            b=sub.read(name);d=json.loads(b);member_hash=hashlib.sha256(b).hexdigest()
            assert d['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
            for i,f in enumerate(d['features']):
                p=f['properties'];lng,lat=f['geometry']['coordinates'];assert 120<lng<155 and 20<lat<46
                rows.append({'dataset':'P05-22','name':p['P05_003'],'address':p['P05_004'],'class':p['P05_002'],'municipalityCode':p['P05_001'],'coordinate':{'lat':lat,'lng':lng,'crs':'EPSG:6668'},'locator':member+'!'+name+'#/features/'+str(i),'memberSHA256':member_hash,'rawFeature':f})
    b=fetch('https://www.city.hachioji.tokyo.jp/contents/open/002/p035934_d/fil/132012_public_facility.csv','hachioji.csv').read_bytes()
    for i,p in enumerate(csv.DictReader(io.StringIO(b.decode('utf-8-sig')))):
        if not p['緯度'] or not p['経度']:continue
        rows.append({'dataset':'hachioji-standard','name':p['名称'],'address':p['所在地_連結表記'],'class':p['POIコード'] or '公共施設・分類未設定','municipalityCode':'13201','coordinate':{'lat':float(p['緯度']),'lng':float(p['経度']),'crs':'not-stated-in-CSV'},'locator':'hachioji.csv#record='+str(i+1)+';ID='+p['ID'],'memberSHA256':hashlib.sha256(b).hexdigest(),'rawFeature':p})
    return rows

def main():
    ps,rels=inputs();rows=dataset();out=[]
    byname=collections.defaultdict(list);byaddress=collections.defaultdict(list)
    for i,r in enumerate(rows):
        byname[norm(r['name'])].append(i);byaddress[address(r['address'])].append(i)
    for pid,p in ps.items():
        if is_confirmed(p):continue
        for idx in sorted(set(byname[norm(p['name'])]+byaddress[address(p.get('address',''))])):
            row=rows[idx]
            match=classify(p,row)
            if match is None:continue
            score,nm,am=match
            out.append({'facilityId':pid,'name':p['name'],'address':p.get('address',''),'rankScore':score,'nameMatch':nm,'addressExactNormalized':am,'status':'needs-current-official-verification','datasetPoint':row,'distributionEvidence':p.get('evidence'),'currentRelations':[{'cardId':r['cardId'],'distributionEvidence':r.get('distributionEvidence'),'sourceUrls':r.get('sourceUrls',[]),'locationState':r.get('locationState')} for r in rels.get(pid,[])],'remaining':['2022地点の移転・建替え有無と現行公式施設ページの名称・住所を要確認' if row['dataset']=='P05-22' else 'CSVは建物代表点の定義と測地系が未記載。公式施設ページの地点まで要確認','住所不一致' if not am else '住所一致は建物の同一性を保証しない']})
    out.sort(key=lambda c:(-c['rankScore'],c['facilityId'],c['datasetPoint']['locator']))
    stats={'inputFacilities':len(ps),'inputUnconfirmedFacilities':sum(not is_confirmed(p) for p in ps.values()),'datasetRecords':dict(collections.Counter(r['dataset'] for r in rows)),'candidateRows':len(out),'candidateFacilities':len(set(c['facilityId'] for c in out)),'exactAddressCandidateFacilities':len(set(c['facilityId'] for c in out if c['addressExactNormalized']))}
    result={'schema':1,'method':'国土交通省P05施設地点・自治体標準CSVと施設名/番地を照合。住所ジオコーダー不使用。ランキングのみでは採用しない。','summary':stats,'sourceCatalog':'data/evidence/national/official-facility-index/sources.json','updates':[],'candidates':out}
    target=ROOT/'data/national/location-updates/official-facility-index.json';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(stats,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
