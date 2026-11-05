"""Offline reproducible build; no requests, no edits outside this task's two paths."""
import json,pathlib,hashlib,shutil,re,html,urllib.parse,datetime
from decisions import APPROVED
ROOT=pathlib.Path('data/evidence/national/locations-kinki')
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(p,v):pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
targets=read(ROOT/'targets.json'); records=read(ROOT/'research-index.json')
old=read('data/evidence/national/kinki/manifest.json'); manifest=read(ROOT/'manifest.json'); cache={m['url']:m for m in old+manifest}
# Reuse original bytes and original acquisition timestamps, never pretend to refetch.
used={u for r in records for u in r['sourceUrls']+[x['url'] for x in r['links']+r.get('followLinks',[])]}
used|={a[0] for a in APPROVED.values()}
for u in sorted(used):
 m=cache.get(u)
 if not m or not m.get('snapshotPath') or m['snapshotPath'].startswith(str(ROOT)):continue
 n=dict(m);src=pathlib.Path(m['snapshotPath']);dst=ROOT/'snapshots'/('reused-'+hashlib.sha256(u.encode()).hexdigest()[:20]+src.suffix)
 shutil.copyfile(src,dst);n.update(snapshotPath=str(dst),reusedFrom=m['snapshotPath'],reusedManifest='data/evidence/national/kinki/manifest.json');manifest.append(n);cache[u]=n
save(ROOT/'manifest.json',manifest)
SPECIAL={
3:'図書館・駐車場の目的地点は別施設。関町木崎919-1の下水道課位置とは同定できない。',
59:'スカイランドと処理場の地図qは取得したが、広い施設内の管理事務所棟と一致する根拠が不足。',
62:'施設公式アクセスの取得が429となり、拒否は回避していない。',
108:'配布案内の数値qはスポーツセンター前のカラーマンホール蓋の説明に属するため不採用。',
122:'上下水道部庁舎の明示qは広瀬3-11-24。元施設の大薮浄水場広瀬3-12-10とは異なるため流用しない（proposal側の照合候補）。',
123:'確認できた数値qは町役場（桜井二丁目1-1）であり歴史文化資料館（桜井一丁目3-1）ではない。',
125:'新しい役場アクセス・庁舎案内を取得したが、施設目的地点の数値は確認できなかった。',
135:'神戸空港公式アクセスが403。拒否は回避せず、ターミナル内案内所の目的地点を確定できない。',
138:'ページ末尾の明示地点は市役所担当課。駅内観光案内所へ流用しない。',
142:'市の施設紹介と商業施設の店舗紹介を追加確認。配布原典の数値地点は蓋であり、店舗建物の明示目的地点を確定できない。',
150:'旧駅構内施設と2026年9月以降の新配布施設を区別する必要があり、新施設の位置を旧facilityへ流用しない。',
152:'駅周辺施設の住所表記に篠原503-2と溝之口の相違があり、現住所と目的地点の同定が未完。',
156:'公式の車ルート終点と施設地図の位置同定が未完。短縮地図が429となり、駐車場入口の可能性を残すルート終点は不採用。',
163:'川西市役所とキセラ川西プラザの数値地点はアステ市民プラザと別施設なので不採用。',
183:'公式観光施設紹介を追加取得。Google埋込の!2d/!3dはviewport中心でありマーカーの数値ではない。',
188:'市の鹿の舟施設ページと運営者施設ページを追加取得。埋込viewport中心を観光案内所「繭」の目的地点として採用しない。',
189:'市の施設一覧で植槻町6-10を追加照合したが、庁舎の明示目的地点は得られなかった。',
191:'展示館案内の地図は見出し「黒塚古墳」の下にある。古墳の代表点と展示館の建物位置を区別できないため不採用。',
192:'旧華甍は休館し新窓口は今井まちづくりセンター。新窓口の地点を旧華甍facilityへ流用しない。',
193:'配布ページの数値qは「よみがえる藤原京」蓋設置場所であり資料室ではない。',
194:'配布ページの数値qは「よみがえる藤原京」蓋設置場所でありナビプラザではない。',
196:'ビジターセンターの追加公式条例PDFは404。現施設の明示目的地点を確定できない。',
199:'配布案内の数値qは田原本駅西側ロータリーの蓋。道の駅公式アクセス埋込のviewport中心も不採用。',
202:'庁舎案内の数値qは取得できたが2024年の同一敷地内建替え前後の建物位置との照合が未完。住所一致だけで新庁舎地点に確定しない。',
203:'庁舎案内の数値qは取得できたが2024年の同一敷地内建替え前後の建物位置との照合が未完。住所一致だけで新庁舎地点に確定しない。',
205:'旧施設紹介URLは404。駅交流施設条例で明王寺37-1を追加照合したが建物の数値目的地点は未確認。',
}
def attempt(u):
 m=cache.get(u)
 if not m:return {'url':u,'result':'探索リンクとして記録したが原本取得記録がなく、このURLは位置根拠にしていない。'}
 if m.get('status')!=200:return {'url':u,'result':('HTTP '+str(m['status']) if 'status'in m else m.get('error','取得失敗'))+'。位置根拠として不採用。'}
 b=pathlib.Path(m['snapshotPath']).read_bytes();s=b.decode('utf-8',errors='replace');t=re.search(r'<title[^>]*>(.*?)</title>',s,re.S|re.I);title=html.unescape(re.sub('<[^>]+>','',t[1])).strip() if t else '非HTML原本'
 d=urllib.parse.unquote(html.unescape(s));features=[]
 if re.search(r'!3d3\d\.\d+!4d1\d\d\.\d+|[?&](?:q|query|destination)=3\d\.\d+,',d):features.append('数値目的地候補あり（他施設・蓋の可能性があり自動採用しない）')
 if re.search(r'!1m3!1d[^!]+!2d[^!]+!3d',d):features.append('埋込viewport中心あり（不採用）')
 if re.search(r'markerInfos|\.Marker|L.marker|addMarker|initlat',d):features.append('地図スクリプトあり（当該施設との同定が必要）')
 return {'url':u,'result':'HTTP 200「'+title[:120]+'」。'+('／'.join(features) if features else '施設案内・交通・関連リンクを探索したが、この取得原本から当該施設の採用可能な数値位置を確定していない。')}
