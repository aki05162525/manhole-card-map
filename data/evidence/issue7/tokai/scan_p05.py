from research import *
import unicodedata,difflib
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');features=[]
for pref in [21,22,23]:
 a=f'P05-22_{pref}_GML.zip';b=f'P05-22_{pref}.geojson';zz=zipfile.ZipFile(io.BytesIO(z.read(a)))
 for i,f in enumerate(json.loads(zz.read(b))['features']):features.append((f'{a}!{b}#/features/{i}',f))
def norm(s):
 s=unicodedata.normalize('NFKC',s)
 for t in ['静岡県','岐阜県','愛知県','番地','丁目','番','号',' ','（','）','(',')']:s=s.replace(t,'')
 return s
out=[]
for id in ids:
 p=places[id];name=norm(p['name']);address=norm(p['address']);matches=[]
 for loc,f in features:
  pn=norm(f['properties']['P05_003']);pa=norm(f['properties']['P05_004'])
  if (len(pn)>3 and pn in name) or (len(pa)>6 and (pa in address or address in pa)):
   matches.append({'locator':loc,'rawFeature':f})
 out.append({'facilityId':id,'query':{'name':p['name'],'address':p['address']},'method':'P05-22 prefectures21/22/23全featureの正規化名称包含・住所包含検索。候補検索のみ。同名別棟/複合施設/住所表記差は人間同等の原典照合を別途要し、ゼロ件は原本に不存在の証明ではない。','matches':matches})
save(OUT/'p05-search.json',out)
print('searched',len(out),'facilities;',sum(bool(x['matches']) for x in out),'with leads')
