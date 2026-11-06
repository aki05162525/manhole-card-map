exec(open('/tmp/issue60-own-georef-other/fetch.py').read().split('sites=')[0])
jobs=[('gsi-photo-def.txt','https://maps.gsi.go.jp/layers_txt/layers2.txt'),('41-bus.pdf','https://www.city.ibaraki-koga.lg.jp/material/files/group/80/basunonorikatagaidbook.pdf'),('41-west.html','https://www.kogakanko.jp/history/koga_st_w'),('41-floor-alt.png','https://jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png'),('41-floor-http.png','http://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png')]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:list(ex.map(fetch,jobs))
json.dump(logs,open(O/'more-retrievals.json','w'),indent=2);print(logs)
