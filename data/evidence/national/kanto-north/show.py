import research as R,json,re,sys
for r in json.load(open(R.MAN)):
 if not any(k in r['url'] for k in sys.argv[1:]) or not r.get('snapshotPath'):continue
 p=R.pathlib.Path(r['snapshotPath']).with_suffix('.txt')
 if not p.exists():continue
 t=p.read_text();ls=[l.strip() for l in t.splitlines() if l.strip()];ix=set()
 for i,l in enumerate(ls):
  if re.search('配[布付]|在庫|休[止館業]|終了|[0-9０-９][:：時]',l):ix.update(range(max(0,i-2),min(len(ls),i+6)))
 print('\n###',r['url']);print('\n'.join(ls[i] for i in sorted(ix))[:6500])
