import json,pathlib,re
import html
def totext(b):
 t=b.decode("utf-8",errors="replace")
 t=re.sub(r"<(script|style)\b[^>]*>.*?</\1>","",t,flags=re.S)
 return re.sub(r"\s+"," ",html.unescape(re.sub("<[^>]+>"," ",t)))
D=pathlib.Path(__file__).parent
records=json.load(open(D/'fetch-records.json'));targets=json.load(open(D/'fetch-targets.json'));ids=list(targets)
for n in [2,3,9,10,11,14,29,32,40,44,48,54,64,65,73,76,77,78,79,81,82]:
 print('\nINDEX',n)
 for r in records:
  if r['sourceUrl'] not in targets[ids[n]] or 'snapshotPath' not in r:continue
  b=pathlib.Path(r['snapshotPath']).read_bytes();t=totext(b)
  print(r['sourceUrl'],r['snapshotPath'])
  for m in list(re.finditer('配布場所|配布窓口|守衛室|警備室|庁舎|所在地|総合案内|上下水道課|お客様センター',t))[:12]:print(t[max(0,m.start()-40):m.end()+130])
