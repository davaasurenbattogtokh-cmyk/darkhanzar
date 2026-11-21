import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {listingShare} from '../server/listing-share.mjs';

function env(){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE market_listings (id TEXT PRIMARY KEY, owner_id TEXT, data_json TEXT, status TEXT, created_at INTEGER, updated_at INTEGER, promoted_until INTEGER DEFAULT 0)');
 const add=(id,status,data)=>db.prepare('INSERT INTO market_listings VALUES (?,?,?,?,1,1,0)').run(id,'owner',JSON.stringify(data),status);
 add('DZ-1','published',{title:'Toyota Prius 30',description:'Цэвэрхэн,   нэг эзэнтэй.\nДарханд.',price:25000000,place:'darkhan',images:['/api/media/a.jpg']});
 add('DZ-2','pending',{title:'Нууц зар',description:'x',price:1,place:'darkhan',images:[]});
 const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)||null;}});
 return {DB:{prepare:sql=>stmt(sql)}};
}

test('Shared ad links get a preview only for published ads with safe ids',async()=>{
 const e=env();
 const item=await listingShare(e,'DZ-1');
 assert.equal(item.title,'Toyota Prius 30');assert.equal(item.image,'/api/media/a.jpg');
 assert.equal(item.description,'Цэвэрхэн, нэг эзэнтэй. Дарханд.');assert.match(item.price,/25.000.000 ₮/);
 assert.equal(await listingShare(e,'DZ-2'),null,'unpublished ads stay private');
 assert.equal(await listingShare(e,'missing'),null);
 for(const bad of ["x' OR 1=1--",'../etc','',null,'a'.repeat(200)])assert.equal(await listingShare(e,bad),null);
});
