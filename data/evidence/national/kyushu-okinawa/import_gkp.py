from research import *
src=Path('/tmp/gkp-current-design.html');b=src.read_bytes();(ROOT/'gkp-rows').mkdir(exist_ok=True);records=[]
for row in re.findall(br'<tr\b[^>]*>.*?</tr>',b,re.S|re.I):
 m=re.search(br'/mhc/((?:40|41|42|43|44|45|46|47)-\d{3}-[A-Z])',row)
 if not m:continue
 cid=m[1].decode()+'001';p=ROOT/'gkp-rows'/f'{cid}.html';p.write_bytes(row)
 records.append({'cardId':cid,'sourceUrl':'https://www.gk-p.jp/mhcard/','snapshotPath':str(p),'snapshotSHA256':hashlib.sha256(row).hexdigest(),'sourceLocator':'tr containing image '+m[1].decode(),'importedFrom':str(src),'parentSHA256':hashlib.sha256(b).hexdigest(),'parentAcquiredDate':'2026-11-05','importedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'note':'統合担当の保存済み原本からバイト列を切出し。地域班は再取得していない。取得時刻は親manifestを参照。'})
(ROOT/'gkp-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
assert len(records)==120
