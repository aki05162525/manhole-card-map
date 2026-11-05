from research import *
U={23:['https://goo.gl/maps/oeSWWmLPv612'],38:['https://www.city.shiroi.chiba.jp/material/files/group/2/122327_public_facility.csv'],15:['https://www.google.com/maps/d/kml?mid=1wiRu2WXxoY3B-ioeNuz9MNx6jksSvqM&forcekml=1']}
p=ROOT/'targets.json';d=json.load(open(p));
for k,v in U.items():d[str(k)]=d.get(str(k),[])+v
p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 for u in us:
  m=fetch(u);print(i,u,m.get('status'),m.get('finalUrl'),flush=True)
for i,u in [(29,'https://www.abikoinfo.jp/user-guide/')]:
 m=fetch(u)
 for f in soup(m).find_all('iframe',src=True):
  r=fetch(f['src']);r['embeddedBy']=u;save()
# catalog links
m=fetch('https://www.city.ichikawa.lg.jp/page/4744.html');s=soup(m)
for a in s.find_all('a',href=True):
 if a.find('img') or 'data' in a['href']:print(a.get_text(),a['href'],str(a)[:250])
