"""Record actual map references in inspected raw HTML; never approve coordinates."""
import json,pathlib,re,html,urllib.parse
ROOT=pathlib.Path('data/evidence/national/kanto-north');A=json.load(open('data/national/regions/kanto-north.json'));M={r['url']:r for r in json.load(open(ROOT/'manifest.json'))}
reports={}
for c in A['cards']:
 for u in dict.fromkeys(c['sourceUrls']+[u for r in c['relations'] for u in r['sourceUrls']]):
  if u in reports:continue
  row=M.get(u)
  if not row or not row.get('snapshotPath'):reports[u]={'url':u,'result':'no-response-body','detail':row.get('error','統合担当原本は別provenance参照') if row else '統合担当原本は別provenance参照'};continue
  if not 200<=row.get('status',0)<300:reports[u]={'url':u,'result':'http-error','status':row['status']};continue
  if 'text/html' not in row.get('contentType',''):reports[u]={'url':u,'result':'non-html','detail':'PDF/画像の配布記載は本文確認。機械抽出で座標を承認しない。'};continue
  raw=html.unescape(pathlib.Path(row['snapshotPath']).read_text(errors='replace'));refs=[]
  for val in re.findall(r'(?:href|src)=[\'"]([^\'\"]+)',raw,re.I):
   if any(k in val.lower() for k in ['maps.google','google.com/maps','goo.gl/maps','maps.app','map.php','mapion','mapfan']):refs.append(val)
  refs=list(dict.fromkeys(refs));nums=re.findall(r'(?:[?&](?:q|destination|query)=)(-?\d+\.\d+\s*,\s*-?\d+\.\d+)',raw)
  nums+=re.findall(r'position\s*:\s*new google.maps.LatLng\(\s*([0-9.]+\s*,\s*[0-9.]+)',raw)
  reports[u]={'url':u,'result':'raw-html-inspected','snapshotPath':row['snapshotPath'],'mapReferences':refs[:20],'explicitNumericDestinationCandidates':list(dict.fromkeys(nums)),'detail':'候補数値の有無のみを機械検査。蓋・別施設・表示中心との区別及び名称住所の照合はcoordinates.pyの個別採否に従う。' if nums else 'この原本ではq/destination/queryまたは直接Marker.positionに採用可能な数値対を抽出できない。住所検索URL・埋込表示中心・画像から座標を推測しない。'}
for c in A['cards']:c['sourceInspections']=[reports[u] for u in dict.fromkeys(c['sourceUrls']+[u for r in c['relations'] for u in r['sourceUrls']])]
pathlib.Path('data/national/regions/kanto-north.json').write_text(json.dumps(A,ensure_ascii=False,indent=2)+'\n');(ROOT/'map-inspections.json').write_text(json.dumps(list(reports.values()),ensure_ascii=False,indent=2)+'\n')
print('Inspected source records:',len(reports))
