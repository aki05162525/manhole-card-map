import research as r,re,pathlib,subprocess
s=pathlib.Path(r.read(r.E/'nakama-fetch.json')[0]['snapshotPath']).read_text();rows=[]
for alt,src in re.findall(r'<img alt="([^"]+)" src="(/uploaded/[^"]+)"',s):
 x=r.fetch(('https://www.city.nakama.lg.jp'+src,[{'facilityId':'facility:kyushu-e7eae1c92a37ac5f0745','purpose':alt}]))
 if x.get('status')==200:
  out=str(r.E/(pathlib.Path(x['snapshotPath']).stem+'-ocr'));subprocess.run(['tesseract',x['snapshotPath'],out,'-l','jpn'],capture_output=True);x['ocrPath']=out+'.txt';print(alt,pathlib.Path(out+'.txt').read_text())
 rows.append(x)
r.save(r.E/'nakama-images-fetches.json',rows)
