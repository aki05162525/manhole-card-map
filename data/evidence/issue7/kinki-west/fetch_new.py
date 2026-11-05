from additional import *
more=[
(['52945aa1816499e04704'],'https://www.ip.licsre-saas.jp/kawanishi/useguide/facilities.html'),
(['52945aa1816499e04704'],'https://www.astekawanishi.com/floor/'),
(['6ad97690b4f9910a096e'],'https://www.city.fujiidera.lg.jp/soshiki/kyoikuiinkai/shogaigakushu/oshirase/18462.html'),
(['0df3699f1debe84ccd2a'],'https://www.town.hyogo-inami.lg.jp/cmsfiles/contents/0000005/5921/kouhou2023_9.pdf'),
([], 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html')]
for ids,u in more:
 if u not in seen:logs.append(fetch(u))
 for r in rows:
  if r['facilityId'].split('kinki-')[1] in ids and u not in r['fetchUrls']:r['fetchUrls'].append(u)
for p,d in [('fetch-log.json',logs),('inventory.json',rows)]: (D/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print(len(logs))
