"""Bounded Issue57 official source acquisition; raw stays in ignored work."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools/national'))
from research_common import fetch_cached

E = Path(__file__).resolve().parent
W = ROOT / 'data/work/issue57/pilot'
if (E/'retrievals.json').exists():
    raise SystemExit('Recorded pilot acquisition exists; use a new evidence directory for another attempt.')
SOURCES = [
 ('shiroi-distribution.html','shiroi','https://www.city.shiroi.chiba.jp/soshiki/kankyo/k03/sui003/sui009/sui010/1532075261217.html'),
 ('shiroi-offices.html','shiroi','https://www.city.shiroi.chiba.jp/shisetsu/chosha/8201.html'),
 ('nakatsugawa-location.png','nakatsugawa','https://www.city.nakatsugawa.lg.jp/material/images/group/128/hitomachi_ichizu.png'),
 ('shiroi-construction.html','shiroi','https://www.city.shiroi.chiba.jp/soshiki/somu/s04/zai001/keikaku/kke005/1460442818177.html'),
 ('shiroi-drawings.pdf','shiroi','https://www.city.shiroi.chiba.jp/material/files/group/23/zumenn.pdf'),
 ('atami.html','atami','https://www.city.atami.lg.jp/shisei/soshiki/1001632/1001547.html'),
 ('atami-layout.jpg','atami','https://www.city.atami.lg.jp/_res/projects/default_project/_page_/001/001/547/2098_863.jpg'),
 ('atami-distribution.html','atami','https://www.city.atami.lg.jp/kurashi/suido/1000884/1011837/1016443.html'),
 ('nakatsugawa-floor.html','nakatsugawa','https://www.city.nakatsugawa.lg.jp/shisei/cityhall/23624.html'),
 ('nakatsugawa-layout.jpg','nakatsugawa','https://www.city.nakatsugawa.lg.jp/material/images/group/1/floormap_hitomachiterrace.jpg'),
 ('nakatsugawa-access.html','nakatsugawa','https://www.city.nakatsugawa.lg.jp/soshikikarasagasu/hitomachi/access/22795.html'),
 ('nakatsugawa-distribution.html','nakatsugawa','https://www.city.nakatsugawa.lg.jp/kanko/bunka/taishi/39776.html'),
]
records=[]
for key, group, url in SOURCES:
 start=time.monotonic()
 raw, record=fetch_cached(url,W/'cache','issue57-pilot-2026-11-05',timeout=30)
 record.update({'key':key,'group':group,'elapsedSeconds':round(time.monotonic()-start,6),'redistribution':'原本全文の再配布未確認。ignored workのみ。'})
 for field in ('rawPath','responseRawPath'):
  if record.get(field):record[field]=str(Path(record[field]).relative_to(ROOT))
 if raw is not None:
  (W/key).write_bytes(raw)
  record['inspectionPath']=str((W/key).relative_to(ROOT))
 records.append(record)
 (E/'retrievals.json').write_text(json.dumps({'schema':1,'records':records},ensure_ascii=False,indent=2)+'\n')
 print(key,record['status'],record['elapsedSeconds'],flush=True)
