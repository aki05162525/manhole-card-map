import json,pathlib,sys
m=json.load(open('data/evidence/national/kanto-south/manifest.json'))
for r in m:
 if any(s in r['url'] for s in sys.argv[1:]) and r.get('status')==200:
  print('\nURL',r['url']);print(pathlib.Path(r['snapshotPath']).with_suffix('.txt').read_text()[-22000:])
