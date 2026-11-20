"""One-off factual link index from public listing pages, never the private API.

Source image URL references are included; no seller profiles, phone numbers, full descriptions or image files are exported.
Run explicitly; there is no background scraper or automatic publication.
"""
import argparse
import csv
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from lxml import html

ORIGIN = 'https://www.unegui.mn'
ROOT = ORIGIN + '/search/darhan-uul/'
CATEGORY_IDS = {1720:'property',1816:'cars',3664:'fashion',1724:'jobs',1745:'kids',1727:'computers',1726:'phones',3663:'electronics',3666:'home',3711:'equipment',2451:'hobby',4049:'health',1725:'services'}

def walk(value):
    if isinstance(value, dict):
        if 'location_count' in value and isinstance(value.get('adverts'), list):
            yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)

def parse_public_page(body):
    doc = html.fromstring(body)
    chunks = []
    for script in doc.xpath('//script/text()'):
        if script.startswith('self.__next_f.push('):
            try:
                chunk = json.loads(script[len('self.__next_f.push('):-1])
                if len(chunk)>1 and isinstance(chunk[1], str):
                    chunks.append(chunk[1])
            except (ValueError, TypeError):
                continue
    for line in ''.join(chunks).splitlines():
        try:
            _, encoded = line.split(':',1)
            value = json.loads(encoded)
        except (ValueError, TypeError):
            continue
        for data in walk(value):
            if data.get('location_ids') == [457]:
                return doc, data
    raise ValueError('Public listing data for Darkhan-Uul was not found; stop, do not guess.')

def source_images(ad):
    def safe(value):
        if not isinstance(value,str):
            return None
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme == 'https' and parsed.hostname in {'cdn1.unegui.mn','cdn2.unegui.mn','www.unegui.mn'} and parsed.path.startswith('/media/') and not parsed.username:
            return value
        return None
    images = list(dict.fromkeys(url for value in ad.get('images',[]) if (url:=safe(value))))
    thumbnail = safe(ad.get('first_thumb'))
    if not images and thumbnail:
        images=[thumbnail]
    return {'thumbnail':thumbnail or (images[0] if images else None),'images':images,'imageCount':len(images)}

def factual_record(ad, observed_at, rank):
    # Recommended ads outside this region can appear after the real results.
    if ad.get('location') != 'Дархан-Уул':
        return None
    ancestors = ad.get('rubric',{}).get('ancestors',[])
    root_id = ancestors[0]['id'] if ancestors else ad.get('rubric',{}).get('id')
    category = CATEGORY_IDS.get(root_id)
    if not category:
        raise ValueError(f'Unmapped category {root_id}; needs review.')
    url = urllib.parse.urljoin(ORIGIN, ad['url'])
    if not re.fullmatch(r'https://www\.unegui\.mn/adv/\d+_[^?#]+/', url):
        raise ValueError('Unexpected source URL; stop.')
    raw_price = str(ad.get('price_without_currency') or '').strip()
    price = float(raw_price) if re.fullmatch(r'\d+(\.\d+)?',raw_price) else None
    return {
        'id': str(ad['id']), 'title': ad['title'], 'category': category,
        'subcategory': ' / '.join(x['name'] for x in ancestors[1:]),
        'price': price, 'priceLabel': ad.get('price') or 'Үнэ тохирно',
        'location': 'Дархан-Уул', 'region': 'darkhanuul',
        'publishedLabel': ad.get('published') or '', 'url': url,
        'features': [f['text'] for f in ad.get('features',[]) if f.get('text')],
        'sourceRank': rank, 'sourcePromotion': (ad.get('ad_type') or {}).get('text',''),
        'observedAt': observed_at, **source_images(ad),
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache-directory', required=True, type=Path)
    parser.add_argument('--output-directory', required=True, type=Path)
    parser.add_argument('--use-cached-first-page', action='store_true', help='Use explicitly supplied all.html for an offline/checkpointed first page.')
    args = parser.parse_args()
    args.cache_directory.mkdir(parents=True,exist_ok=True)
    args.output_directory.mkdir(parents=True,exist_ok=True)
    observed_at = datetime.now(ZoneInfo('Asia/Ulaanbaatar')).isoformat(timespec='seconds')
    records, pages, expected, categories = {}, [], None, []
    url = ROOT
    while url:
        page_number = len(pages)+1
        # Independent of a potentially incorrect global pagination total.
        if page_number > 20:
            raise ValueError('Regional page safety limit reached; review the source.')
        cache = args.cache_directory / f'listing-{page_number}.html'
        if args.use_cached_first_page and page_number == 1 and (args.cache_directory/'all.html').exists():
            body = (args.cache_directory/'all.html').read_text()
        else:
            request = urllib.request.Request(url,headers={'User-Agent':'DarkhanzarResearch/1.0 (one-off regional link index)'})
            # No retry, auth, CAPTCHA handling, proxy changes or API endpoints.
            with urllib.request.urlopen(request,timeout=35) as response:
                if response.status != 200:
                    raise ValueError('Source request failed; stop.')
                body = response.read().decode('utf-8')
            cache.write_text(body)
        doc,data = parse_public_page(body)
        if expected is None:
            expected = data['location_count']
            categories = [{k:c[k] for k in ['id','name','count','path']} for c in data['child_rubrics']]
        before = len(records)
        regional_count = 0
        for ad in data['adverts']:
            record = factual_record(ad,observed_at,len(records))
            if record:
                regional_count += 1
                records.setdefault(record['id'],record)
        pages.append({'url':url,'sourceCount':data['location_count'],'regionalCards':regional_count,'newIds':len(records)-before})
        print(json.dumps({'page':page_number,'unique':len(records),'expected':expected,'regionalCards':regional_count,'newIds':len(records)-before}),flush=True)
        if len(records)>=expected or not regional_count or len(records)==before:
            break
        next_links = doc.xpath('//*[@data-component="PaginationLinks"]//a[normalize-space()="Дараагийнх"]/@href')
        if not next_links:
            next_links = doc.xpath('//a[contains(@href,"page=") and normalize-space()="Дараагийнх"]/@href')
        url = urllib.parse.urljoin(ORIGIN,next_links[0]) if next_links else None
        if url and (not url.startswith(ROOT) or '/api' in url):
            raise ValueError('Unexpected pagination URL; stop.')
        if url:
            time.sleep(0.8)
    items = list(records.values())
    export = {'schemaVersion':2,'sourceName':'Unegui.mn','sourceUrl':ROOT,'observedAt':observed_at,'sourceAdvertisedCount':expected,'collectedCount':len(items),'coverage':'count_matched' if len(items)==expected else 'partial','scope':'Дархан-Уул аймаг; эх сурвалжийн location=457','content':'Listing metadata with source image URL references. No image files, full descriptions, seller profiles or contact numbers.','categories':categories,'pages':pages,'items':items}
    (args.output_directory/'unegui-darkhan.json').write_text(json.dumps(export,ensure_ascii=False,indent=2)+'\n')
    with (args.output_directory/'unegui-darkhan.csv').open('w',encoding='utf-8-sig',newline='') as f:
        fields=['id','title','category','subcategory','price','priceLabel','location','publishedLabel','url','observedAt','thumbnail','imageCount']
        writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
        for item in items:
            writer.writerow({k: "'"+str(v) if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v for k,v in item.items()})
    print(json.dumps({'saved':len(items),'expected':expected,'coverage':export['coverage'],'pages':len(pages)}),flush=True)

if __name__=='__main__':
    main()
