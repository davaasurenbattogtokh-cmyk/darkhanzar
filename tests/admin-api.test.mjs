import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleAdminAPI,adminIdentity,validMutationOrigin} from '../server/admin-api.mjs';
import {defaultSettings,cleanSettings} from '../src/lib/site-settings.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_bumpy_klaw.sql',import.meta.url),'utf8'));
 const objects=new Map();
 const env={ADMIN_EMAIL:'owner@example.test',DB:{prepare(sql){return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return db.prepare(sql).get(...this.args)||null;}};},async batch(statements){db.exec('BEGIN');try{const out=statements.map(s=>({results:db.prepare(s.sql).all(...s.args)}));db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}},BUCKET:{async put(k,v,meta){objects.set(k,{body:v,httpMetadata:meta.httpMetadata});},async get(k){return objects.get(k);}}};
 return {env,db,objects};
}
function request(path,method='GET',body,extra={}){return new Request('https://darkhan.example'+path,{method,headers:{Origin:'https://darkhan.example','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test',...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});}
test('Settings writes require authenticated owner identity and same-origin request',async()=>{
 const {env}=fixture();assert.equal((await handleAdminAPI(new Request('https://darkhan.example/api/admin/settings',{method:'PUT'}),env)).status,401);
 assert.equal((await handleAdminAPI(request('/api/admin/settings','PUT',{settings:defaultSettings,revision:0},{'oai-authenticated-user-email':'other@example.test'}),env)).status,403);
 assert.equal((await handleAdminAPI(request('/api/admin/settings','PUT',{settings:defaultSettings,revision:0},{Origin:'https://other.example'}),env)).status,403);
 assert.equal(adminIdentity(request('/'),{}).authorized,false);assert.equal(validMutationOrigin(request('/','PUT')),true);
});
test('Banner and pricing persist together; stale revisions cannot overwrite them',async()=>{
 const {env,db}=fixture();const settings=structuredClone(defaultSettings);settings.banner.title='Шинэ баннер';settings.promotionPlans[0]={...settings.promotionPlans[0],price:5000,enabled:true,categoryPrices:{cars:7000}};
 let response=await handleAdminAPI(request('/api/admin/settings','PUT',{settings,revision:0}),env);assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
 response=await handleAdminAPI(request('/api/admin/settings','PUT',{settings,revision:0}),env);assert.equal(response.status,409);
 settings.banner.title='Дахин шинэчлэв';response=await handleAdminAPI(request('/api/admin/settings','PUT',{settings,revision:1}),env);assert.equal(response.status,200);
 const stored=await (await handleAdminAPI(new Request('https://darkhan.example/api/settings'),env)).json();assert.equal(stored.revision,2);assert.equal(stored.settings.banner.title,'Дахин шинэчлэв');assert.equal(stored.settings.promotionPlans[0].categoryPrices.cars,7000);assert.equal(db.prepare('SELECT count(*) AS n FROM admin_audit').get().n,2);
});
test('Settings reject executable links, external image paths and invalid prices',()=>{
 for(const mutate of [s=>s.banner.href='javascript:alert(1)',s=>s.banner.desktopImage='https://evil.example/image.svg',s=>s.promotionPlans[0].price=-1,s=>s.promotionPlans[0].days=0,s=>s.promotionPlans.push(s.promotionPlans[0])]){const settings=structuredClone(defaultSettings);mutate(settings);assert.throws(()=>cleanSettings(settings));}
});
test('Banner upload validates bytes, requires owner and serves immutable image MIME',async()=>{
 const {env,objects}=fixture();const form=new FormData();form.set('file',new File(['<svg onload="alert(1)"/>'],'x.png',{type:'image/png'}));
 let response=await handleAdminAPI(new Request('https://darkhan.example/api/admin/upload',{method:'POST',headers:{Origin:'https://darkhan.example','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test'},body:form}),env);assert.equal(response.status,400);assert.equal(objects.size,0);
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aoxsAAAAASUVORK5CYII=','base64'));const good=new FormData();good.set('file',new File([png],'banner.png',{type:'image/png'}));response=await handleAdminAPI(new Request('https://darkhan.example/api/admin/upload',{method:'POST',headers:{Origin:'https://darkhan.example','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test'},body:good}),env);assert.equal(response.status,201);const {url}=await response.json();const media=await handleAdminAPI(new Request('https://darkhan.example'+url),env);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await media.arrayBuffer()),png);
});
test('Legacy banner data keeps its image, disabled state, prices and revision when adding placements',async()=>{
 const {env,db}=fixture();const legacy={banner:{...defaultSettings.banner,enabled:false,title:'Хуучин баннер',desktopImage:'/api/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg'},promotionPlans:[{id:'existing-price',label:'Хуучин багц',days:9,price:25000,enabled:true,categoryPrices:{property:35000}}]};
 db.prepare('INSERT INTO site_settings VALUES (1,?,?,?,?)').run(JSON.stringify(legacy),7,'2026-11-17','existing-owner');
 const data=await (await handleAdminAPI(new Request('https://darkhan.example/api/settings'),env)).json();
 assert.deepEqual(data.settings.bannerPlacements.homeTop,legacy.banner);assert.deepEqual(data.settings.promotionPlans,legacy.promotionPlans);assert.equal(data.revision,7);assert.equal(data.settings.bannerPlacements.categoryTop.title,defaultSettings.bannerPlacements.categoryTop.title);
 data.settings.bannerPlacements.categoryTop={...data.settings.bannerPlacements.categoryTop,title:'Ангиллын шинэ баннер',enabled:false};
 const saved=await handleAdminAPI(request('/api/admin/settings','PUT',{settings:data.settings,revision:7}),env);assert.equal(saved.status,200);
 const result=await saved.json();assert.equal(result.settings.bannerPlacements.categoryTop.title,'Ангиллын шинэ баннер');assert.deepEqual(result.settings.bannerPlacements.homeTop,legacy.banner);assert.deepEqual(result.settings.promotionPlans,legacy.promotionPlans);
});
test('GIF banner uploads retain animation bytes and a safe image content type',async()=>{
 const {env}=fixture();const bytes=Uint8Array.from(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));const form=new FormData();form.set('file',new File([bytes],'banner.gif',{type:'image/gif'}));
 const response=await handleAdminAPI(new Request('https://darkhan.example/api/admin/upload',{method:'POST',headers:{Origin:'https://darkhan.example','oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.test'},body:form}),env);assert.equal(response.status,201);const {url}=await response.json();assert(url.endsWith('.gif'));const media=await handleAdminAPI(new Request('https://darkhan.example'+url),env);assert.equal(media.headers.get('Content-Type'),'image/gif');assert.deepEqual(new Uint8Array(await media.arrayBuffer()),bytes);
});
