from research import *
add=json.load(open(ROOT/'additional.json'))
for line in sys.stdin:
 if not line.strip():continue
 prefix,u=line.strip().split(' ',1)
 for p in targets:
  if p['id'].split('-')[-1].startswith(prefix) and u not in add[p['id']]:add[p['id']].append(u)
(ROOT/'additional.json').write_text(json.dumps(add,ensure_ascii=False,indent=2))
collect([u for us in add.values() for u in us]);report()
