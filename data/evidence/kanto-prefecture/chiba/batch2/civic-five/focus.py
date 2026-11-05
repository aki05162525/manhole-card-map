from pathlib import Path
import json,sys,re,math
import cairosvg
from shapely.geometry import shape
sys.path.insert(0,'tools/national');from research_common import render_svg
W=Path(__file__).resolve().parent;group=sys.argv[1];box=list(map(float,sys.argv[2:6]));x,y,w,h=box;c=json.loads((W/f'{group}-combined.json').read_text());svg=render_svg(c);svg=re.sub(r'viewBox="[^"]+"',f'viewBox="{x} {y} {w} {h}"',svg);svg=svg.replace('</title>',f'</title><rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white"/>',1)
labels=[]
for f in c['features']:
 if f['sourceLayer']!='BldA':continue
 g=shape(f['geometry']);p=g.representative_point()
 if x<p.x<x+w and y<p.y<y+h and g.area>2500:labels.append(f'<text x="{p.x}" y="{p.y}" font-size="22" fill="red">{f["layerFeatureIndex"]}</text>')
svg=svg.replace('</svg>',''.join(labels)+'</svg>');(W/f'{group}-labelled.svg').write_text(svg);cairosvg.svg2png(bytestring=svg.encode(),write_to=str(W/f'{group}-labelled.png'),output_width=1600,output_height=1400)
