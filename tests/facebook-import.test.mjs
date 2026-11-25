import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parsePost,findPhone,findPrice,findCategory,findRegion,postImages} from '../server/facebook-parse.mjs';
import {importPosts,runFacebookImport,dailyFacebookImport,handleFacebookImportAPI} from '../server/facebook-import.mjs';

test('Phone numbers are found in common Mongolian formats; prices are not mistaken for phones',()=>{
 for(const [text,phone] of [['Утас 99112233','99112233'],['холбогдох: 8811-2233','88112233'],['+976 9511 2233 залгаарай','95112233'],['Ут: 88 11 22 33','88112233'],['80001234 руу','80001234']])assert.equal(findPhone(text),phone,text);
 for(const text of ['Үнэ 85000000₮','Үнэ: 15 сая','70000000 төг','Хэмжээ 120мкв','Утасгүй пост'])assert.equal(findPhone(text),'',text);
});

test('Prices: сая, мянга, ₮ with separators; the amount after "үнэ" wins; none means 0',()=>{
 assert.equal(findPrice('Toyota Prius 30. Үнэ 15.5 сая. Утас 99112233'),15500000);
 assert.equal(findPrice('iPhone 13, 1 800 000₮'),1800000);
 assert.equal(findPrice('Шинэ гутал 85,000 төг'),85000);
 assert.equal(findPrice('Хүүхдийн тэрэг 150 мянга'),150000);
 assert.equal(findPrice('2 сая төгрөгөөр авсан, үнэ 900 мянга'),900000);
 assert.equal(findPrice('Байр 1.2 тэрбум'),1200000000);
 assert.equal(findPrice('Утас 99112233 залгаарай'),0);
});

test('Category and location come from keywords; Darkhan is the default',()=>{
 assert.equal(findCategory('Toyota Prius 2015 он, 120000 км явсан'),'cars');
 assert.equal(findCategory('3 өрөө байр зарна, 60 мкв'),'property');
 assert.equal(findCategory('Угаалгын машин зарна'),'electronics');
 assert.equal(findCategory('iPhone 13 Pro утас'),'phones');
 assert.equal(findCategory('Ажилтан авна, цалин 1.5 сая'),'jobs');
 assert.equal(findCategory('Юм зарна'),'home');
 assert.equal(findRegion('Хөтөлд байрлах байр'),'khutul');
 assert.equal(findRegion('Сүхбаатар хотод'),'sukhbaatar');
 assert.equal(findRegion('Шинэ Дархан, 15-р хороолол'),'darkhan');
});

test('A post becomes a listing draft only with a phone; title, condition and negotiable price are set',()=>{
 assert.equal(parsePost('Сайхан зураг 😍'),null);
 const d=parsePost('🔥🔥 Prius 30 зарна #darkhanzar\n2012 он, 150000 км\nҮнэ 15 сая\nУтас: 9911 2233');
 assert.equal(d.title,'Prius 30 зарна');assert.equal(d.category,'cars');assert.equal(d.price,15000000);assert.equal(d.negotiable,false);
 assert.equal(d.phone,'99112233');assert.equal(d.region,'darkhan');assert.equal(d.place,'Дархан');assert.equal(d.condition,'used');
 const n=parsePost('Шинэ хүүхдийн тэрэг зарна. 88112233');
 assert.equal(n.price,0);assert.equal(n.negotiable,true);assert.equal(n.condition,'new');
 assert(n.title.length>=8&&n.description.length>=20);
 assert.equal(parsePost('Шинэ Дархан 2 өрөө байр 88112233').condition,'used','"Шинэ Дархан" is a place, not "new"');
});

