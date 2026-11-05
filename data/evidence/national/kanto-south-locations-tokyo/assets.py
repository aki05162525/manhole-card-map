from research import *
import csv,io
u='https://www.digitalservice.metro.tokyo.lg.jp/documents/d/digitalservice/toitsudb_202609';r=fetch(u);write(ROOT/'manifest.json',new);b=pathlib.Path(r['snapshotPath']).read_bytes()
try:t=b.decode('utf-8-sig')
except:t=b.decode('cp932')
rows=list(csv.reader(io.StringIO(t)));print(rows[:2]);matches=[x for x in rows if any(k in str(x) for k in ['虹の下水','旧三河島','荻外荘','浮間公園','野方ふれあい','歴史民俗資料館','下水道館','日の出町役場','片町文化','郷土博物館','第二庁舎','総合レクリ','大泉図書','下笹目'])];write(ROOT/'asset-matches.json',matches);print(*matches,sep='\n')
