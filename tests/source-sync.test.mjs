import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {SOURCES,parsePage,cityFromText,safeImage,detailCity,parseDetail} from '../server/unegui-parser.mjs';
import {startSync,stepSync,publicSnapshot,localDay,sourceImage,startEnrichment,stepEnrichment} from '../server/source-sync.mjs';
import {handleSourceAPI} from '../server/source-api.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const objects=new Map();
 const env={ADMIN_EMAIL:'owner@example.test',DB:{prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return db.prepare(sql).get(...this.args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...this.args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const results=statements.map(s=>({results:db.prepare(s.sql).all(...s.args)}));db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,body,options){objects.set(key,{body,httpMetadata:options?.httpMetadata,text:async()=>String(body)});},async get(key){return objects.get(key)||null;}}};return {env,db,objects};
}
const ad=(id,title='Toyota машин',location='Дархан-Уул')=>({id,title,location,url:`/adv/${id}_listing/`,price_without_currency:'100',price:'100 ₮',rubric:{ancestors:[{id:1816,name:'Автомашин'}]},images:['https://cdn1.unegui.mn/media/cache1/image.webp'],features:[],published:'Өнөөдөр'});
function html(source,ads,{expected=ads.length,next=false}={}){
 const value={location_ids:[source.id],location_count:expected,adverts:ads,next_page:next?2:null,total_pages:1};
 return `<script>self.__next_f.push(${JSON.stringify([1,'a:'+JSON.stringify(value)+'\n'])})</script>`;
}
function fakeSource(){const calls=[];return {calls,fetcher:async url=>{calls.push(url);if(url.includes('/search/darhan-uul/'))return new Response(html(SOURCES[0],[ad(10),ad(10)] ,{expected:1}));if(url.includes('/search/selenge/'))return new Response(html(SOURCES[1],[ad(20,'Хөтөлд байр зарна','Сэлэнгэ'),ad(21,'Сүхбаатар суманд байр','Сэлэнгэ'),ad(22,'Нэрэндээ хотгүй зар','Сэлэнгэ'),ad(23,'Сэлэнгэ аймагт машин','Сэлэнгэ'),ad(99,'Хөтөл орсон зөвлөмж','Улаанбаатар')],{expected:4}));if(url.includes('/adv/22_'))return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':['Product'],sku:'22',description:'Хөтөл хотод байрлалтай'})+'</script>');if(url.includes('/adv/23_'))return new Response('<script type="application/ld+json">'+JSON.stringify({'@type':'Product',sku:'23',description:'Мандал суманд байрлалтай'})+'</script>');if(url.includes('/adv/')){const id=url.match(/adv\/(\d+)_/)[1];return new Response(detailHTML(id));}throw Error('Unexpected URL');}};}
test('Public page parser binds the exact province, ignores recommendations and never stores seller details',()=>{
 const x=ad(1);x.user={name:'Private seller',phone:'12345678'};
 const p=parsePage(html(SOURCES[0],[x,ad(2,'Дарханы тухай УБ зар','Улаанбаатар')]),SOURCES[0]);assert.equal(p.records.length,1);assert.equal(p.records[0].region,'darkhanuul');assert.equal('user' in p.records[0],false);assert.throws(()=>parsePage(html(SOURCES[1],[x]),SOURCES[0]),/SOURCE_FORMAT_CHANGED/);
});
test('City classification never conflates Sukhbaatar district/province with Selenge city or guesses unknown locations',()=>{
 assert.equal(cityFromText('Хөтөлд 2 өрөө байр'), 'khutul');assert.equal(cityFromText('Сэлэнгэ Сүхбаатар хотод'), 'sukhbaatar');assert.equal(cityFromText('Сүхбаатар дүүрэгт'),null);assert.equal(cityFromText('Сүхбаатар аймаг'),null);assert.equal(cityFromText('Сэлэнгэ аймагт'),null);assert.equal(cityFromText('Хөтөл болон Сүхбаатар'),null);
 const h='<script type="application/ld+json">'+JSON.stringify({'@type':'Product',sku:'other',description:'Хөтөл хот'})+'</script>';assert.equal(detailCity(h,'wanted'),null);
});
test('Daily run is idempotent, deduplicated, atomic and includes city evidence from the matching detail only',async()=>{
 const {env}=fixture(),source=fakeSource();let s=await startSync(env);const id=s.runId;assert.equal((await startSync(env)).runId,id);assert.equal(await publicSnapshot(env),null);
 for(let i=0;i<10&&s.status==='running';i++)s=await stepSync(env,id,source);
 assert.equal(s.status,'succeeded');const publication=await publicSnapshot(env);assert.deepEqual(publication.counts,{darkhanuul:1,khutul:2,sukhbaatar:1});assert.equal(publication.excludedUnclear,1);assert.equal(new Set(publication.items.map(x=>x.id)).size,4);assert.equal(publication.items.some(x=>x.id==='99'),false);const count=source.calls.length;await stepSync(env,id,source);await startSync(env);assert.equal(source.calls.length,count);
});
test('Source errors preserve the last complete publication and stop the day without retries',async()=>{
 const {env,db,objects}=fixture();objects.set('prior',{text:async()=>JSON.stringify({collectedCount:7})});db.prepare('INSERT INTO source_publication VALUES (1,?,?,?)').run('prior','2026-01-01',7);
 const s=await startSync(env);let calls=0;const result=await stepSync(env,s.runId,{fetcher:async()=>{calls++;return new Response('denied',{status:403});}});assert.equal(result.status,'failed');assert.equal(result.error,'SOURCE_HTTP_403');assert.equal((await publicSnapshot(env)).collectedCount,7);await stepSync(env,s.runId,{fetcher:()=>{calls++;throw Error();}});assert.equal(calls,1);
});
test('Incomplete pages cannot replace the publication; source next_page can be followed even when total_pages is stale',async()=>{
 const {env}=fixture();let s=await startSync(env);s=await stepSync(env,s.runId,{fetcher:async()=>new Response(html(SOURCES[0],[ad(1)],{expected:2,next:true}))});assert.equal(s.status,'running');assert.equal(s.page,2);s=await stepSync(env,s.runId,{fetcher:async()=>new Response(html(SOURCES[0],[ad(1)],{expected:2,next:true}))});assert.equal(s.status,'failed');assert.equal(await publicSnapshot(env),null);
});
test('Concurrent calls acquire one lease and do not fetch the same batch twice',async()=>{
 const {env}=fixture();const s=await startSync(env);let release,calls=0;const gate=new Promise(r=>{release=r;});const pending=stepSync(env,s.runId,{fetcher:async()=>{calls++;await gate;return new Response(html(SOURCES[0],[ad(1)]));}});
 // The first call's DB operations yield several times; poll only fixture lease.
 for(let i=0;i<20;i++)await Promise.resolve();const other=await stepSync(env,s.runId,{fetcher:()=>{calls++;throw Error();}});assert.equal(other.busy,true);release();await pending;assert.equal(calls,1);
});
test('Public writes and another account cannot trigger import; cloud task service needs its own authorization',async()=>{
 const {env}=fixture();const req=(path,headers={},body={})=>new Request('https://darkhan.test'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://darkhan.test',...headers},body:JSON.stringify(body)});
 assert.equal((await handleSourceAPI(req('/api/admin/source-sync'),env)).status,401);
 assert.equal((await handleSourceAPI(req('/api/source-task',{}, {action:'start'}),env)).status,401);
 assert.equal((await handleSourceAPI(req('/api/admin/source-sync',{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'}),env)).status,403);
 assert.equal((await handleSourceAPI(req('/api/admin/source-sync',{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test',Origin:'https://evil.test'}),env)).status,403);
});
test('Image cache blocks SSRF, redirects and executable content; accepted bytes are cached unchanged',async()=>{
 const {env}=fixture();assert.equal(safeImage('https://evil.test/media/img.jpg'),null);assert.equal(safeImage('http://cdn1.unegui.mn/media/img.jpg'),null);
 const req=url=>new Request('https://darkhan.test/api/source-image?url='+encodeURIComponent(url));assert.equal((await sourceImage(req('https://evil.test/media/a'),env)).status,400);
 assert.equal((await sourceImage(req('https://cdn1.unegui.mn/media/a'),env,{fetcher:async()=>new Response('<svg/>')})).status,415);
 let calls=0;const bytes=new Uint8Array([255,216,255,1,2,3,4,5,6,7,8,9]);const options={fetcher:async()=>{calls++;return new Response(bytes);}};const response=await sourceImage(req('https://cdn1.unegui.mn/media/a.jpg'),env,options);assert.equal(response.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);await sourceImage(req('https://cdn1.unegui.mn/media/a.jpg'),env,options);assert.equal(calls,1);
});
test('Day boundary follows Ulaanbaatar time',()=>assert.equal(localDay(Date.parse('2026-11-17T17:00:00Z')),'2026-11-18'));
test('Image cache follows bounded redirects within source media hosts and rejects other destinations',async()=>{
 const {env}=fixture();const request=new Request('https://darkhan.test/api/source-image?url='+encodeURIComponent('https://cdn1.unegui.mn/media/redirect.jpg'));let count=0;
 const bytes=new Uint8Array([255,216,255,1,2,3,4,5,6,7,8,9]);
 const r=await sourceImage(request,env,{fetcher:async()=>++count===1?new Response(null,{status:302,headers:{Location:'https://cdn2.unegui.mn/media/image.jpg'}}):new Response(bytes)});assert.equal(r.status,200);assert.equal(count,2);
 const bad=await sourceImage(new Request('https://darkhan.test/api/source-image?url='+encodeURIComponent('https://cdn1.unegui.mn/media/bad.jpg')),env,{fetcher:async()=>new Response(null,{status:302,headers:{Location:'https://evil.test/media/steal'}})});assert.equal(bad.status,502);
});
test('Cloud service authentication is limited to the import writer and never accepts an unconfigured or incorrect credential',async()=>{
 const {env}=fixture();const token='fixture-only-service-token';
 env.UNEGUI_SYNC_SERVICE_HASH=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const req=value=>new Request('https://darkhan.test/api/source-task',{method:'POST',headers:{'Content-Type':'application/json','X-Darkhanzar-Sync':'Bearer '+value},body:JSON.stringify({action:'start'})});
 assert.equal((await handleSourceAPI(req('incorrect'),env)).status,401);
 const response=await handleSourceAPI(req(token),env);assert.equal(response.status,200);assert.equal((await response.json()).status,'running');
});

function detailHTML(id,features=[{name:'Үйлдвэрлэсэн он',value:'2014'},{name:'Мотор багтаамж',value:'1.8 л'}]){
 const target={id:Number(id),name:'Toyota Prius',description:'зарна',features,categories:[{id:1816,name:'Автомашин'},{id:1817,name:'Автомашин зарна'},{id:3,name:'Toyota'},{id:4,name:'Prius 30'}],user:{phone:'12345678'},vin:'private-vin'};
 return `<script>self.__next_f.push(${JSON.stringify([1,'a:'+JSON.stringify({recommended:{...target,id:999,features:[{name:'Өнгө',value:'Буруу зөвлөмж'}]},target})+'\n'])})</script>`;
}
test('Detail specifications belong to the exact source ID and include categorical brand/model without copying private fields',()=>{
 const result=parseDetail(detailHTML('10',[{name:'Үйлдвэрлэсэн он',value:'2014'},{name:'Хөдөлгүүр',value:'Хайбрид'},{name:'Хөтлөгч',value:'Урдаа FWD'},{name:'Extras',values:[{name:'A'},{value:'B'}]},{name:'__proto__',value:'bad'},{name:'VIN',value:'private'}]),'10');
 assert.equal(result.attributes['Үйлдвэрлэсэн он'],'2014');assert.equal(result.attributes['Брэнд'],'Toyota');assert.equal(result.attributes['Загвар'],'Prius 30');assert.equal(result.attributes.Extras,'A | B');assert.equal(result.attributes['Өнгө'],undefined);assert.equal(result.attributes.VIN,undefined);assert.equal(Object.hasOwn(result.attributes,'__proto__'),false);assert.equal(JSON.stringify(result).includes('12345678'),false);assert.throws(()=>parseDetail(detailHTML('11'),'10'),/SOURCE_DETAIL_FORMAT_CHANGED/);
});
async function oldPublication(f){const snapshot={schemaVersion:4,observedAt:'2026-11-17T00:00:00Z',collectedCount:4,items:[10,11,12,13].map(id=>({id:String(id),url:`https://www.unegui.mn/adv/${id}_listing/`,region:'darkhanuul'}))};await f.env.BUCKET.put('prior',JSON.stringify(snapshot));f.db.prepare('INSERT INTO source_publication VALUES (1,?,?,?)').run('prior',snapshot.observedAt,4);return snapshot;}
test('Repair is idempotent, resumable and publishes complete factual attributes without changing original index date',async()=>{
 const f=fixture(),original=await oldPublication(f);let s=await startEnrichment(f.env);assert.equal((await startEnrichment(f.env)).runId,s.runId);let calls=0;const options={fetcher:async url=>{calls++;return new Response(detailHTML(url.match(/adv\/(\d+)_/)[1]));}};
 s=await stepEnrichment(f.env,s.runId,options);assert.equal(s.cursor,3);assert.equal((await publicSnapshot(f.env)).schemaVersion,4);
 s=await stepEnrichment(f.env,s.runId,options);assert.equal(s.status,'succeeded');const result=await publicSnapshot(f.env);assert.equal(result.items.length,4);assert.equal(result.observedAt,original.observedAt);assert.equal(result.items[0].attributes['Мотор багтаамж'],'1.8 л');assert.equal(result.schemaVersion,5);assert.equal((await startEnrichment(f.env)).status,'succeeded');await stepEnrichment(f.env,s.runId,options);assert.equal(calls,4);
});
test('Repair cannot replace a newer daily snapshot and source failures leave old data intact',async()=>{
 const f=fixture();await oldPublication(f);let s=await startEnrichment(f.env);s=await stepEnrichment(f.env,s.runId,{fetcher:async()=>new Response('blocked',{status:403})});assert.equal(s.status,'failed');assert.equal((await publicSnapshot(f.env)).schemaVersion,4);
 const g=fixture();await oldPublication(g);let job=await startEnrichment(g.env);let release;const gate=new Promise(r=>release=r);const step=stepEnrichment(g.env,job.runId,{fetcher:async url=>{await gate;return new Response(detailHTML(url.match(/adv\/(\d+)_/)[1]));}});for(let i=0;i<20;i++)await Promise.resolve();const busy=await stepEnrichment(g.env,job.runId,{fetcher:()=>{throw Error('must not fetch');}});assert.equal(busy.busy,true);g.db.prepare("UPDATE source_publication SET object_key='newer' WHERE id=1").run();await g.env.BUCKET.put('newer',JSON.stringify({schemaVersion:9,items:[]}));release();await step;job=await stepEnrichment(g.env,job.runId);assert.equal(job.status,'failed');assert.equal(job.error,'SOURCE_PUBLICATION_CHANGED');assert.equal((await publicSnapshot(g.env)).schemaVersion,9);
});
test('Unavailable individual ads do not fail attribute enrichment or invent their specifications',async()=>{
 const f=fixture();await oldPublication(f);let s=await startEnrichment(f.env);for(let i=0;i<2;i++)s=await stepEnrichment(f.env,s.runId,{fetcher:async()=>new Response(null,{status:404})});assert.equal(s.status,'succeeded');assert.deepEqual((await publicSnapshot(f.env)).items[0].attributes,{});assert.equal((await publicSnapshot(f.env)).items[0].detailStatus,'unavailable');
});
