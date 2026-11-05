import json,pathlib,re,urllib.parse
from bs4 import BeautifulSoup
root=pathlib.Path('data/evidence/national/kinki'); out=[]
for m in json.load(open(root/'manifest.json')):
 if m.get('status')!=200 or 'html' not in m.get('contentType',''):continue
 s=BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser')
 for el in s.select('a[href],iframe[src]'):
  u=urllib.parse.unquote(el.get('href',el.get('src','')))
  pts=re.findall(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)',u)+re.findall(r'[?&](?:q|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)',u)
  if pts:
   a={'url':m['url'],'coordinates':pts,'label':el.get_text(' ',strip=True),'context':el.parent.get_text(' ',strip=True)[:450],'mapUrl':u};out.append(a)
(root/'coordinate-candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for i,a in enumerate(out):print(i,a['url'],a['coordinates'],a['label'],a['context'])
