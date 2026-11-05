import research as r
import re,json,hashlib
from pathlib import Path
src=Path('/tmp/gkp-current-design.html');raw=src.read_bytes();dest=r.ROOT/'gkp-current-supplied.html'
dest.write_bytes(raw)
rows={}
for match in re.finditer(br'<tr\b[^>]*>.*?</tr>',raw,re.S|re.I):
 b=match[0];im=re.search(br'/mhc/(\d\d-\d\d\d-[A-Z]-?\d+)\.(?:jpg|png)',b,re.I)
 if not im:continue
 s=im[1].decode();m=re.match(r'(\d\d-\d\d\d)-([A-Z])-?(\d+)',s);cid=m[1]+'-'+m[2]+m[3].zfill(3)
 if not ('15'<=cid[:2]<='20'):continue
 cells=re.findall(br'<td\b[^>]*>(.*?)</td>',b,re.S|re.I)
 rows[cid]={'cardId':cid,'byteOffset':match.start(),'cells':[r.parse(v).text().splitlines() for v in cells],'links':r.parse(b).links}
(r.ROOT/'gkp-rows.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
(r.ROOT/'gkp-source.json').write_text(json.dumps({'url':'https://www.gk-p.jp/mhcard/?pref=zenkoku','snapshotPath':str(dest),'sha256':hashlib.sha256(raw).hexdigest(),'provenance':'ユーザー指定の統合担当取得済み /tmp/gkp-current-design.html を原本bytesのままコピー。取得日はユーザー提示2026-11-05。取得時刻はこの担当では不明で、再取得していない。','actorType':'ai'},ensure_ascii=False,indent=2)+'\n')
print(len(rows),'rows')
