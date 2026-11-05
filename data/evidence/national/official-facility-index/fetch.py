#!/usr/bin/env python3
"""Public-source byte-preserving fetch; never retries denied requests."""
import datetime,hashlib,json,pathlib,urllib.request,urllib.error,sys
ROOT=pathlib.Path(__file__).resolve().parents[4]
E=ROOT/'data/evidence/national/official-facility-index'
W=ROOT/'data/work/official-facility-index'
def fetch(url, name, large=False):
    target=(W if large else E)/name
    meta=E/(name+'.source.json')
    expected=None
    if meta.exists():
        m=json.loads(meta.read_text())
        if m.get('status')!=200: raise RuntimeError('Previously unavailable: '+url)
        expected=m['sha256']
        if target.exists():
            if hashlib.sha256(target.read_bytes()).hexdigest()!=expected:raise ValueError('Local source hash mismatch: '+str(target))
            return target
    m={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'path':str(target.relative_to(ROOT))}
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ManholeCardMap-public-facility-research/1.0'}),timeout=45) as r:
            b=r.read()
            if expected and hashlib.sha256(b).hexdigest()!=expected:raise ValueError('Remote source changed; original frozen bytes required: '+url)
            m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type'),lastModified=r.headers.get('Last-Modified'),bytes=len(b),sha256=hashlib.sha256(b).hexdigest());target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b)
    except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError) as e:
        m.update(status=getattr(e,'code',None),error=str(e));meta.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');raise
    meta.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');return target
if __name__=='__main__': print(fetch(sys.argv[1],sys.argv[2],len(sys.argv)>3))
