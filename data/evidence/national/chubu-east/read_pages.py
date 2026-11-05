import research as r,sys,re
from pathlib import Path
for m in r.manifest:
 if not any(x in m['url'] for x in sys.argv[1:]) or m.get('status')!=200:continue
 s=r.parse(Path(m['snapshotPath']).read_bytes()).text()
 # Main content candidate window; this tool prints text only, never approves.
 a=s.find('配布場所');a=a if a>=0 else s.find('配布');a=max(0,a-250)
 print('\nURL',m['url'],'\n',s[a:a+6500])
