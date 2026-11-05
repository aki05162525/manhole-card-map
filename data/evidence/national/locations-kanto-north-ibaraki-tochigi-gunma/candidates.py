from research import *
seen=set()
for m in old+manifest:
 if m['url'] in seen:continue
 seen.add(m['url']);s=read(m)
 hits=[]
 for mt in re.finditer(r'(?:latlng\s*:\s*\[|["\x27]?lat["\x27]?\s*[:=]|["\x27]?latitude["\x27]?\s*[:=]|position\s*:\s*new google.maps.LatLng\()',s,re.I):
  v=s[mt.start():mt.start()+500].replace('\n',' ')
  if re.search(r'3[4567]\.\d{3,}',v[:100]):hits.append(v)
 if hits:print(m['url'],'\n'+'\n'.join(hits))
