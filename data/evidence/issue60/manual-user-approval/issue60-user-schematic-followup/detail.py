exec(open('/tmp/issue60-user-schematic-followup/compare.py').read().split('inputs=[]')[0])
frames=json.load(open(O/'gsi-frames.json'))
for n,lat,lng in [(6,35.73251,139.22867),(11,35.25792,139.66228)]:
 f=frames[str(n)];x,y=xy(lat,lng,f['z'],f['x'],f['y']);im=Image.open(O/f'{n}-gsi.png');dr=ImageDraw.Draw(im);dr.ellipse((x-4,y-4,x+4,y+4),outline='red',width=1)
 if n==11:
  d=json.load(open(R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json'));t=d['rows'][0]['baseTile']
  for r in d['rows'][:3]:
   def tr(v):return (((t['x']+v[0]/4096)*4-f['x'])*256,((t['y']+v[1]/4096)*4-f['y'])*256)
   ring=r['feature']['geometry']['coordinates'][0];dr.line([tr(v) for v in ring],fill='yellow',width=1);a,b=tr(ring[0]);dr.text((a,b-12),str(r['feature']['sourceFeatureIndex']),fill='yellow')
 im.crop((int(x)-100,int(y)-100,int(x)+100,int(y)+100)).resize((800,800)).save(O/f'{n}-gsi-detail.png')
