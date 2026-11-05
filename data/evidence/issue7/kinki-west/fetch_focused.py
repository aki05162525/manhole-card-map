from additional import *
more=[(['6ad97690b4f9910a096e'],'https://www.city.fujiidera.lg.jp/soshiki/shiminseikatsu/kankou/aicelsyurahallkankoukyotenka/index.html'),(['0df3699f1debe84ccd2a'],'https://www.town.hyogo-inami.lg.jp/0000003230.html')]
for ids,u in more:
 if u not in seen:logs.append(fetch(u))
 for r in rows:
  if r['facilityId'].split('kinki-')[1] in ids and u not in r['fetchUrls']:r['fetchUrls'].append(u)
for p,d in [('fetch-log.json',logs),('inventory.json',rows)]: (D/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
