import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {highlights} from '../server/news-store.mjs';
import {listingHighlights} from '../server/listing-highlights.mjs';
import {handleNewsAPI} from '../server/news-api.mjs';
import {defaultSettings,cleanSettings,normalizeSiteSettings} from '../src/lib/site-settings.mjs';

function newsDb(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE news_articles (id TEXT PRIMARY KEY, slug TEXT, title TEXT, summary TEXT, body TEXT, category TEXT, cover TEXT DEFAULT '', status TEXT, featured INTEGER DEFAULT 0, author_id TEXT, author_name TEXT, views INTEGER DEFAULT 0, created_at INTEGER, updated_at INTEGER, published_at INTEGER DEFAULT 0, video TEXT DEFAULT '')`);
 const add=(id,status,featured,at)=>db.prepare("INSERT INTO news_articles VALUES (?,?,?,'','x','economy','',?,?,'a','A',0,?,?,?,'')").run(id,id,id,status,featured,at,at,at);
 add('old-featured','published',1,100);add('new','published',0,300);add('newer','published',0,400);add('draft','draft',1,500);add('newest-featured','published',1,200);
 const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;}});
 return {DB:{prepare:sql=>stmt(sql)}};
}

test('Marketplace news rail: featured articles first, then the latest, never drafts',async()=>{
 const env=newsDb();
 assert.deepEqual((await highlights(env,4)).map(a=>a.id),['newest-featured','old-featured','newer','new']);
 assert.deepEqual((await highlights(env,1)).map(a=>a.id),['newest-featured']);
 const r=await handleNewsAPI(new Request('https://x.test/api/news?highlights=99'),env);
 assert.equal(r.status,200);assert.equal((await r.json()).items.length,4,'limit is capped and drafts are excluded');
});

test('News sidebar listing count is an admin setting between 0 and 20, default 5',()=>{
 assert.equal(defaultSettings.newsSidebarListings,5);
 assert.equal(normalizeSiteSettings({}).newsSidebarListings,5,'old saved settings get the default');
 assert.equal(cleanSettings({...defaultSettings,newsSidebarListings:8}).newsSidebarListings,8);
 assert.equal(cleanSettings({...defaultSettings,newsSidebarListings:0}).newsSidebarListings,0);
 for(const bad of [21,-1])assert.throws(()=>cleanSettings({...defaultSettings,newsSidebarListings:bad}));
 for(const odd of [2.5,'5',null])assert.equal(cleanSettings({...defaultSettings,newsSidebarListings:odd}).newsSidebarListings,5,'non-integers fall back to the default');
});

test('News sidebar listings: promoted Darkhanzar ads first, then newest; 0 hides the box',async()=>{
 const now=Date.now();
 const rows=[
  {id:'a',owner_id:'u',status:'published',created_at:3,updated_at:3,promoted_until:0,data_json:JSON.stringify({title:'Шинэ',price:1000,place:'Дархан',images:['/api/listing-media/a.jpg']})},
  {id:'b',owner_id:'u',status:'published',created_at:1,updated_at:1,promoted_until:now+86400000,data_json:JSON.stringify({title:'Онцгой',price:2000,place:'Дархан',images:[]})},
 ];
 const env={DB:{prepare:sql=>({bind:(...args)=>({async all(){assert.match(sql,/ORDER BY \(promoted_until>\?\) DESC/);return {results:[...rows].sort((x,y)=>Number(y.promoted_until>args[0])-Number(x.promoted_until>args[0])||y.created_at-x.created_at)};},async first(){return null;}}),async first(){return null;}})}};
 const items=await listingHighlights(env,5);
 assert.deepEqual(items.map(i=>[i.id,i.featured,i.href]),[['b',true,'/?ad=b'],['a',false,'/?ad=a']]);
 assert.equal(items[1].image,'/api/listing-media/a.jpg');
 assert.deepEqual(await listingHighlights(env,0),[]);
});
