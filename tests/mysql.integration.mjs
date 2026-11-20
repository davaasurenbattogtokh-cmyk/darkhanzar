import test from 'node:test';
import assert from 'node:assert/strict';
import {createPool,MySQLDatabase,MySQLBucket} from '../server/node/mysql.mjs';
import {migrate} from '../server/node/migrate.mjs';
import {handleApplication} from '../server/node/application.mjs';
import {handleAuth,authenticatedUser} from '../server/node/auth.mjs';
import {createPromotion,verifyPromotion} from '../server/promotions-api.mjs';
import {defaultSettings} from '../src/lib/site-settings.mjs';
const origin='https://darkhanzar.test';
test('MySQL: persistence, atomic revisions, session boundary, owned listing, duplicate invoice and paid activation',async()=>{
 assert(process.env.DB_NAME?.endsWith('_test'),'Integration tests require a dedicated *_test database');
 const pool=createPool(process.env),env={...process.env,ADMIN_EMAIL:'owner@example.test',SETUP_TOKEN:'fixture-setup-token-32-characters-long',DB:new MySQLDatabase(pool),BUCKET:new MySQLBucket(pool)};
 const req=(path,method='GET',body,cookie)=>new Request(origin+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  await migrate(pool,env);
  const run=(sql,...args)=>env.DB.prepare(sql).bind(...args).run();
  for(const table of ['promotion_orders','market_listings','market_uploads','auth_sessions','auth_users','auth_limits','admin_audit'])await pool.query(`DELETE FROM ${table}`);
  await pool.execute('DELETE FROM source_sync_runs WHERE day=?',['2099-01-01']);
  let response=await handleApplication(new Request(origin+'/api/admin/session',{headers:{'oai-authenticated-user-id':'forged','oai-authenticated-user-email':env.ADMIN_EMAIL}}),env,pool,'fixture');assert.equal((await response.json()).authorized,false);
  const form=async(kind,fields)=>handleAuth(new Request(origin+'/api/auth/'+kind,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)}),pool,env,'fixture');
  response=await form('setup',{email:env.ADMIN_EMAIL,name:'Админ',password:'fixture-password-123',setup_token:env.SETUP_TOKEN});assert.equal(response.status,303);const adminCookie=response.headers.get('set-cookie').split(';')[0];
  response=await form('register',{email:'seller@example.test',name:'Зарын эзэн',password:'fixture-password-123'});assert.equal(response.status,303);const cookie=response.headers.get('set-cookie').split(';')[0],who=await authenticatedUser(req('/', 'GET',null,cookie),pool);assert.equal(who.name,'Зарын эзэн');
  assert.equal((await form('setup',{email:env.ADMIN_EMAIL,name:'Hijack',password:'attacker-password-123',setup_token:env.SETUP_TOKEN})).status,200);
  response=await handleApplication(req('/api/admin/session','GET',null,cookie),env,pool,'fixture');assert.equal((await response.json()).authorized,false);
  const record=await env.DB.prepare('SELECT revision FROM site_settings WHERE id=1').first();
  const settings=structuredClone(defaultSettings);settings.promotionPlans[1]={...settings.promotionPlans[1],enabled:true,price:5000,categoryPrices:{cars:10000}};
  const attempts=await Promise.all([0,1].map(()=>handleApplication(req('/api/admin/settings','PUT',{settings,revision:record.revision},adminCookie),env,pool,'fixture')));assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM admin_audit').first()).count,1);
  const jpeg=new Uint8Array([255,216,255,...new Array(30).fill(0)]);await env.BUCKET.put('listing-media/11111111-1111-4111-8111-111111111111.jpg',jpeg,{httpMetadata:{contentType:'image/jpeg'}});assert.deepEqual(new Uint8Array(await (await env.BUCKET.get('listing-media/11111111-1111-4111-8111-111111111111.jpg')).arrayBuffer()),jpeg);
  const path='/api/listing-media/11111111-1111-4111-8111-111111111111.jpg';await run('INSERT INTO market_uploads (path,owner_id,created_at) VALUES (?,?,?)',path,who.id,Date.now());
  const draft={title:'MySQL integration fixture',description:'Private automated fixture listing for database verification.',category:'cars',subcategory:'Toyota',price:1000000,region:'darkhan',images:[path],condition:'used',phone:'99999999',attributes:{}};
  response=await handleApplication(req('/api/market/listings','POST',draft,cookie),env,pool,'fixture');assert.equal(response.status,201,JSON.stringify(await response.clone().json()));let item=(await response.json()).item;assert.equal(item.status,'pending');
  response=await handleApplication(req('/api/admin/listings','POST',{id:item.id,action:'approve',updatedAt:item.updatedAt},adminCookie),env,pool,'fixture');assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  // The source ledger uses RETURNING leases and MySQL publication upserts.
  await run('INSERT INTO source_sync_runs (day,run_id,status,state_json,lease_until,updated_at) VALUES (?,?,?,?,0,?) ON CONFLICT(day) DO NOTHING','2099-01-01','fixture-run','running','{}','fixture');
  assert(await env.DB.prepare('UPDATE source_sync_runs SET lease_until=? WHERE run_id=? AND status=? AND lease_until<? RETURNING run_id').bind(9999,'fixture-run','running',1).first());
  assert.equal(await env.DB.prepare('UPDATE source_sync_runs SET lease_until=? WHERE run_id=? AND status=? AND lease_until<? RETURNING run_id').bind(9999,'fixture-run','running',1).first(),null);
  const providerEnv={...env,QPAY_ENABLED:'true',QPAY_BASE_URL:'https://merchant.qpay.mn',QPAY_USERNAME:'fixture',QPAY_PASSWORD:'fixture',QPAY_INVOICE_CODE:'fixture',QPAY_SITE_ORIGIN:origin};let invoices=0;
  const fetcher=async(url)=>{const p=new URL(url).pathname;if(p==='/v2/auth/token')return Response.json({access_token:'fixture',expires_in:Math.floor(Date.now()/1000)+3600});if(p==='/v2/invoice'){invoices++;return Response.json({invoice_id:'fixture-invoice',qr_image:'AA==',urls:[]});}if(p==='/v2/payment/check')return Response.json({count:1,rows:[{payment_id:'fixture-payment'}]});if(p==='/v2/payment/fixture-payment')return Response.json({payment_id:'fixture-payment',payment_status:'PAID',payment_currency:'MNT',payment_amount:'10000',object_type:'INVOICE',object_id:'fixture-invoice'});throw Error(p);};
  const orders=await Promise.all([0,1].map(()=>createPromotion(providerEnv,who,{listingId:item.id,planId:'special-7',requestId:crypto.randomUUID()},origin,{fetcher})));assert.equal(orders[0].id,orders[1].id);assert.equal(invoices,1);
  const paid=await verifyPromotion(providerEnv,orders[0].id,{fetcher});assert.equal(paid.status,'paid');const before=(await env.DB.prepare('SELECT promoted_until FROM market_listings WHERE id=?').bind(item.id).first()).promoted_until;assert(before>Date.now());await verifyPromotion(providerEnv,orders[0].id,{fetcher});assert.equal((await env.DB.prepare('SELECT promoted_until FROM market_listings WHERE id=?').bind(item.id).first()).promoted_until,before);
  await migrate(pool,env);assert.equal((await env.DB.prepare('SELECT status FROM promotion_orders WHERE id=?').bind(paid.id).first()).status,'paid');
 }finally{await pool.end();}
});