test('Photos come from single photos and albums; video posts are not photo ads',()=>{
 assert.deepEqual(postImages({attachments:{data:[{type:'photo',media:{image:{src:'https://scontent.xx.fbcdn.net/a.jpg'}}}]}}),['https://scontent.xx.fbcdn.net/a.jpg']);
 assert.deepEqual(postImages({attachments:{data:[{type:'album',subattachments:{data:[{type:'photo',media:{image:{src:'https://x.fbcdn.net/1.jpg'}}},{type:'photo',media:{image:{src:'https://x.fbcdn.net/2.jpg'}}}]}}]}}),['https://x.fbcdn.net/1.jpg','https://x.fbcdn.net/2.jpg']);
 assert.deepEqual(postImages({full_picture:'https://x.fbcdn.net/v.jpg',attachments:{data:[{type:'video_inline'}]}}),[]);
 assert.deepEqual(postImages({message:'text only'}),[]);
});

const JPEG=new Uint8Array([255,216,255,224,...new Array(60).fill(1)]);
function fixture(extra={}){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE auth_users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, password_hash TEXT, role TEXT, created_at INTEGER);
  CREATE TABLE market_listings (id TEXT PRIMARY KEY, owner_id TEXT, data_json TEXT, status TEXT, created_at INTEGER, updated_at INTEGER, promoted_until INTEGER DEFAULT 0);
  CREATE TABLE market_uploads (path TEXT PRIMARY KEY, owner_id TEXT, created_at INTEGER);
  CREATE TABLE facebook_imports (post_id TEXT PRIMARY KEY, listing_id TEXT, status TEXT, reason TEXT, created_at INTEGER);
  CREATE TABLE facebook_import_runs (id TEXT PRIMARY KEY, day TEXT, trig TEXT, status TEXT, started_at INTEGER, finished_at INTEGER DEFAULT 0, result_json TEXT);`);
 db.prepare("INSERT INTO auth_users VALUES ('admin-1','owner@example.test','Darkhanzar админ','x','admin',1)").run();
 const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {};}});
 const objects=new Map();
 return {db,objects,env:{ADMIN_EMAIL:'owner@example.test',FACEBOOK_PAGE_ID:'123456789',FACEBOOK_PAGE_TOKEN:'page-token-'.padEnd(40,'x'),FACEBOOK_APP_SECRET:'s'.repeat(32),DB:{prepare:sql=>stmt(sql)},BUCKET:{async put(k,v){objects.set(k,v);}},...extra}};
}
const posts=[
 {id:'123456789_1',created_time:'2026-10-05T10:00:00+0000',message:'Prius 30 зарна\nҮнэ 15 сая\nУтас 99112233',permalink_url:'https://www.facebook.com/Darkhanzar/posts/1',attachments:{data:[{type:'album',subattachments:{data:[{type:'photo',media:{image:{src:'https://scontent.fuln1-1.fna.fbcdn.net/p1.jpg'}}},{type:'photo',media:{image:{src:'https://evil.example/p2.jpg'}}}]}}]}},
 {id:'123456789_2',created_time:'2026-10-06T10:00:00+0000',message:'Сайхан өдөр',attachments:{data:[{type:'photo',media:{image:{src:'https://x.fbcdn.net/n.jpg'}}}]}},
 {id:'123456789_3',created_time:'2026-10-07T10:00:00+0000',message:'2 өрөө байр түрээслүүлнэ 88112233'},
];
function fakeFetch(calls){
 return async url=>{
  const u=new URL(url);calls.push(u.hostname);
  if(u.hostname==='graph.facebook.com'){
   assert.equal(u.searchParams.get('appsecret_proof').length,64);
   const page=u.searchParams.get('after');
   return Response.json(page?{data:[posts[2]]}:{data:[posts[0],posts[1]],paging:{next:'https://graph.facebook.com/v23.0/123456789/feed?after=2'}});
  }
  if(u.hostname.endsWith('.fbcdn.net')){const r=new Response(JPEG,{headers:{'Content-Type':'image/jpeg'}});Object.defineProperty(r,'url',{value:String(url)});return r;}
  throw Error('unexpected host '+u.hostname);
 };
}

test('Import: photo+phone posts become published admin listings; others are skipped; reruns never duplicate',async()=>{
 const {db,env,objects}=fixture();const calls=[];
 const result=await runFacebookImport(env,'manual',{fetcher:fakeFetch(calls)});
 assert.equal(result.status,'ok',JSON.stringify(result));assert.equal(result.imported,1);assert.equal(result.skipped,2);
 assert.deepEqual(result.reasons,{no_phone:1,no_photo:1});
 assert(!calls.includes('evil.example'),'non-Facebook image hosts are never fetched');
 const rows=db.prepare('SELECT * FROM market_listings').all();
 assert.equal(rows.length,1);assert.equal(rows[0].owner_id,'admin-1');assert.equal(rows[0].status,'published');
 assert.equal(rows[0].created_at,Date.parse('2026-10-05T10:00:00+0000'));
 const data=JSON.parse(rows[0].data_json);
 assert.equal(data.seller,'Darkhanzar админ');assert.equal(data.phone,'99112233');assert.equal(data.price,15000000);assert.equal(data.images.length,1);
 assert.match(data.images[0],/^\/api\/listing-media\/[a-f0-9-]{36}\.jpg$/);assert.equal(objects.size,1);
 assert.equal(data.source,undefined,'imported page ads rank as Darkhanzar ads, not Unegui');
 const again=await importPosts(env,posts,{fetcher:fakeFetch([])});
 assert.equal(again.imported,0);assert.equal(again.already,3);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM market_listings').get().n,1);
});

test('First run starts at 1 October; later runs continue from the last successful run',async()=>{
 const {env}=fixture();let since=[];
 const fetcher=async url=>{const u=new URL(url);if(u.hostname==='graph.facebook.com'){since.push(Number(u.searchParams.get('since'))*1000);return Response.json({data:[]});}throw Error('no');};
 await runFacebookImport(env,'manual',{fetcher});
 assert.equal(since[0],Date.parse('2026-10-01T00:00:00+08:00'));
 await runFacebookImport(env,'manual',{fetcher});
 assert(since[1]>Date.parse('2026-11-01'),'second run does not re-read from October');
});

test('Daily run: only from 08:00 Ulaanbaatar, once per day, only when configured; Graph errors are recorded',async()=>{
 const {db,env}=fixture();
 const fetcher=async()=>Response.json({error:{code:190,message:'Invalid OAuth access token.'}},{status:400});
 assert.equal(await dailyFacebookImport(env,{now:Date.parse('2026-11-25T07:59:00+08:00'),fetcher}),null);
 const r=await dailyFacebookImport(env,{now:Date.parse('2026-11-25T08:00:30+08:00'),fetcher});
 assert.equal(r.status,'failed');assert.equal(r.error,'FACEBOOK_190');
 assert.equal(await dailyFacebookImport(env,{now:Date.parse('2026-11-25T15:00:00+08:00'),fetcher}),null,'already ran today');
 assert.equal(db.prepare("SELECT status FROM facebook_import_runs WHERE id='daily-2026-11-25'").get().status,'failed');
 assert.equal(await dailyFacebookImport({...env,FACEBOOK_PAGE_TOKEN:''},{now:Date.parse('2026-11-26T09:00:00+08:00'),fetcher}),null);
});

test('Import admin API is admin-only and same-origin',async()=>{
 const {env}=fixture({FACEBOOK_PAGE_TOKEN:''});const origin='https://darkhan.example';
 const req=(method,headers={})=>new Request(origin+'/api/admin/facebook-import',{method,headers:{Origin:origin,...headers}});
 assert.equal((await handleFacebookImportAPI(req('GET'),env)).status,403);
 const admin={'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-role':'admin','oai-authenticated-user-id':'admin-1'};
 const status=await (await handleFacebookImportAPI(req('GET',admin),env)).json();assert.equal(status.configured,false);
 assert.equal((await handleFacebookImportAPI(req('POST',admin),env)).status,409);
 assert.equal((await handleFacebookImportAPI(req('POST',{...admin,Origin:'https://evil.test'}),env)).status,403);
 assert.equal(await handleFacebookImportAPI(new Request(origin+'/api/other'),env),null);
});
