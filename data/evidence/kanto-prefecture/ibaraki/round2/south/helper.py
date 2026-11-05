from pathlib import Path
import sys,json,datetime,hashlib
sys.path.insert(0,'tools/national')
from research_common import fetch_cached
D=Path('data/work/kanto-ibaraki/round2/south');E=Path('data/evidence/kanto-prefecture/ibaraki/round2/south')
def save(name,obj): (E/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def timing(fid,action):
 p=E/'timing.json';j=json.loads(p.read_text()) if p.exists() else []
 j.append(dict(facilityId=fid,action=action,at=datetime.datetime.now(datetime.timezone.utc).isoformat()));save('timing.json',j)
def fetch(label,url):
 raw,r=fetch_cached(url,D/'cache','south-round2-2026-11-05');r['label']=label;p=E/'retrievals.json';j=json.loads(p.read_text()) if p.exists() else [];j.append(r);save('retrievals.json',j)
 if raw:(D/label).write_bytes(raw)
 print(label,r['status'],r.get('sha256'));return raw
if __name__=='__main__':
 if sys.argv[1]=='time':timing(sys.argv[2],sys.argv[3])
 else:fetch(sys.argv[1],sys.argv[2])
