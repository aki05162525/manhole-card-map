from pathlib import Path
import json,shutil,hashlib,zipfile
O=Path('/tmp/issue60-own-georef-newbuild');R=Path('/home/akihiro/personal/manhole-card-map')
a=json.loads((O/'georef-inputs.json').read_text())
a['45']['method']='similarity';a['45']['rejectedControl']=[a['45']['control'].pop()];a['45']['rejectedChecks']=a['45']['check'];a['45']['check']=[[[345,75],[432,625],'北西道路の屈曲（未使用）'],[[349,650],[608,790],'南西アクセス路と南東道路の接続（未使用）']]
a['35']['method']='affine';a['43']['method']='affine'
a['35']['reference']='35-seamlessphoto.png';a['43']['reference']='43-std.png';a['45']['reference']='45-std.png'
a['27']=dict(method='worldfile',image='27-2024.png',target=[381,1049],outline=[[369,1033],[396,1047],[385,1071],[359,1056]],worldfile=[.5,0,0,-.5,-53092.4375,15354.4375],assumedEPSG=6677,check=[[[390,520],[652,235],'北側幹線道路と旧南北道の交点'],[[692,438],[975,177],'北側幹線道路と東側旧農道の交点']],reference='27-seamlessphoto.png')
a['42']=dict(method='xyz_pixel',image='42-seamlessphoto.png',reference='42-seamlessphoto.png',target=[809,562],outline=[[798,554],[822,562],[819,570],[794,561]],check=[],photoIdentification='2025広報さのPDF6印刷7の矢印、校舎南面東寄り独立小棟。2023写真では明るい小屋根・南側デッキ。BldA9はさらに東。')
(O/'georef-inputs.json').write_text(json.dumps(a,indent=2,ensure_ascii=False))
# Keep only task-relevant inherited references, without modifying originals.
paths=[R/'REVIEW.md',R/'AGENTS.md',R/'data/evidence/issue60/human-answers-20261106/receipt.json',R/'data/national/issue76/remaining-index-after-twelve.json',Path('/tmp/issue60-recheck-saitama-nov6/report.md'),Path('/tmp/issue60-recheck-saitama-nov6/assessment.json'),Path('/tmp/issue60-recheck-saitama-nov6/user-report.json'),Path('/tmp/issue60-recheck-saitama-nov6/additional-retrievals.json'),Path('/tmp/issue60-recheck-saitama-nov6/raw/27-area.png'),Path('/tmp/issue60-recheck-saitama-nov6/raw/35-exterior.jpg'),Path('/tmp/issue60-recheck-north-final-nov6/report.md'),Path('/tmp/issue60-recheck-north-final-nov6/assessment.json'),Path('/tmp/issue60-recheck-north-final-nov6/answers.json'),Path('/tmp/issue60-recheck-north-final-nov6/43-official-plan.png'),Path('/tmp/issue60-recheck-north-final-nov6/45-official-plan.png'),R/'data/evidence/kanto-prefecture/gunma/source-conditions.json',R/'data/evidence/location-batch1/gsi-terms.html',R/'data/evidence/kanto-prefecture/tochigi/batch2/group-east/origami-card.pdf-retrieval.json',R/'data/evidence/kanto-prefecture/tochigi/batch2/group-east/sano-observation.json']
(O/'inherited').mkdir(exist_ok=True);rows=[]
for i,p in enumerate(paths):
 if not p.exists():continue
 dest=O/'inherited'/f'{i:02d}-{p.name}';shutil.copyfile(p,dest);rows.append(dict(originalPath=str(p),path=str(dest),sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
(O/'inherited-inputs.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False))
receipt=json.loads((R/'data/evidence/issue60/human-answers-20261106/receipt.json').read_text());ids={str(x['number']):x['facilityId'] for x in receipt['answers'] if str(x['number']) in a};(O/'ids.json').write_text(json.dumps(ids,indent=2))
z=zipfile.ZipFile(O/'raw/27-worldfiles.zip');(O/'raw/27-2203.tfw').write_bytes(z.read(next(n for n in z.namelist() if n.endswith('2203.tfw'))))
