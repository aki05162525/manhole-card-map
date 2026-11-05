from research import *
import csv,io
u='https://www.digitalservice.metro.tokyo.lg.jp/business/tokyo-data-highway/5gasset/assetdb'
print([(t,v) for t,v in links(u) if any(k in t+v for k in ['CSV','csv','11.4','zip'])])
for u in ['https://www.city.akiruno.tokyo.jp/cmsfiles/contents/0000015/15465/132284_public_facility2022-2.csv','https://www.city.machida.tokyo.jp/shisei/opendata/shisetsu/public_facility.files/132098_public_facility.csv','https://www.opendata.metro.tokyo.lg.jp/koganei/01_koukyoushisetsu.csv']:
 r=fetch(u);write(ROOT/'manifest.json',new);b=pathlib.Path(r['snapshotPath']).read_bytes()
 try:t=b.decode('utf-8-sig')
 except:t=b.decode('cp932')
 rows=list(csv.reader(io.StringIO(t)));print(u,rows[0]);print([x for x in rows if any(k in str(x) for k in ['市庁舎','本庁舎','第二庁舎','市役所'])][:12])
for u in ['https://sst8.jp/','https://sst8.jp/access/','https://tokyotouristinfo.com/detail/M0045']:
 print(u);s=soup(u);print(candidates(u));print(s.get_text(' ',strip=True)[-8000:])
