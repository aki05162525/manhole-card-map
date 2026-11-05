import sys,json
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import fetch_cached
def acquisition_output(value):
 p=Path(value).resolve()
 allowed=(Path.cwd()/'data/work').resolve()
 if not p.is_relative_to(allowed):raise ValueError('new acquisition output must be beneath ignored data/work')
 import subprocess
 if subprocess.run(['git','check-ignore','-q',str(p)],check=False).returncode:raise ValueError('output must be git-ignored')
 p.mkdir(parents=True,exist_ok=True)
 return p

if len(sys.argv)!=4:raise SystemExit('usage: fetch.py IGNORED_OUTPUT NAME URL')
W=acquisition_output(sys.argv[1]);name,url=sys.argv[2:]
if Path(name).name!=name:raise ValueError('name must be a basename')
assert not (W/name).exists()
raw,r=fetch_cached(url,W/'cache','yachiyo-four-2026-11-06');r['key']=name;p=W/'retrievals.json';rs=json.loads(p.read_text()) if p.exists() else [];rs.append(r);p.write_text(json.dumps(rs,ensure_ascii=False,indent=2)+'\n')
if raw:(W/name).write_bytes(raw)
print(name,r['status'],r.get('sha256'),r.get('error'))