updates=[];unresolved=[];proof=[]
for i,(p,r) in enumerate(zip(targets,records)):
 assert p['id']==r['facilityId']
 if i in APPROVED:
  u,lat,lng,note=APPROVED[i];m=cache[u];assert m['status']==200
  raw=pathlib.Path(m['snapshotPath']).read_bytes();decoded=urllib.parse.unquote(html.unescape(raw.decode('utf-8',errors='replace')))
  assert lat in decoded and lng in decoded,(i,'coordinate missing in primary bytes')
  k=decoded.find(lat);snippet=decoded[max(0,k-180):k+350]
  ev={'sourceUrl':u,'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['snapshotSHA256'],'sourceLocator':note+' 原典数値: '+lat+', '+lng,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIによる公式原典の施設名・現住所・数値位置の照合。現地確認・人確認ではない。施設・建物代表点であり室内配布窓口位置を示さない。'}
  updates.append({'facilityId':p['id'],'coordinate':{'lat':float(lat),'lng':float(lng)},'evidence':ev});proof.append({'facilityId':p['id'],'name':p['name'],'address':p['address'],'sourceUrl':u,'coordinate':[lat,lng],'sourceExcerpt':snippet,'finding':note})
 else:
  us=list(dict.fromkeys(r['sourceUrls']+[x['url'] for x in r['links']+r.get('followLinks',[])]+[x['url'] for x in read(ROOT/'map-links.json') if x['facilityIndex']==i]))
  reasons=SPECIAL.get(i,'取得した配布原典・関連施設案内・アクセス案内を探索したが、対象「'+p['name']+'」（'+p['address']+'）の現住所に結びついた明示目的地点を確定できない。関連する市役所・他施設の地点、住所検索、表示中心を流用しない。')
  unresolved.append({'facilityId':p['id'],'attempts':[attempt(u) for u in us],'reason':reasons})
out={'schema':1,'region':'kinki','updates':updates,'unresolved':unresolved};dest=pathlib.Path('data/national/location-updates/kinki.json');dest.parent.mkdir(parents=True,exist_ok=True);save(dest,out);save(ROOT/'coordinate-review.json',proof)
# Checks cover all targets and every snapshot in our acquisition manifest.
ids=[v['facilityId'] for v in updates+unresolved];assert len(ids)==len(set(ids))==len(targets)==206;assert set(ids)=={p['id'] for p in targets}
fragment=read('data/overrides/regions/kinki.json');assert {p['id'] for p in fragment['places'] if not p.get('coordinate')}==set(ids)
assert set(ids)<={r['placeId'] for r in fragment['relations']}
for m in manifest:
 if m.get('snapshotPath'):assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['snapshotSHA256'],m['url']
for x in updates:
 assert 33<x['coordinate']['lat']<36 and 134<x['coordinate']['lng']<137
save(ROOT/'validation.json',{'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targets':len(targets),'updates':len(updates),'unresolved':len(unresolved),'allTargetsExactlyOnce':True,'allFacilityIdsInOriginalFragment':True,'allTargetsReferencedByAdoptedRelations':True,'allManifestSnapshotHashesMatch':True,'allAdoptedNumbersPresentInPrimaryBytes':True,'manifestEntries':len(manifest)})
print(len(updates),len(unresolved),len(manifest))
