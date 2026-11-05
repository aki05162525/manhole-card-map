from research import *
import sys
p=ROOT/'extra-queue.json';d=json.load(open(p));a=json.loads(sys.stdin.read())
for k,v in a.items():d[k]=list(dict.fromkeys(d.get(k,[])+v))
dump('extra-queue.json',d)
