import research as r
import sys,json,re
from pathlib import Path
pref=sys.argv[1]
m={v['url']:v for v in json.load(open(r.manifest_path))}
seen=set()
for c in r.CARDS:
 if not c['id'].startswith(pref):continue
 if len(sys.argv)>2 and not (sys.argv[2]<=c['id']<=sys.argv[3]):continue
 print('\n###',c['id'],c['city']);print('PLACES:',str(c['placeText']));print('HOURS:',c.get('hours'))
 for u in (c.get('links') or []):
  u=r.urllib.parse.urldefrag(u)[0]
  if u in seen: print('REUSE',u);continue
  seen.add(u);v=m.get(u,{})
  print('URL',u,'STATUS',v.get('status',v.get('error','NOT FETCHED')))
  if not v.get('snapshotPath') or v.get('status')!=200:continue
  p=r.parse(Path(v['snapshotPath']).read_bytes());s=p.text();lines=s.splitlines()
  matches=[i for i,line in enumerate(lines) if re.search('マンホール|配布|カード|在庫',line)]
  inds=set()
  for i in matches:
   inds.update(range(max(0,i-2),min(len(lines),i+23)))
  out='\n'.join(lines[i] for i in sorted(inds))
  start=out.find('ここから本文です。')
  if start>=0:out=out[start:]
  for end in ['このページに関するお問い合わせ','この記事に関するお問い合わせ','このページのお問い合わせ','このページを見ている人','ご意見をお聞かせ','お問い合わせ先']:
   if end in out:out=out[:out.index(end)]
  print(out)
