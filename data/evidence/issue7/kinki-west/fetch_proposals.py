from additional import *
more=[
(['akashi-information'],'https://www.yokoso-akashi.jp/access/index.html'),
(['fukusaki-ekimae','fukusaki-tsujikawa'],'http://www.town.fukusaki.hyogo.jp/0000002753.html'),
(['higashiosaka-lobby','8c975ae9df85aa9fea39'],'https://www.city.higashiosaka.lg.jp/site_policy/0000000033.html'),
(['itami-gallery-temporary'],'http://itami-kankou.com/gallery'),
(['karako-information'],'https://karako-kagi.com/access'),
(['sennan-annex'],'https://www.city.sennan.lg.jp/kakuka/toshiseibi/gesui/index.html'),
(['tajiri-tourism'],'https://tajiri-tourism.com/touristinformationcenter/'),
(['habikino-visitor'],'https://www.city.habikino.lg.jp/soshiki/gesuido/gesuido_soumu/gesuido_soumu_oshirase/11515.html'),
(['0df3699f1debe84ccd2a'],'https://www.town.hyogo-inami.lg.jp/cmsfiles/contents/0000003/3230/tyousyaannaizu2023.pdf')]
for ids,u in more:
 if u not in seen:logs.append(fetch(u));seen.add(u)
 for r in rows:
  if r['facilityId'].split('kinki-')[1] in ids and u not in r['fetchUrls']:r['fetchUrls'].append(u)
for p,d in [('fetch-log.json',logs),('inventory.json',rows)]: (D/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
