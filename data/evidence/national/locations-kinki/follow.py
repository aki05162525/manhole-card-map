import research as r
idx=r.json.load(open(r.ROOT/'research-index.json'))
extra={35:['https://www.city.kyoto.lg.jp/suido/page/0000309702.html'],39:['https://www.city.maizuru.kyoto.jp/kyouiku/0000012192.html'],56:['https://www.town.kyotamba.kyoto.jp/kakukakarasagasu/somuka/gyomuannai/20/821.html'],57:['https://www.town.kyotamba.kyoto.jp/kakukakarasagasu/somuka/gyomuannai/20/821.html'],101:['https://www.city.habikino.lg.jp/map.html'],106:['https://www.city.settsu.osaka.jp/bamen/jougesui/jousuidou/5610.html'],107:['https://www.city.settsu.osaka.jp/bamen/jougesui/jousuidou/5610.html'],115:['https://www.city.shijonawate.lg.jp/page/3-6449.html'],116:['https://www.city.shijonawate.lg.jp/page/3-6449.html'],117:['https://www.city.katano.osaka.jp/docs/2011083000083/'],196:['https://www.town.sango.nara.jp/soshiki/15/14035.html'],197:['https://www.town.sango.nara.jp/soshiki/19/4579.html']}
extra.update({7:['https://www.town.toin.lg.jp/soshiki/1003/2/4414.html','https://www.town.toin.lg.jp/soshiki/1001/1/1/124.html'],8:['https://www.town.toin.lg.jp/soshiki/1003/2/4414.html'],132:['https://www.vill.chihayaakasaka.osaka.jp/sonsei/muranitsuite/1460.html'],133:['https://www.vill.chihayaakasaka.osaka.jp/sonsei/muranitsuite/1460.html'],202:['https://www.city.gobo.lg.jp/sosiki/somu/somu/tanto/gaiyou/1382685333034.html'],203:['https://www.city.gobo.lg.jp/sosiki/somu/somu/tanto/gaiyou/1382685333034.html']})
for i,x in enumerate(idx):
 x['followLinks']=[]
 for u in extra.get(i,[]):x['followLinks'].append({'url':u,'label':'公式施設案内の検索結果','from':'web search'})
 for link in x['links']:
  m=r.cache.get(link['url']);
  if not m:continue
  for label,v in r.links(m):
   if not v.startswith(('http://','https://')) or r.re.search('google|goo.gl|facebook|twitter|instagram|youtube|youtu.be|x.com|\.pdf|cgi-bin|inquiry|javascript',v):continue
   tt=[t for t in r.tokens(r.places[i]) if not t.endswith(('市','町','府','県')) and not t in ['上下水道課','総合案内','管理事務所']]
   if (any(t in label for t in tt) and len(label)<55) or (r.re.search('交通|アクセス|施設概要|施設紹介|ご利用案内|所在地|市役所案内|役場案内',label) and len(label)<30 and r.urllib.parse.urlparse(v).netloc==r.urllib.parse.urlparse(link['url']).netloc):
    if v not in x['sourceUrls'] and v not in [l['url'] for l in x['links']]:x['followLinks'].append({'url':v,'label':label,'from':link['url']})
 x['followLinks']=list({a['url']:a for a in x['followLinks']}.values())
r.save(r.ROOT/'research-index.json',idx)
urls=sorted({a['url'] for x in idx for a in x['followLinks']});print(len(urls),flush=True)
with r.concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(r.fetch,urls))
r.save(r.ROOT/'manifest.json',r.fresh)
