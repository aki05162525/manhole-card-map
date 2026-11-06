import json,math,hashlib,pathlib,sys
from shapely.geometry import shape,Point,box,mapping
from shapely.ops import unary_union,polylabel
O=pathlib.Path('/tmp/issue60-recheck-saitama-nov6');R=pathlib.Path.cwd();E=R/'data/evidence/kanto-prefecture/saitama/groups'
rows={x['number']:x for x in json.load(open(O/'numerical-comparison.json'))}
users={x['number']:x for x in json.load(open(O/'user-report.json'))}
selected={22:[1154],23:[2212,2503],24:[2700],25:[5221],29:[1228],32:[1467,1468,1469]}
# This is a research proposal, never an adoption review.
basis={22:'訂正点は1154内。公式外観は受付建物と隣接ケージを区別でき、アリーナ1156の西・駐車場西という位置関係が一致。利用者報告の北東側受付に合わせ1154北半分の内部点をGSIから導出。木造という構造種別は外観写真から確認できず根拠にしない。',23:'訂正点は2212/2503合体外形内。公式配置図の管理本館・沈砂池・ポンプ棟の同一連接建物。国道298号が西、笹目川が北東、円形分水槽が北西という対応で模式図を回転し、管理本館側は合体外形南西側と判断。合体外形南西側区画から代表点を導出。',24:'利用者は北指定を撤回して南2階庁舎と訂正。公式外観は庁舎表示・前面駐車場を確認できる。南2700を建物代表点候補とする。Google数値は北棟内のままであり撤回された北棟の数値として採用しない。棟選択は利用者の訂正した叙述を利用しているため、親レビューではこの証拠区分を確認する。',25:'現住所・店舗036を公式店舗頁で確認。2026商店街図は銀座2丁目付近、北側まちづくりセンターより東、南側で37と35の間。道路配置から5221を支持し、東側6009/9903への旧選択を支持しない。利用者クリックは5221北端内に入る。移転が旧誤りの原因という説は未検証で採用根拠にしない。',29:'訂正点は1228内。公式詳細案内の前田道路前からカーブ→レンガ正門、p148の管理棟・ポンプ棟・沈砂池の複合棟、東側処理区・河川/道路配置と照合。旧822のみの比較集合では現在指示された建物を評価できなかった。1228の内部代表点をGSIから導出。',32:'Google数値は西の大きな処理施設1471内であり採用しない。利用者の東正門の右北という訂正叙述と公式配置図（駐車場、2円形設備、管理棟の切欠き）を照合すると1467/1468/1469連接棟。公式図の上を実地西へ回転すると道路・管理棟南の2円形設備が一致。北東の連接外形を同一管理棟として代表点を導出。'}
out=[];geos=[]
for n,ids in selected.items():
 r=rows[n];d=json.load(open(r['geometryPath']));t=d['baseTile'];fs=[d['features'][i] for i in ids];g=unary_union([shape(f['geometry']) for f in fs]);chosen=g
 if n==22:
  x0,y0,x1,y1=g.bounds;chosen=g.intersection(box(x0,y0,x1,(y0+y1)/2))
 if n==23:
  # Fixed numerical selection of southwest strip based on official main-building zone.
  # In screen coordinates southwest maximizes y-x. Select outer 30% of oriented bounding box width.
  from shapely.affinity import rotate
  rot=rotate(g, 30, origin=(0,0));x0,y0,x1,y1=rot.bounds
  # Main building lies southwest, the left side after aligning long axis north-south.
  chosen=rotate(rot.intersection(box(x0,y0,x0+(x1-x0)*.30,y1)),-30,origin=(0,0))
 if chosen.geom_type=='MultiPolygon':chosen=max(chosen.geoms,key=lambda z:z.area)
 p=chosen.centroid if n==23 and chosen.contains(chosen.centroid) else polylabel(chosen,tolerance=.25)
 def ll(p):return {'lat':round(math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+p.y/4096)/2**t['z'])))),7),'lng':round((t['x']+p.x/4096)/2**t['z']*360-180,7)}
 coord=ll(p);lat=coord['lat'];lng=coord['lng'];q=Point(((lng+180)/360*2**t['z']-t['x'])*4096,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**t['z']-t['y'])*4096);scale=2*math.pi*6378137*math.cos(math.radians(lat))/2**t['z']/4096
 rawrefs=[]
 for f in fs:
  z,x,y=[f['sourceTile'][v] for v in ['z','x','y']];name={22:'north/tenku',23:'waterworks/nanbu',24:'civic/ina',25:'tourism/machizou',29:'waterworks/ugan',32:'civic/ishii'}[n];group,slug=name.split('/')
  tile=E/group/(f'{slug}/{z}-{x}-{y}.pbf.gz' if group=='waterworks' else f'{slug}-{z}-{x}-{y}.pbf.gz')
  rawrefs.append({'path':str(tile),'sha256':hashlib.sha256(tile.read_bytes()).hexdigest(),'layer':f['layer'],'layerFeatureIndex':f.get('layerFeatureIndex'),'sourceFeatureIndex':f['sourceFeatureIndex']})
 geos.append(dict(number=n,baseTile=t,features=fs,combinedIndexes=ids,selectionGeometry=mapping(chosen),originalCombinedPath=r['geometryPath'],originalCombinedSHA256=r['geometrySHA256'],rawTiles=rawrefs))
 out.append(dict(number=n,facilityId=r['facilityId'],coordinate=coord,status='candidate_for_independent_review',adoptionApproved=False,source='国土地理院 optimal_bvmap-v1 保存数値外形から自前導出（Google数値の転載ではない）',method='selected geometry maximum-clearance internal point (No23 southwest strip centroid); XYZ y-down, extent4096; 7 decimal rounding',buildingIdentification=basis[n],userReportIsSeparateEvidence=True,geometryRef=f'candidate-geometries.json#/{len(geos)-1}',strictlyWithin=g.contains(q),boundaryMarginM=round(g.boundary.distance(q)*scale,3),uncertainty={'absoluteSurveyErrorM':None,'notAbsoluteErrorBound':'境界余裕は位置精度保証ではない。GSI各棟の測量日・絶対誤差は未確認。','buildingImpact':'代表点は対象建物の内部。別棟・入口・室内窓口の点ではない。建物対応は公式図と今回の利用者報告に基づく推定で独立レビュー未実施。','specific':basis[n]},termsRef='data/evidence/kanto-prefecture/saitama/source-conditions.json',attribution='国土地理院最適化ベクトルタイルをmanhole-card-mapが加工',sourceDate='保存版2026-11-05取得を継承；利用者確認2026-11-06；新規資料はretrievals参照'))
(O/'candidate-geometries.json').write_text(json.dumps(geos,ensure_ascii=False,indent=2)+'\n');(O/'candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
for x in out:print(x['number'],x['coordinate'],x['boundaryMarginM'])
