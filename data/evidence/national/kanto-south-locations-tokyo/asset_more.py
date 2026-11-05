from research import *
from decisions import D
import csv,io
u='https://www.digitalservice.metro.tokyo.lg.jp/documents/d/digitalservice/toitsudb_202609';b=pathlib.Path(M[u]['snapshotPath']).read_bytes();rows=list(csv.DictReader(io.StringIO(b.decode('utf-8-sig'))))
for i in range(len(P)):
 if i not in D:print(i,P[i]['name'],P[i]['address'])
for r in rows:
 if any(k in r['台帳名称'] for k in ['荻外','産業セン','スポーツの森','下水道','アニメ','品川産業','レクリ','羽村市動物','飛鳥山','杉並会館','数馬','水道事務','日野市役所','五日市','観光','江東ポンプ']):print([r[k] for k in ['アセットDB番号','種別','台帳名称','所在（区市町村）','所在（町、字）','所在（地番）','所在（その他）','住居表示','緯度（世界測地系）','経度（世界測地系）']])
