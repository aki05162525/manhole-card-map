exec(open('/tmp/issue60-own-georef-other/fetch.py').read().split('sites=')[0])
meta=json.load(open(O/'mosaic-metadata.json')); jobs=[]
for no,m in meta.items():
 x=(m['tileX0']+1)//128;y=(m['tileY0']+1)//128
 jobs.append((f'{no}-photo-spec.geojson',f'https://maps.gsi.go.jp/xyz/seamlessphoto_spec/11/{x}/{y}.geojson'))
jobs.append(('41-floor-archive.png','https://web.archive.org/web/20250000000000im_/https://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png'))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(fetch,jobs))
json.dump(logs,open(O/'spec-retrievals.json','w'),indent=2);print(logs)
