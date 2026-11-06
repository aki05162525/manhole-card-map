import json,hashlib,shutil,copy
from pathlib import Path
root=Path.cwd(); base=Path('data/evidence/issue60/human-answers-20261106'); dest=base/'round2'; dest.mkdir(exist_ok=True)
def read(p):return json.loads(Path(p).read_text())
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
# Keep child research records byte-for-byte; prepare a separate, review-bound normalized input.
for group in ['tokyo','saitama','other']:
 d=dest/group;d.mkdir(exist_ok=True)
 for p in Path('/tmp/issue60-round2-'+group).iterdir():
  if p.suffix in ['.json','.md','.py']:shutil.copyfile(p,d/p.name)
receipt={r['facilityId']:r for r in read(base/'receipt.json')['answers']}
allrows=[];updates=[]
for group,name in [('tokyo','candidate.json'),('saitama','candidate-updates.json'),('other','locations-proposed.json')]:
 raw=read(dest/group/'assessment.json');rows=raw['outcomes']
 candidates={r['facilityId']:copy.deepcopy(r) for r in read(dest/group/name)['updates']}
 for row in rows:
  r=copy.deepcopy(row);fid=r['facilityId'];r['county']=receipt[fid]['county'];r['number']=receipt[fid]['number']
  r['researchAssessmentPath']=str(dest/group/'assessment.json')
  if r['recommendation']=='propose':
   c=candidates[fid]
   for k,v in c['evidence'].items():
    if isinstance(v,str):c['evidence'][k]=v.replace('/tmp/issue60-round2-'+group,str(dest/group))
   if r['number']==40:
    ev={'schema':1,'coordinate':c['coordinate'],'coordinateOrigin':str(base/'direct-map-confirmation.json')+'#/corrections/1','buildingLayoutURL':'https://www.city.shiraoka.lg.jp/material/images/group/1/kasetu_atm.jpg','buildingLayoutSHA256':c['evidence']['snapshotSHA256'],'layoutMeaning':'はぴす東、旧本庁舎南東、来庁者駐車場南の水色仮設棟。図から座標を測量したものではない。','coordinateReuseConditions':'直接転記点の利用条件は独立レビューに明示。GSI由来ではない。'}
    ep=dest/'shiraoka-position-evidence.json';write(ep,ev)
    c['evidence']['snapshotPath']=str(ep);c['evidence']['snapshotSHA256']=hashlib.sha256(ep.read_bytes()).hexdigest()
    r['adoptionMethod']='利用者が地図上で直接指定した座標を、市公式配置図・入居案内と照合。国土地理院ベクトルタイル由来の座標ではない。'
   r['sourceLocationPath']=str(dest/'locations-proposed.json');r['sourceLocationSHA256']=digest(c)
   r.setdefault('adoptionMethod','国土地理院最適化ベクトルタイルの保存外形から建物代表点を計算。利用者の建物直接指定を既存資料との対応の補完に使用。')
   updates.append(c)
  allrows.append(r)
assert len(allrows)==47 and len({r['facilityId'] for r in allrows})==47
assert len(updates)==16,len(updates)
write(dest/'locations-proposed.json',{'schema':1,'updates':updates})
write(dest/'assessment.json',{'schema':1,'scope':'Issue60 human followup; independent approval pending','outcomes':sorted(allrows,key=lambda r:r['number']),'summary':{'assessed':47,'propose':16,'hold':31,'approved':0}})
common=read('data/national/issue76/saitama/review-inputs.json')['common']
write(dest/'review-inputs.json',{'schema':1,'assessmentPath':str(dest/'assessment.json'),'assessmentSHA256':digest(sorted(allrows,key=lambda r:r['number'])),'locationsPath':str(dest/'locations-proposed.json'),'locationsSHA256':hashlib.sha256((dest/'locations-proposed.json').read_bytes()).hexdigest(),'common':common,'commonSHA256':digest(common),'humanConfirmationPath':str(base/'direct-map-confirmation.json'),'humanConfirmationSHA256':hashlib.sha256((base/'direct-map-confirmation.json').read_bytes()).hexdigest(),'coordinateSourceNotes':str(base/'coordinate-source-notes.json')})
for r in allrows:
 if r['recommendation']=='propose':
  c=next(c for c in updates if c['facilityId']==r['facilityId']);assert digest(c)==r['sourceLocationSHA256']
  ep=root/c['evidence']['snapshotPath'];assert ep.is_file(),ep;assert hashlib.sha256(ep.read_bytes()).hexdigest()==c['evidence']['snapshotSHA256'],ep
print('47 covered, 16 candidate hashes and snapshot hashes matched; manifest unchanged.')
