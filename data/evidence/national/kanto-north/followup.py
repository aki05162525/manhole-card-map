import research as R,json,urllib.parse,re,html
m=json.load(open(R.MAN));urls=[
'https://www.city.tokorozawa.saitama.jp/kurashi/jogesuido/gesui/manholecard/tokorozawacitymanholecard.html',
'https://www.city.hanno.lg.jp/kurashi_seikatsukankyo/gesuido/designmanholekankei/7823.html',
'https://www.city.fujimino.saitama.jp/kurashinojoho/jogesuido/gesuido/4400.html',
'https://www.city.fujimino.saitama.jp/soshikiichiran/jogesuidoka/gesuidoshisetsukakari/manhoru/17326.html',
'https://www.f-bunka.jp/stella-east/manhole_card/',
'https://www.town.yoshioka.lg.jp/kurashi/suido/gesuido/manhole_card.html',
'https://www.town.kusatsu.gunma.jp/s011/030/020/1743492914990/index.html',
'https://www.city.misato.lg.jp/soshiki/kensetsu/gesuido/5/961.html',
'https://www.stgesui.or.jp/pr/', 'https://www.stgesui.or.jp/facility/',
'https://www.city.nasushiobara.tochigi.jp/material/files/group/4/ns20191205_all.pdf']
for r in m:
 if not r.get('snapshotPath') or not 200<=r.get('status',0)<300:continue
 s=R.decode(R.pathlib.Path(r['snapshotPath']).read_bytes());base=r.get('finalUrl',r['url'])
 for target in re.findall(r'CONTENT=[\'"]0;URL=([^\'\"]+)',s,re.I):urls.append(urllib.parse.urljoin(base,target))
 if not any(k in base for k in ['ishioka','naka.lg','kasumigaura','oigami','grimm','hidaka','ageo','numata','kitamoto']):continue
 for href,label in re.findall(r'<a\b[^>]*href=[\'"]([^\'\"]+)[\'"][^>]*>(.*?)</a>',s,re.I|re.S):
  label=re.sub('<[^>]+>','',label)
  if 'マンホールカード' in label or 'マンホールカード' in urllib.parse.unquote(href):
   u=urllib.parse.urljoin(base,html.unescape(href))
   if u.startswith(('https:','http:')) and 'gk-p.jp' not in u:urls.append(u)
(R.ROOT/'followup-urls.json').write_text(json.dumps(list(dict.fromkeys(urls)),ensure_ascii=False,indent=2));R.run(urls)
