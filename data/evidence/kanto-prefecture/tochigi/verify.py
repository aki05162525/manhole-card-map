import json,pathlib,hashlib,sys,copy,subprocess,datetime
sys.path.insert(0,'tools/national');from assemble import assemble;from location_lifecycle import digest
P=pathlib.Path;root=P.cwd();E=P('data/evidence/kanto-prefecture/tochigi');N=P('data/national/kanto-prefecture/tochigi')
def sha(p):return hashlib.sha256(P(p).read_bytes()).hexdigest()
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
s=json.load(open(N/'selection-proposed.json'));u=json.load(open(N/'locations-proposed.json'))['updates'][0];s['locations']=[dict(path=str(N/'locations-proposed.json'),approved=[dict(facilityId=u['facilityId'],sha256=digest(u))])];save(N/'selection-proposed.json',s)
m=json.load(open('tools/national/manifest.json'));base,a=assemble(root,m);proposal=copy.deepcopy(m)
for k in ['locations','locationLifecycle']:proposal[k].extend(s[k])
new,na=assemble(root,proposal);assert base['relations']==new['relations'];bp={p['id']:p for p in base['places']};np={p['id']:p for p in new['places']};changed=[k for k in bp if bp[k]!=np[k]];assert changed==[u['facilityId']];assert not bp[u['facilityId']].get('coordinate');assert np[u['facilityId']]['coordinate']==u['coordinate']
inv=json.load(open(N/'inventory.json'));assert len(inv['rows'])==20
for p,h in inv['inputSHA256'].items():assert sha(p)==h
for fname in ['vector-inputs.json','kanuma-vector-inputs.json']:
 for r in json.load(open(E/fname)):assert sha(r['persistedPath'])==r['sha256']
# Search all unlocated identities for Tochigi municipalities, including omitted prefecture.
idx=json.load(open('data/national/issue57/remaining-index.json'));names=['宇都宮市','足利市','栃木市','佐野市','鹿沼市','日光市','小山市','真岡市','大田原市','矢板市','那須塩原市','さくら市','那須烏山市','下野市','上三川町','益子町','茂木町','市貝町','芳賀町','壬生町','野木町','塩谷町','高根沢町','那須町','那珂川町'];ids={r['facilityId'] for r in inv['rows']};extra=[r['facilityId'] for r in idx['facilities'] if any(n in r['address'] or n in r['name'] for n in names) and r['facilityId'] not in ids]
save(E/'validation.json',dict(schema=1,baseCommit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),asOf='2026-11-05',command='python3 -B data/evidence/kanto-prefecture/tochigi/verify.py',exitCode=0,scope='現manifest実assembleとメモリ内候補manifest比較。共有manifest未変更。',unlocatedBaseline=sum(not p.get('coordinate') for p in base['places']),unlocatedHypothetical=sum(not p.get('coordinate') for p in new['places']),changedPlaceIds=changed,unchangedRelations=True,municipalitySearchAdditionalCandidates=extra,municipalitySearchTerms=names,oldValue=bp[u['facilityId']],newHypotheticalValue=np[u['facilityId']],inputSHA256={**a['inputSHA256'],**{str(p):sha(p) for p in N.glob('*.json')}},tests='全suiteは通常commit hookの証跡へ。研究用計算であり新機能・不具合修正なし。',knownExecutionErrors=['調査用一時スクリプトでcombine_tiles入力schemaを誤りKeyError。tile/extent/features形式へ修正して成功。共通コード不具合ではない。','一時描画スクリプトでid重複TypeError。dict上書き方式へ修正して成功。','鹿沼局所描画原点を2回訂正。最終範囲をinspection.jsonへ記録。']))
print('PASS: 20 target hashes; 18 tile hashes; unchanged relations; hypothetical delta',changed,'extra municipal candidates',extra)
