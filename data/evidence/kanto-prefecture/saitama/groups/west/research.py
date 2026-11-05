import sys,json,time,hashlib,re
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import fetch_cached
E=Path('data/evidence/kanto-prefecture/saitama/groups/west');D=Path('data/work/kanto-prefecture/saitama/groups/west');N=Path('data/national/kanto-prefecture/saitama/groups/west')
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def fetch(fid,urls):
 records=json.loads((E/'retrievals.json').read_text()) if (E/'retrievals.json').exists() else []
 for u in urls:
  start=time.time();b,r=fetch_cached(u,D/'cache','west-2026-11-05');r.update(facilityId=fid,elapsedSeconds=time.time()-start);records.append(r);save(E/'retrievals.json',records);print(u,r['status'],r.get('rawPath'),flush=True)
def timing(fid,action):
 p=E/'timing.json';r=json.loads(p.read_text()) if p.exists() else [];r.append({'facilityId':fid,'action':action,'epoch':time.time()});save(p,r)
if __name__=='__main__':
 if sys.argv[1]=='fetch':fetch(sys.argv[2],sys.argv[3:])
 elif sys.argv[1]=='time':timing(sys.argv[2],sys.argv[3])
