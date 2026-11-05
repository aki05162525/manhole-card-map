#!/usr/bin/env python3
"""Apply only explicit, source-bound manual reviews; never score-based promotion."""
import hashlib,json,subprocess
from html.parser import HTMLParser
from fetch import E,ROOT
class Text(HTMLParser):
    def __init__(self):super().__init__();self.parts=[]
    def handle_data(self,d):self.parts.append(d)
def source(name, assertions):
    m=json.loads((E/(name+'.source.json')).read_text());p=ROOT/m['path'];b=p.read_bytes()
    assert hashlib.sha256(b).hexdigest()==m['sha256']
    if name.endswith('.pdf'):s=subprocess.check_output(['pdftotext','-layout',str(p),'-']).decode()
    else:
        parser=Text();parser.feed(b.decode('utf-8'));s=' '.join(parser.parts)
    for term in assertions:assert term in s,(name,term)
    return {'sourceUrl':m['url'],'snapshotPath':m['path'],'snapshotSHA256':m['sha256'],'fetchedAt':m['fetchedAt']}
def main():
    p=ROOT/'data/national/location-updates/official-facility-index.json';d=json.loads(p.read_text());approved=[]
    # Idempotent: keep candidate provenance even after promotion in the update record.
    pool=d['candidates']+[u['candidate'] for u in d['updates']]
    for r in json.loads((E/'reviews.json').read_text()):
        matches=[c for c in pool if c['facilityId']==r['facilityId'] and c['datasetPoint']['name']==r['datasetName'] and c['datasetPoint']['dataset']=='P05-22']
        assert len(matches)==1,(r['facilityId'],len(matches));c=matches[0];assert c['addressExactNormalized']
        f=source(r['facilityPage'],r['facilityAssertions']);s=source(r['distributionPage'],r['distributionAssertions'])
        point=c['datasetPoint'];coord=point['coordinate'];assert coord['crs']=='EPSG:6668'
        approved.append({'facilityId':r['facilityId'],'coordinate':{'status':'confirmed','lat':coord['lat'],'lng':coord['lng'],'source':'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html','reason':'国土交通省P05建物地点を現行公式施設名・配布施設住所と手動突合。建物代表点であり窓口・階・入口の実測点ではない。','review':'ai / 2026-11-05'},'evidence':{**f,'sourceLocator':r['locator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':r['review']},'distributionEvidence':s,'datasetEvidence':{'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':'data/work/official-facility-index/P05-22_GML.zip','snapshotSHA256':json.loads((E/'P05-22_GML.zip.source.json').read_text())['sha256'],'sourceLocator':point['locator'],'memberSHA256':point['memberSHA256'],'referenceDate':'2022-04','license':'CC BY 4.0','attribution':'国土交通省 国土数値情報（市町村役場等及び公的集会施設）2022年版を加工','class':point['class'],'sourceCRS':'EPSG:6668 (JGD2011)','coordinateHandling':'緯度経度の値を保持。GSI FAQ・MLIT参照系仕様の実用上の世界測地系同等性を適用。測地・地殻変動補正ではない。センチメートル精度を主張しない。','precision':'施設建物代表点。P05仕様書8章の建物外周内全数検査に基づく。','currentPageDate':r['currentPageDate']},'candidate':c})
    ids={u['facilityId'] for u in approved};d['updates']=approved;d['candidates']=[c for c in pool if c['facilityId'] not in ids]
    d['summary']['confirmedUpdates']=len(approved);d['summary']['remainingCandidateFacilities']=len({c['facilityId'] for c in d['candidates']})
    p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print('Explicitly reviewed updates:',len(approved))
if __name__=='__main__':main()
