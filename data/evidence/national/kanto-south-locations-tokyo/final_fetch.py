from research import *
us=['https://www.city.machida.tokyo.jp/shisei/opendata/shisetsu/public_facility.files/132098_public_facility.csv','https://www.city.akiruno.tokyo.jp/0000015465.html','https://www.digitalservice.metro.tokyo.lg.jp/business/tokyo-data-highway/5gasset/assetdb','https://www.city.hamura.tokyo.jp/map/js/jquery.GoogleMaps2.js','https://sst8.jp/access/']
for u in us:
 r=fetch(u);write(ROOT/'manifest.json',new);print(u,r.get('status'));print([(t,v) for t,v in links(u) if '.csv' in v]);
 if 'GoogleMaps2' in u: print(pathlib.Path(r['snapshotPath']).read_text()[:16000])
