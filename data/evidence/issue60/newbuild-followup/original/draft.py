from pathlib import Path
import numpy as np,json,math
from PIL import Image,ImageDraw
O=Path('/tmp/issue60-own-georef-newbuild')
inputs={35:dict(image='35-engineering-1.png',control=[([354,173],[657,620],'駅南階段先端'),([740,641],[826,782],'東側道路T字路'),([703,961],[810,897],'南東側道路屈曲')],check=[([705,208],[801,625],'東側道路北屈曲'),([592,588],[773,758],'東側大屋根建物北西角')],target=[415,435],outline=[[330,408],[480,378],[496,454],[345,482]]),43:dict(image='43-plan-north.png',control=[([491,565],[818,530],'既存いきいき南東角'),([168,562],[684,520],'既存いきいき南西角'),([615,1179],[852,739],'南東道路交差'),([94,1195],[650,741],'南西内部道路交差')],check=[([422,255],[807,425],'既存建物東側折れ'),([540,680],[847,552],'東道路既存区画境界')],target=[250,960],outline=[[120,835],[330,835],[330,1140],[190,1140],[190,1095],[120,1095]]),45:dict(image='45-official-plan.png',control=[([1123,121],[682,387],'北道路交差'),([945,648],[797,606],'東道路交差'),([320,650],[590,772],'南西進入口道路交差')],check=[([205,86],[428,618],'西側道路曲がり'),([722,657],[730,671],'南東道路途中')],target=[852,309],outline=[[715,175],[978,175],[1015,245],[925,479],[864,476],[735,295]])}
import shutil
shutil.copy('/tmp/issue60-recheck-north-final-nov6/45-official-plan.png',O/'45-official-plan.png')
for n,v in inputs.items():
 a=np.array([[*p,1] for p,q,l in v['control']]);b=np.array([q for p,q,l in v['control']]);m=np.linalg.lstsq(a,b,rcond=None)[0];print(n,'matrix',m.tolist(),'target',np.array([*v['target'],1])@m)
 for p,q,l in v['check']:print('check',l,np.array([*p,1])@m,'expected',q,'px distance',np.linalg.norm(np.array([*p,1])@m-q))
 im=Image.open(O/f'{n}-seamlessphoto.png');d=ImageDraw.Draw(im);poly=[tuple(np.array([*p,1])@m) for p in v['outline']];d.polygon(poly,outline='red',width=3);q=np.array([*v['target'],1])@m;d.ellipse((q[0]-5,q[1]-5,q[0]+5,q[1]+5),fill='red');im.save(O/f'{n}-draft.png')
(O/'georef-inputs.json').write_text(json.dumps(inputs,indent=2,ensure_ascii=False))
