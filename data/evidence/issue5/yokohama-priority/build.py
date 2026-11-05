import json,pathlib,hashlib
D=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd())
read=lambda p:json.loads(pathlib.Path(p).read_text())
write=lambda p,v:pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
rows=read(D/'fetch-records.json')
reused=[{k:v for k,v in r.items() if k in ['sourceUrl','snapshotPath','snapshotSHA256','fetchedAt','status']} for r in read(D.parent/'south-kanto/fetch-records.json') if r['sourceUrl'] in ['https://www.jebl.co.jp/building/yokohamatower/','https://yokohamastationcity.com/jr_yokohama_tower/','https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/kasen-gesuido/gesuido/koho/manholecard.html']]
write(D/'reused-sources.json',reused)
p=read(D/'derived-point.json');source=next(r for r in rows if r['snapshotPath'].endswith('53391459.gml.gz'))
locator='CityGML 53391459_bldg_6697_op.gml; gml:id='+p['gmlId']+'; uro:buildingID=14100-bldg-120521; bldg:lod0FootPrint exterior。原本を可逆gzip保存。市2026年3月資料PDF物理28頁（印刷27頁）のJR横浜タワー（駅前棟）、線路西側・中央西口広場東隣・モアーズ南側の配置と形状を照合。約60mの低層部と約135mの北側高層部を市計画資料物理16頁と照合。現在の観光案内所2階入居は市カード本文とJR本文。'
method='AIによる資料照合、現地測量ではない。原CRS EPSG:6697（JGD2011＋標高）、lat/lon/height順。LOD0外形の水平座標(EPSG:6668)をEPSG:6677（平面直角IX）へ投影し面積重心を計算、建物内包含を検証しEPSG:6668へ逆投影、7桁丸め。WGS84への測地系変換なし。住所中心・入口・室内窓口点ではなく建物代表点。出典：横浜市「3D都市モデル（Project PLATEAU）横浜市（2024年度）」https://www.geospatial.jp/ckan/dataset/plateau-14100-yokohama-shi-2024 （国土交通省PLATEAU配信）。CC BY 4.0。上記外形を加工し本調査が代表点を作成。原典が公式に公表する施設Pointではない。利用判断と限界は同梱README。'
evidence={k:source[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']}
evidence.update(sourceLocator=locator,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
result={'schema':1,'region':'yokohama-priority','updates':[{'facilityId':'facility:kanto-south-4ecb948da292cb16373b','coordinate':p['coordinate'],'scope':'building','evidence':evidence}],'unresolved':[],'researchMetadata':{'status':'candidate-for-parent-review','cardIds':['14-100-A001'],'name':'横浜駅観光案内所','address':'横浜市西区南幸1-1-1 JR横浜タワー2階','coordinateProvenance':'PLATEAU polygon-derived, independent of Google point','evidenceDirectory':str(D),'license':'CC BY 4.0 (dataset metadata); PLATEAU site policy and FAQ read together','publicationScope':'建物代表点1点と出典・加工説明。既存JR/Google等原本の一括公開を許諾した判断ではない。','limitations':['原本は名称・番地属性を持たないため、市の配置図と形状・高さによる同定。','2024年度版は観測年ではない。対象surveyYear=2020、creationDate=2024-03-22。','PLATEAU FAQは手続き不要・商用可。サイトポリシー3(2)は測量法等の制約を留保。特定の測量成果複製・使用に該当する利用まで一律免除されるとは断定しない。公開形態を建物形状・原本一括再配布や測量成果作成へ広げる際は別途適用確認が必要。'],'reproduction':'uv run --with pyproj==3.8.0 --with shapely==2.2.0 python '+str(D/'validate.py')}}
write('data/national/issue5/yokohama-priority.json',result)
