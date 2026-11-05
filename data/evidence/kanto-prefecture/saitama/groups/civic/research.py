import sys,json,time,hashlib,re
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import fetch_cached
N=Path('data/national/kanto-prefecture/saitama/groups/civic');E=Path('data/evidence/kanto-prefecture/saitama/groups/civic');W=Path('data/work/kanto-prefecture/saitama/groups/civic')
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def action(fid,urls):
 p=E/'retrievals.json';rs=json.loads(p.read_text()) if p.exists() else []
 for url in urls:
  t=time.time();b,r=fetch_cached(url,W/'cache','civic-2026-11-05',timeout=25);r.update(facilityId=fid,elapsedSeconds=time.time()-t);rs.append(r);save(p,rs);print(url,r['status'],r.get('rawPath'),flush=True)
  if b and ('html' in r.get('contentType','') or b.lstrip().startswith(b'<')):
   s=b.decode('utf-8',errors='replace');s=re.sub(r'<script.*?</script>','',s,flags=re.S);s=re.sub(r'<style.*?</style>','',s,flags=re.S);s=re.sub('<[^>]+>',' ',s);s=re.sub(r'\s+',' ',s);(W/(r['sha256']+'.txt')).write_text(s)
if __name__=='__main__':action(sys.argv[1],sys.argv[2:])
