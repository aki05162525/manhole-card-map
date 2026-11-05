import research as r
idx=r.json.load(open(r.ROOT/'research-index.json'));out=[]
for i,x in enumerate(idx):
 lines=[f"{i} {x['name']} | {x['address']}"]
 urls=list(dict.fromkeys(x['sourceUrls']+[a['url'] for a in x['links']+x.get('followLinks',[])]))
 for u in urls:
  m=r.cache.get(u)
  if not m:continue
  s=r.soup(m)
  if s is None:lines.append(f"  {m.get('status',m.get('error','?'))}: {u}");continue
  title=s.title.get_text(' ',strip=True) if s.title else ''
  if r.re.search('不正アクセス|漏えい|漏洩|予約システム|入札|審査結果|採用|募集',title):continue
  maps=[r.urllib.parse.unquote(e.get('href',e.get('src',''))) for e in s.select('a[href],iframe[src]') if r.re.search('maps|mapion|mapfan|goo.gl',e.get('href',e.get('src','')))]
  scripts=' '.join(e.get_text() for e in s.select('script'))
  marker=' marker定義あり' if r.re.search('markerInfos|\.Marker|addMarker|L.marker|AdvancedMarkerElement',scripts) else ''
  q=sum(bool(r.re.search(r'[?&](?:q|query|destination)=3\d\.\d|!3d3\d\.\d+!4d1\d\d\.',v)) for v in maps)
  lines.append(f"  {title[:70]} | map:{len(maps)} 数値リンク候補（要同定）:{q}{marker} | {u}")
 out.append('\n'.join(lines))
(r.ROOT/'digest.txt').write_text('\n\n'.join(out))
