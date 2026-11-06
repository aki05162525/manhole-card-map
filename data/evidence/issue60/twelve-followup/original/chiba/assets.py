exec(open('/tmp/issue60-recheck-chiba-nov6/fetch.py').read().split('r=list(')[0])
urls={'togane-map.jpg':'https://minorinosato-togane.com/wp-content/uploads/2022/06/8b03bdc726d38d56a0b10532b460e036.jpg','togane-air.jpg':'https://minorinosato-togane.com/wp-content/uploads/2022/06/c2b5a382bf3a1abf47474fd97a785043.jpg','hall-plan.pdf':'https://www.city.sodegaura.lg.jp/uploaded/attachment/45262.pdf','hall-photo.png':'https://www.city.sodegaura.lg.jp/uploaded/image/42655.png','tateyama-plan.pdf':'https://www.city.tateyama.chiba.jp/files/300380282.pdf'}
records=[]
for k,u in urls.items():
 r=requests.get(u,timeout=40); (out/k).write_bytes(r.content);records.append(dict(path=k,url=u,sha256=hashlib.sha256(r.content).hexdigest(),status=r.status_code,fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()))
(out/'asset-retrievals.json').write_text(json.dumps(records,indent=2))
