import json,re,pathlib,html,sys
rs=json.load(open('data/evidence/issue7/south-kanto/fetch-records.json'))
for r in rs:
 if r.get('status')==200 and any(k in r['url'] for k in sys.argv[1:]):
  t=pathlib.Path(r['snapshotPath']).read_bytes().decode('utf8',errors='replace')
  t=re.sub(r'<(script|style)\b.*?</\1>','',t,flags=re.S)
  t=html.unescape(re.sub('<[^>]*>',' ',t))
  t=re.sub(r'\s+',' ',t)
  print(r['url'],r['snapshotPath']);print(t[-10000:])
