"""Append reviewed coordinates. No automatic approval by name matching."""
from research import *
D=ROOT/'decisions.json'
ds=json.load(open(D)) if D.exists() else []
def decision(prefix,url,lat,lng,locator,note,support=[]):
 ps=[p for p in targets if p['id'].split('-')[-1].startswith(prefix)]
 assert len(ps)==1,prefix
 d={'facilityId':ps[0]['id'],'sourceUrl':url,'lat':lat,'lng':lng,'sourceLocator':locator,'finding':note,'supportUrls':support}
 global ds
 ds=[x for x in ds if x['facilityId']!=d['facilityId']]+[d]
def save():D.write_text(json.dumps(ds,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':save()
