from research import *
for u in ['https://www.city.tsuchiura.lg.jp/map.php?code=192','https://www.city.hokota.lg.jp/map.php?type=0']:
 m=fetch(u);d=inspect(m);print(u,d['numeric'][:6])
for u in ['https://www.city.naka.lg.jp/map.php?code=42','https://www.city.tsuchiura.lg.jp/map.php?code=42','https://www.city.tsuchiura.lg.jp/map.php?code=204']:
 s=read(cache[u]);print(u,s[-2800:])
