from research import *
# Some early concurrent inspection writers replaced the manifest. Preserve original
# records; recover only missing URL/bytes associations from per-URL inspections.
urls={p.read_text().splitlines()[0][4:] for p in ROOT.glob('*.inspection.txt')}
urls|={r['url'] for r in json.load(open(ROOT/'directory-results.json'))}
for u in sorted(urls):
 if u in CACHE:continue
 p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html')
 if not p.exists():continue
 m={'url':u,'snapshotPath':str(p),'snapshotSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'snapshotSavedAt':datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),'fetchedAt':None,'provenanceNote':'取得成功後に原本を書き込んだファイル時刻。初期manifestの競合で取得開始時刻・HTTP metadataが欠落したため復元しない。再取得は行わず保存原本を再利用。'}
 MAN.append(m);CACHE[u]=m
save()
