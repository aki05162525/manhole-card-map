exec(open('/tmp/issue60-own-georef-other/fetch.py').read().split('sites=')[0])
jobs=[(f'gsi-layers{i}.txt',f'https://maps.gsi.go.jp/layers_txt/layers{i}.txt') for i in [0,1,3,4]]+ [('13-station.png','https://www.keikyu.co.jp/ride/kakueki/img/KK71_im01.png')]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(fetch,jobs))
json.dump(logs,open(O/'metadata-retrievals.json','w'),indent=2)
for p in (O/'raw').glob('gsi-layers*.txt'):
 try:j=json.load(open(p))
 except:continue
 def walk(x):
  if isinstance(x,dict):
   if 'seamlessphoto' in str(x.get('id','')):print(p.name,x)
   for v in x.values():walk(v)
  elif isinstance(x,list):
   for v in x:walk(v)
 walk(j)
