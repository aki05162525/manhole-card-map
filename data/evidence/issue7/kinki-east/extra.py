from investigate import *
TARGETS={
'5d739ed0da591dafd1d2':['https://www.city.suzuka.lg.jp/shisei/shisetsu/1004326/1004339.html'],
'd3beb94836fe72b63cfb':['https://www.city.kameoka.kyoto.jp/site/jougesuidou/'],
'c09001b28f3e7c1bf9f0':['https://museums.city.kameoka.kyoto.jp/','https://www.city.kameoka.kyoto.jp/soshiki/49/'],
'7de3550870a2bc3e4aec':['https://www.city.maizuru.kyoto.jp/kurashi/0000009007.html'],
'9064b04ef5f779d726f7':['https://www.ohmi.or.jp/zaidan/access/'],
}
if __name__=='__main__':
 save('extra-targets.json',TARGETS)
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:r=list(ex.map(fetch,sorted(set(u for v in TARGETS.values() for u in v))))
 save('extra-log.json',r);print('sources',len(r),'success',sum('snapshotPath'in x for x in r))
