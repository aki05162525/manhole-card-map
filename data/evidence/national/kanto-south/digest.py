import json,pathlib,sys,re
R=pathlib.Path('data/evidence/national/kanto-south');m={x['url']:x for x in json.load(open(R/'manifest.json'))};d=json.load(open('data/work/national-input/full.json'));seen=set()
for c in d['cards']:
 if not any(c['id'].startswith(a) for a in sys.argv[1:]):continue
 urls=c.get('links') or [];u=urls[-1] if urls else ''
 if u in seen:continue
 seen.add(u);print('\n###',c['id'],c['city'],u)
 r=m.get(u,{});print('FETCH',r.get('status',r.get('error','pending')))
 if r.get('status')!=200:continue
 t=pathlib.Path(r['snapshotPath']).with_suffix('.txt').read_text();
 for start in ('ここから本文です。','本文ここから'):
  if start in t:t=t.split(start,1)[1]
 for end in ('このページに関するお問い合わせ','この記事に関するお問い合わせ先','このページについてのお問い合わせ','この情報はお役に立ちましたか？'):
  t=t.split(end,1)[0]
 ls=t.splitlines();idx=[i for i,l in enumerate(ls) if re.search('配布|配付|在庫|休止|終了|マンホールカード',l)]
 inds=set()
 for i in idx:
  inds.update(range(max(0,i-2),min(len(ls),i+9)))
 print('\n'.join(ls[i] for i in sorted(inds))[:10000])
