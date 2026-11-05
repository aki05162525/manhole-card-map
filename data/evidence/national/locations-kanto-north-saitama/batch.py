from research import *
for line in sys.stdin:
 if not line.strip():continue
 ids,u=line.strip().split(' ',1)
 m=fetch(u);s=content(m); soup=BeautifulSoup(s,'html.parser')
 out=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.inspection.txt')
 with out.open('w') as f:
  f.write('URL '+u+'\nTEXT '+soup.get_text(' ',strip=True)+'\nMAP\n')
  for line in s.splitlines():
   if re.search(r'3[56]\.\d{3}|139\.\d{3}|140\.\d{3}|latitude|longitude',line,re.I):f.write(line[:8000]+'\n')
  f.write('\nLINKS\n')
  for x in soup.select('a[href],script[src]'):
   href=x.get('href',x.get('src',''));label=x.get_text(' ',strip=True)
   if re.search('アクセス|地図|所在地|交通|施設|庁舎|センター',label) or x.name=='script':f.write(label+' '+urllib.parse.urljoin(m.get('finalUrl',u),href)+'\n')
 log=ROOT/'assignments.json';rows=json.load(open(log)) if log.exists() else []
 for i in map(int,ids.split(',')):
  if [i,u] not in rows:rows.append([i,u])
 log.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 print(ids,u,m.get('status',m.get('error')),str(out),flush=True)
