from research import *
for r in MAN:
 u=r['url']
 if '/map/search/detail/' not in u: continue
 s=content(r);bs=BeautifulSoup(s,'html.parser');match=re.search(r'new google.maps.LatLng\(([^)]+)',s)
 print(u,match.group(1) if match else '-',bs.select_one('.table_detail').get_text(' ',strip=True)[:230] if bs.select_one('.table_detail') else '')
