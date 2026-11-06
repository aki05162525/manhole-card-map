from fetch import *
jobs=[('35-renewal.pdf','https://www.town.yorii.saitama.jp/uploaded/attachment/21243.pdf'),('35-plan.pdf','https://www.town.yorii.saitama.jp/uploaded/attachment/19987.pdf'),('42-news.pdf','https://www.city.sano.lg.jp/material/files/group/1/704_2-9.pdf'),('gsi-seamless-legend.pdf','https://cyberjapandata.gsi.go.jp/legend/seamlessphoto.pdf'),('gsi-tiles.html','https://maps.gsi.go.jp/development/ichiran.html')]
for n,w in json.loads((O/'windows.json').read_text()).items():jobs.append((f'{n}-spec.geojson',f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto_spec/11/{(w["x0"]+2)//128}/{(w["y0"]+2)//128}.geojson'))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:rows=list(ex.map(fetch,jobs))
(O/'extra-retrievals.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False));print(rows)
