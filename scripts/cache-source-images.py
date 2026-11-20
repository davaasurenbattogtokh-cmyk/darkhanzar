"""Cache publicly supplied source images unchanged for same-origin display."""
import concurrent.futures
import hashlib
import io
import json
import os
import httpx
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'public/data/unegui-darkhan.json'
DEST=ROOT/'public/imported/unegui'
DEST.mkdir(parents=True,exist_ok=True)
snapshot=json.loads(DATA.read_text())
urls=list(dict.fromkeys(src for item in snapshot['items'] for src in item['images']))
# Reuse HTTPS connections through the configured HTTPS proxy, preserving network routing.
client=httpx.Client(proxy=os.environ.get('HTTPS_PROXY'),trust_env=not bool(os.environ.get('HTTPS_PROXY')),timeout=httpx.Timeout(20.0,pool=60.0),limits=httpx.Limits(max_connections=6,max_keepalive_connections=6,keepalive_expiry=60),follow_redirects=True,headers={'User-Agent':'DarkhanzarResearch/1.0'})

def cache(url):
    stem=hashlib.sha256(url.encode()).hexdigest()[:24]
    existing=list(DEST.glob(stem+'.*'))
    if existing:
        return url, '/imported/unegui/'+existing[0].name, None
    try:
        response=client.get(url)
        response.raise_for_status()
        blob=response.content
        mime=response.headers.get('Content-Type','').split(';')[0]
        if len(blob)>8*1024*1024:
            raise ValueError('Image size exceeded limit')
        # Some source images are served as application/octet-stream. Validate
        # their actual bytes rather than trusting the HTTP Content-Type.
        with Image.open(io.BytesIO(blob)) as img:
            ext={'WEBP':'.webp','JPEG':'.jpg','PNG':'.png','GIF':'.gif','AVIF':'.avif'}.get(img.format)
            if not ext:raise ValueError('Unsupported image format')
            img.verify()
        path=DEST/(stem+ext)
        path.write_bytes(blob)
        return url,'/imported/unegui/'+path.name,None
    except Exception as error:
        return url,None,str(error)

mapping={}
errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    futures=[executor.submit(cache,url) for url in urls]
    for index,future in enumerate(concurrent.futures.as_completed(futures),1):
        url,local,error=future.result()
        if error:
            errors.append({'url':url,'error':error})
            if len(errors)<=5:print(json.dumps({'imageError':error,'url':url}),flush=True)
        else:mapping[url]=local
        if index%100==0 or index==len(urls):
            print(json.dumps({'completed':index,'total':len(urls),'errors':len(errors)}),flush=True)
client.close()
for item in snapshot['items']:
    item['localImages']=[mapping[src] for src in item['images'] if src in mapping]
snapshot['schemaVersion']=3
snapshot['imageStorage']={'mode':'same-origin-copy','uniqueSourceImages':len(urls),'cachedImages':len(mapping),'failedImages':errors,'notes':'Source bytes are copied unchanged; original image URL references are retained per ad.'}
DATA.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'adsWithImages':sum(bool(x['localImages']) for x in snapshot['items']),'cached':len(mapping),'errors':len(errors),'bytes':sum(p.stat().st_size for p in DEST.iterdir())}),flush=True)
