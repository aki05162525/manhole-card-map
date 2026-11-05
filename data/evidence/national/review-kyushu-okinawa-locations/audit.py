import json,csv,io,re,hashlib,zipfile,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
from html import unescape
OUT=Path('data/evidence/national/review-kyushu-okinawa-locations')
def read(p):
 b=Path(p).read_bytes()
 if b.startswith(b'%PDF'):
  return subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode('utf-8')
 for enc in ['utf-8-sig','cp932','utf-16']:
  try:return b.decode(enc)
  except UnicodeError:pass
 return b.decode('utf-8',errors='replace')
def plain(s):
 s=re.sub(r'<(script|style)\b.*?</\1>','',s,flags=re.S|re.I)
 return re.sub(r'\s+',' ',unescape(re.sub('<[^>]+>',' ',s)))
u=json.load(open('data/national/location-updates/kyushu-okinawa.json'))['updates']
p={x['id']:x for x in json.load(open('/tmp/national-parent-assembled.json'))['places']}
reg=json.load(open('data/national/regions/kyushu-okinawa.json'))
records=[]
for i,x in enumerate(u):
 f=p[x['facilityId']];e=x['evidence'];raw=read(e['snapshotPath']);b=Path(e['snapshotPath']).read_bytes()
 v={'index':i,'facilityId':x['facilityId'],'name':f['name'],'address':f['address'],'coordinate':x['coordinate'],'evidence':e,'hashMatches':hashlib.sha256(b).hexdigest()==e['snapshotSHA256']}
 if '論理レコード' in e['sourceLocator']:
  n=int(re.search(r'論理レコード(\d+)',e['sourceLocator'])[1]); rows=list(csv.DictReader(io.StringIO(raw))); row=rows[n-2];v['logicalRecord']=n;v['rawRecord']=row
 elif b.startswith(b'PK'):
  z=zipfile.ZipFile(io.BytesIO(b)); member=e['sourceLocator'].split(' / ')[0]; name=re.search(r'name=(.+?)\]',e['sourceLocator'])[1];root=ET.fromstring(z.read(member));mark=next(t for t in root.findall('.//{*}Placemark') if t.findtext('{*}name')==name);v['rawPlacemark']=ET.tostring(mark,encoding='unicode')
 else:
  v['pageText']=plain(raw)
  v['mapFragments']=[raw[max(0,m.start()-180):m.end()+250] for m in re.finditer(r'(?:'+re.escape(str(x['coordinate']['lat']))+'|'+re.escape(str(x['coordinate']['lng']))+r'|!2z[^!]+|<iframe[^>]+)',raw)]
 v['distribution']=[]
 for c in reg['cards']:
  for r in c['relations']:
   if r.get('facilityId')==x['facilityId']:
    v['distribution'].append({'cardId':c['cardId'],**r})
 if f.get('evidence',{}).get('snapshotPath'):
  de=f['evidence'];v['facilityEvidence']=de;v['facilityPageText']=plain(read(de['snapshotPath']))
 records.append(v)
(OUT/'independent-extraction.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
for v in records:
 print(v['index'],v['name'],v['address'])
 if 'rawRecord' in v:print(json.dumps({k:w for k,w in v['rawRecord'].items() if w},ensure_ascii=False))
 if 'rawPlacemark' in v:print(v['rawPlacemark'])
print('all hashes',all(v['hashMatches'] for v in records))
