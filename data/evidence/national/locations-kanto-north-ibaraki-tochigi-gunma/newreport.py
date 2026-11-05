from research import *
for m in manifest:
 s=read(m);soup=BeautifulSoup(s,'html.parser');hits=[]
 for a in soup.select('a[href],iframe[src]'):
  v=urllib.parse.unquote(a.get('href') or a.get('src',''))
  if re.search(r'!3d[\d.]+!4d|[?&](q|destination|query)=3[4567]\.\d',v):hits.append((a.get_text(' ',strip=True),v))
 for mt in re.finditer(r'(?:position\s*:\s*new google|latitude|longitude|LatLng\(|geo.position|geo:lat|geo:long)',s):
  a=s[mt.start():mt.start()+200].replace('\n',' ')
  if re.search('3[4567]\.\d|1[34][09]\.\d',a):hits.append(('script',a))
 if hits:print(m['url'],soup.title.get_text() if soup.title else '',json.dumps(hits,ensure_ascii=False))
