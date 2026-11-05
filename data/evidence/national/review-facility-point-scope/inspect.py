import json,re,hashlib
from pathlib import Path
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self):super().__init__();self.out=[];self.hide=0
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.hide+=1
 def handle_endtag(self,t):
  if t in ('script','style'):self.hide=max(0,self.hide-1)
 def handle_data(self,d):
  if not self.hide and d.strip(): self.out.append(d.strip())
def txt(p):
 b=Path(p).read_bytes()
 for enc in ['utf-8','cp932']:
  try:s=b.decode(enc);break
  except:pass
 else:s=b.decode('utf-8',errors='replace')
 if '<' in s[:2000]:
  t=Text();t.feed(s);return '\n'.join(t.out)
 return s
names={x['id']:x for x in json.load(open('data/work/national-assembled-kanagawa-locations.json'))['places']}
groups=['chubu-east-north','kanto-south-kanagawa','kanto-south-chiba']
rows=[]
for g in groups:
 for i,u in enumerate(json.load(open('data/national/location-updates/'+g+'.json'))['updates']):
  if g!='chubu-east-north' and u.get('scope')!='facility':continue
  t=names[u['facilityId']];rows.append({'group':g,'index':i,'update':u,'target':t})
if __name__=='__main__':
 import sys
 for r in rows:
  if sys.argv[1]!='all' and r['group']!=sys.argv[1]:continue
  if len(sys.argv)>2 and r['index'] not in [int(x) for x in sys.argv[2].split(',')]:continue
  u=r['update'];t=r['target'];p=u['evidence']['snapshotPath'];print('\n###',r['index'],t['name'],p)
  if p.endswith('.zip'):continue
  s=txt(p); lines=s.splitlines();
  # tourism main starts after title repetition / before footer
  if '基本情報' in lines:
   k=lines.index('基本情報'); print('\n'.join(lines[max(0,k-28):k+42]))
  else:
   keys=['配布','受付','窓口','西館','時代館','管理棟','物産','所在地','住所','観光案内所','センター','18番','18字','Google','地図']
   found=set()
   for j,line in enumerate(lines):
    if any(k in line for k in keys):
     for k in range(max(0,j-1),min(len(lines),j+3)):found.add(k)
   print('\n'.join(lines[k] for k in sorted(found))[:9500])
