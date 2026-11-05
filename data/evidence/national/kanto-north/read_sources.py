import json,pathlib,re,sys,urllib.parse
root=pathlib.Path(__file__).parent
m={r['url']:r for r in json.load(open(root/'manifest.json'))};cs=json.load(open('data/work/national-input/full.json'))['cards'];seen=set()
for c in cs:
 if not c['id'].startswith(sys.argv[1]):continue
 us=c.get('links') or []
 if not us:continue
 u=urllib.parse.urldefrag(us[-1])[0]
 if u in seen:continue
 seen.add(u);r=m.get(u)
 if not r or not r.get('snapshotPath'):continue
 p=pathlib.Path(r.get('snapshotPath','')).with_suffix('.txt')
 if not p.exists():continue
 lines=[l.strip() for l in p.read_text().splitlines() if l.strip()];ix=set()
 for i,l in enumerate(lines):
  if re.search(r'配布|配付|在庫|休止|休館|終了|時[0-9０-９]|[0-9０-９][:：][0-9０-９]',l):ix.update(range(max(0,i-2),min(len(lines),i+4)))
 print('\n###',c['id'],u, r.get('status'));print('\n'.join(lines[i] for i in sorted(ix))[:int(sys.argv[2]) if len(sys.argv)>2 else 5000])
