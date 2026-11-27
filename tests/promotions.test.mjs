import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createPromotion,verifyPromotion,handlePromotionsAPI} from '../server/promotions-api.mjs';
import {handleMarketAPI,publicListing} from '../server/market-api.mjs';
import {qpayRequest,invoiceDisplay} from '../server/qpay.mjs';
import {defaultSettings} from '../src/lib/site-settings.mjs';
import {filterListings} from '../src/lib/domain.mjs';
const origin='https://darkhan.test',owner={id:'verified-owner',name:'Зарын эзэн'};
function fixture(){
 const db=new DatabaseSync(':memory:');for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));
 const objects=new Map();const env={ADMIN_EMAIL:'admin@example.test',QPAY_ENABLED:'true',QPAY_BASE_URL:'https://merchant-sandbox.qpay.mn',QPAY_USERNAME:crypto.randomUUID(),QPAY_PASSWORD:'fixture-only',QPAY_INVOICE_CODE:'FIXTURE_INVOICE',QPAY_SITE_ORIGIN:origin,DB:{prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return db.prepare(sql).get(...this.args)||null;},async all(){return {results:db.prepare(sql).all(...this.args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...this.args).changes)}};}};},async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>({results:db.prepare(s.sql).all(...s.args)}));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,body,options){objects.set(key,{body,httpMetadata:options?.httpMetadata});},async get(key){return objects.get(key)||null;}}};
 const settings=structuredClone(defaultSettings);settings.promotionPlans[1]={id:'special-7',label:'Онцгой 7',days:7,price:5000,enabled:true,categoryPrices:{cars:7000}};db.prepare('INSERT INTO site_settings VALUES (1,?,1,?,?)').run(JSON.stringify(settings),'now',owner.id);
 const listing={title:'Бодит Toyota автомашин',description:'Өөрийн бодит автомашины тайлбар',category:'cars',categoryLabel:'Автомашин',region:'darkhan',place:'Дархан',price:12345,images:['/api/listing-media/11111111-1111-4111-8111-111111111111.jpg'],attributes:{},seller:owner.name};
 db.prepare('INSERT INTO market_listings VALUES (?,?,?,?,?,?,0)').run('DZ-real',owner.id,JSON.stringify(listing),'published',Date.now(),Date.now());return {env,db,objects,settings,listing};
}
const input=()=>({requestId:crypto.randomUUID(),listingId:'DZ-real',planId:'special-7',amount:1,days:999,featured:true});
function provider({paid=false,amount=7000,currency='MNT',objectId='invoice-fixture',throwInvoice=false}={}){
 const calls=[];let callback;
 return {calls,get callback(){return callback;},fetcher:async(url,options)=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):undefined;calls.push({path,body,method:options.method});
  if(path==='/v2/auth/token')return Response.json({access_token:'fixture-access-token',expires_in:Math.floor(Date.now()/1000)+3600});
  if(path==='/v2/invoice'){callback=body.callback_url;if(throwInvoice)throw Error('ambiguous fixture network failure');return Response.json({invoice_id:'invoice-fixture',qr_text:'fixture-qr',qr_image:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',urls:[{name:'Bank',description:'Банк',link:'bankapp://q?keep=unchanged%2B'}]});}
  if(path==='/v2/payment/check')return Response.json({count:paid?1:0,paid_amount:paid?amount:0,rows:paid?[{payment_id:'payment-fixture'}]:[]});
  if(path==='/v2/payment/payment-fixture')return Response.json({payment_id:'payment-fixture',payment_status:'PAID',payment_amount:String(amount),payment_currency:currency,object_type:'INVOICE',object_id:objectId});
  throw Error('Unexpected provider route '+path);
 }};
}
const req=(path,method='GET',body,who=owner,extra={})=>new Request(origin+path,{method,headers:{Origin:origin,...(who?{'oai-authenticated-user-id':who.id}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
test('Server snapshots category price and duration, ignoring client amount/days; duplicate creates reuse one invoice',async()=>{
 const {env}=fixture(),p=provider(),i=input();const order=await createPromotion(env,owner,i,origin,p);assert.equal(order.amount,7000);assert.equal(order.days,7);assert.equal(order.status,'pending');assert.equal((await createPromotion(env,owner,i,origin,p)).id,order.id);assert.equal((await createPromotion(env,owner,input(),origin,p)).id,order.id);assert.equal(p.calls.filter(c=>c.path==='/v2/invoice').length,1);assert.equal(p.calls.find(c=>c.path==='/v2/invoice').body.amount,7000);assert.equal(JSON.stringify(order).includes('fixture-access-token'),false);assert.equal(JSON.stringify(order).includes(new URL(p.callback).searchParams.get('key')),false);
});
test('Only owner-published native ads can create invoices; zero/disabled plans and changed origin are rejected before payment access',async()=>{
 const f=fixture(),p=provider();await assert.rejects(createPromotion(f.env,{id:'other'},input(),origin,p),/өөрийн/);await assert.rejects(createPromotion(f.env,owner,{...input(),listingId:'UN-10904992'},origin,p),/өөрийн/);f.db.prepare("UPDATE market_listings SET status='pending'").run();await assert.rejects(createPromotion(f.env,owner,input(),origin,p),/Админ/);f.db.prepare("UPDATE market_listings SET status='published'").run();await assert.rejects(createPromotion(f.env,owner,input(),'https://evil.test',p),/үндсэн хаяг/);f.settings.promotionPlans[1].enabled=false;f.db.prepare('UPDATE site_settings SET value_json=?').run(JSON.stringify(f.settings));await assert.rejects(createPromotion(f.env,owner,input(),origin,p),/багцыг/);assert.equal(p.calls.length,0);
});
test('Concurrent invoice requests acquire one persistent active slot before calling QPay',async()=>{
 const f=fixture(),p=provider();let release;const gate=new Promise(r=>release=r);const options={fetcher:async(u,o)=>{if(u.endsWith('/v2/invoice'))await gate;return p.fetcher(u,o);}};const pending=createPromotion(f.env,owner,input(),origin,options);for(let n=0;n<30;n++)await Promise.resolve();const second=await createPromotion(f.env,owner,input(),origin,options);assert.equal(second.status,'creating');release();const first=await pending;assert.equal(first.id,second.id);assert.equal(p.calls.filter(c=>c.path==='/v2/invoice').length,1);
});
test('An ambiguous invoice response holds its slot and never retries creating another invoice',async()=>{
 const f=fixture(),p=provider({throwInvoice:true});const order=await createPromotion(f.env,owner,input(),origin,p);assert.equal(order.status,'unknown');assert.equal((await createPromotion(f.env,owner,input(),origin,p)).id,order.id);assert.equal(p.calls.filter(c=>c.path==='/v2/invoice').length,1);
});
test('Only verified PAID MNT amounts for the exact invoice activate a promotion, and replay never extends it',async()=>{
 const f=fixture(),p=provider({paid:true});const order=await createPromotion(f.env,owner,input(),origin,p);const paid=await verifyPromotion(f.env,order.id,p);assert.equal(paid.status,'paid');const row=f.db.prepare('SELECT * FROM market_listings').get();assert(row.promoted_until>Date.now()+6*86400000);const before=p.calls.length;await verifyPromotion(f.env,order.id,p);assert.equal(p.calls.length,before);assert.equal(f.db.prepare('SELECT promoted_until FROM market_listings').get().promoted_until,row.promoted_until);assert.equal(publicListing(row).featured,true);
});
test('Wrong currency, insufficient amount and another invoice cannot activate an ad',async()=>{
 for(const overrides of [{currency:'USD'},{amount:6999},{objectId:'another-invoice'}]){const f=fixture(),p=provider({paid:true,...overrides});const order=await createPromotion(f.env,owner,input(),origin,p);assert.equal((await verifyPromotion(f.env,order.id,p)).status,'pending');assert.equal(f.db.prepare('SELECT promoted_until FROM market_listings').get().promoted_until,0);}
});
test('Callbacks need the unique callback key and recheck the provider; public paid flags are ignored',async()=>{
 const f=fixture(),p=provider({paid:true});const order=await createPromotion(f.env,owner,input(),origin,p);const before=p.calls.length;const bad=await handlePromotionsAPI(new Request(origin+'/api/promotions/callback?order='+order.id+'&key='+'0'.repeat(64)),f.env,p);assert.equal(bad.status,401);assert.equal(p.calls.length,before);
 const callback=new URL(p.callback);const paid=await handlePromotionsAPI(new Request(callback),f.env,p);assert.equal(paid.status,200);assert.equal(f.db.prepare('SELECT status FROM promotion_orders').get().status,'paid');await handlePromotionsAPI(new Request(callback),f.env,p);assert.equal(p.calls.filter(c=>c.path==='/v2/payment/check').length,1);
});
test('Paying a now-closed ad marks paid review without promoting it, and expired ads sort normally',async()=>{
 const f=fixture(),p=provider({paid:true});const order=await createPromotion(f.env,owner,input(),origin,p);f.db.prepare("UPDATE market_listings SET status='closed'").run();assert.equal((await verifyPromotion(f.env,order.id,p)).status,'paid_review');assert.equal(f.db.prepare('SELECT promoted_until FROM market_listings').get().promoted_until,0);
 const row=f.db.prepare('SELECT * FROM market_listings').get();row.status='published';row.promoted_until=Date.now()-1;const listing=publicListing(row);assert.equal(listing.featured,false);const imported={...listing,id:'UN-1',source:{},createdAt:Date.now()+1000};assert.equal(filterListings([imported,listing])[0].id,listing.id,'Darkhanzar ads stay ahead of newer imported ads');
});
test('Private order reads/checks and writes enforce identity and same origin; local status reads never query QPay',async()=>{
 const f=fixture(),p=provider(),order=await createPromotion(f.env,owner,input(),origin,p),before=p.calls.length;
 assert.equal((await handlePromotionsAPI(req('/api/promotions/order?id='+order.id,'GET',undefined,null),f.env,p)).status,401);assert.equal((await handlePromotionsAPI(req('/api/promotions/order?id='+order.id,'GET',undefined,{id:'other'}),f.env,p)).status,404);assert.equal((await handlePromotionsAPI(req('/api/promotions/check','POST',{id:order.id},owner,{Origin:'https://evil.test'}),f.env,p)).status,403);assert.equal((await handlePromotionsAPI(req('/api/promotions/order?id='+order.id),f.env,p)).status,200);assert.equal(p.calls.length,before);
});
test('401 refreshes a memory-only token once; dangerous bank links are removed while valid links are unchanged',async()=>{
 const f=fixture();let auth=0,requests=0;const options={fetcher:async url=>{if(url.endsWith('/auth/token')){auth++;return Response.json({access_token:'test-'+auth,expires_in:Math.floor(Date.now()/1000)+3600});}requests++;return requests===1?new Response(null,{status:401}):Response.json({ok:true});}};
 assert.deepEqual(await qpayRequest(f.env,'/v2/payment/check',{},options),{ok:true});assert.equal(auth,2);assert.equal(requests,2);await qpayRequest(f.env,'/v2/payment/check',{},options);assert.equal(auth,2);
 const d=invoiceDisplay({invoice_id:'i',qr_text:'q',qr_image:'YWJj',urls:[{name:'Bad',link:'javascript:alert(1)'},{name:'Bank',link:'bankapp://pay?code=unchanged%2B'}]});assert.deepEqual(d.urls.map(x=>x.link),['bankapp://pay?code=unchanged%2B']);
});
test('Native listing writes ignore forged ownership/status/featured, require owned media, and only real admins approve',async()=>{
 const f=fixture(),path=f.listing.images[0];f.db.prepare('INSERT INTO market_uploads VALUES (?,?,?)').run(path,owner.id,Date.now());const draft={...f.listing,condition:'used',subcategory:'Автомашин зарна',featured:true,status:'published',ownerId:'other'};
 let response=await handleMarketAPI(req('/api/market/listings','POST',draft),f.env);assert.equal(response.status,201);const {item}=await response.json();assert.equal(item.status,'pending');assert.equal(item.featured,false);assert.equal(item.ownerId,owner.id);assert.equal(item.persisted,true);
 response=await handleMarketAPI(req('/api/admin/listings','POST',{id:item.id,action:'approve'}),f.env);assert.equal(response.status,403);
 response=await handleMarketAPI(req('/api/market/listings','POST',{...draft,images:['/photos/car.jpg']}),f.env);assert.equal(response.status,400);
 response=await handleMarketAPI(req('/api/market/listings','POST',draft,{id:'other'}),f.env);assert.equal(response.status,403);
 const publicItems=await (await handleMarketAPI(req('/api/market/listings'),f.env)).json();assert.equal(publicItems.items.some(i=>i.id===item.id),false);
});
test('An open invoice prevents editing into a different-priced category',async()=>{
 const f=fixture(),p=provider();await createPromotion(f.env,owner,input(),origin,p);const path=f.listing.images[0];f.db.prepare('INSERT INTO market_uploads VALUES (?,?,?)').run(path,owner.id,Date.now());const response=await handleMarketAPI(req('/api/market/listings','POST',{...f.listing,id:'DZ-real',category:'property',condition:'used',subcategory:'Байр',phone:''}),f.env);assert.equal(response.status,409);assert.equal(JSON.parse(f.db.prepare('SELECT data_json FROM market_listings').get().data_json).category,'cars');
});
test('Stale admin approval cannot publish an edited listing',async()=>{
 const f=fixture();f.db.prepare("UPDATE market_listings SET status='pending'").run();const old=f.db.prepare('SELECT updated_at FROM market_listings').get().updated_at;f.db.prepare('UPDATE market_listings SET updated_at=updated_at+1').run();const admin={id:'real-admin'};const response=await handleMarketAPI(req('/api/admin/listings','POST',{id:'DZ-real',action:'approve',updatedAt:old},admin,{'oai-authenticated-user-email':'admin@example.test'}),f.env);assert.equal(response.status,409);assert.equal(f.db.prepare('SELECT status FROM market_listings').get().status,'pending');
});
test('A listing changed between quoting and reservation cannot receive an invoice',async()=>{
 const f=fixture(),p=provider();const original=f.env.DB.prepare.bind(f.env.DB);f.env.DB.prepare=sql=>{if(sql.startsWith('INSERT INTO promotion_orders'))f.db.prepare("UPDATE market_listings SET status='pending'").run();return original(sql);};await assert.rejects(createPromotion(f.env,owner,input(),origin,p),/Нэхэмжлэх үүсгэж/);assert.equal(p.calls.length,0);
});
test('Provider requests use Worker-supported redirect handling and never forward credentials to redirect targets',async()=>{
 const f=fixture(),calls=[];const options={fetcher:async(url,init)=>{calls.push(url);if(init.redirect!=='manual')throw new TypeError('Workers does not support redirect error');if(url.endsWith('/v2/auth/token'))return Response.json({access_token:'only-for-official-host',expires_in:Math.floor(Date.now()/1000)+3600});return new Response(null,{status:302,headers:{Location:'https://evil.example/steal'}});}};
 await assert.rejects(qpayRequest(f.env,'/v2/invoice',{},options),/QPAY_HTTP_302/);assert.equal(calls.length,2);assert(calls.every(url=>url.startsWith(f.env.QPAY_BASE_URL+'/')));
});
test('Native listing locations display Mongolian labels when an exact neighborhood is omitted',async()=>{
 const f=fixture(),path=f.listing.images[0];f.db.prepare('INSERT INTO market_uploads VALUES (?,?,?)').run(path,owner.id,Date.now());const response=await handleMarketAPI(req('/api/market/listings','POST',{...f.listing,place:'',condition:'used',subcategory:'Автомашин зарна',phone:''}),f.env);assert.equal(response.status,201);assert.equal((await response.json()).item.place,'Дархан');const row=f.db.prepare('SELECT * FROM market_listings WHERE id=?').get('DZ-real');row.data_json=JSON.stringify({...f.listing,place:'darkhan'});assert.equal(publicListing(row).place,'Дархан');
});

const adminWho={id:'admin-1',name:'Админ'};
const adminHeaders={'oai-authenticated-user-email':'admin@example.test','oai-authenticated-user-role':'admin'};
test('Admin makes any live ad featured for free, extends it, and can end it; non-admins cannot',async()=>{
 const {env,db}=fixture(),feature=(body,who=adminWho,extra=adminHeaders)=>handleMarketAPI(req('/api/admin/listings/feature','POST',body,who,extra),env);
 assert.equal((await feature({id:'DZ-real',days:7},owner,{})).status,403);
 const day=86400000,first=await feature({id:'DZ-real',days:7});assert.equal(first.status,200);
 const until=(await first.json()).promotedUntil;assert(Math.abs(until-(Date.now()+7*day))<5000);
 assert.equal(publicListing(db.prepare('SELECT * FROM market_listings').get()).featured,true);
 const extended=await (await feature({id:'DZ-real',days:3})).json();assert(Math.abs(extended.promotedUntil-(until+3*day))<5000,'extends from the current end');
 assert.equal((await feature({id:'DZ-real',days:0})).status,200);assert.equal(db.prepare('SELECT promoted_until FROM market_listings').get().promoted_until,0);
 for(const days of [-1,400,1.5,'x'])assert.equal((await feature({id:'DZ-real',days})).status,400,String(days));
 db.prepare("UPDATE market_listings SET status='pending'").run();assert.equal((await feature({id:'DZ-real',days:7})).status,404,'only published ads');
 const list=await (await handleMarketAPI(req('/api/admin/listings?scope=published','GET',undefined,adminWho,adminHeaders),env)).json();assert.deepEqual(list.items,[]);
});
test('Admin-posted ads are published at once; ordinary users still go to review',async()=>{
 const {env,db}=fixture(),image='/api/listing-media/22222222-2222-4222-8222-222222222222.jpg',userImage='/api/listing-media/33333333-3333-4333-8333-333333333333.jpg';
 db.prepare('INSERT INTO market_uploads (path,owner_id,created_at) VALUES (?,?,?)').run(image,adminWho.id,Date.now());db.prepare('INSERT INTO market_uploads (path,owner_id,created_at) VALUES (?,?,?)').run(userImage,owner.id,Date.now());
 const draft=img=>({title:'Шинэ хөргөгч зарна',description:'Цэвэрхэн хэрэглэсэн хөргөгч, ажиллагаа сайн.',category:'electronics',subcategory:'',region:'darkhan',place:'Дархан',price:300000,images:[img],condition:'used',negotiable:false,attributes:{},phone:'88112233'});
 const asAdmin=await handleMarketAPI(req('/api/market/listings','POST',draft(image),adminWho,adminHeaders),env);assert.equal(asAdmin.status,201);assert.equal((await asAdmin.json()).item.status,'published');
 const asUser=await handleMarketAPI(req('/api/market/listings','POST',draft(userImage),owner),env);assert.equal(asUser.status,201);assert.equal((await asUser.json()).item.status,'pending');
});