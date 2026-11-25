import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {cleanPath,referrerHost,isBot,deviceOf,recordVisit,visitStats,pruneVisits,handleVisitAPI,visitDay} from '../server/visits.mjs';

const UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const PC='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE site_visits (id TEXT PRIMARY KEY, day TEXT, visitor TEXT, path TEXT, referrer TEXT, device TEXT, created_at INTEGER);
  CREATE TABLE visit_salts (day TEXT PRIMARY KEY, salt TEXT);
  CREATE TABLE market_listings (id TEXT PRIMARY KEY, owner_id TEXT, data_json TEXT, status TEXT, created_at INTEGER, updated_at INTEGER, promoted_until INTEGER DEFAULT 0);`);
 db.prepare("INSERT INTO market_listings VALUES ('DZ-1','a',?, 'published',1,1,0)").run(JSON.stringify({title:'Prius 30 зарна'}));
 const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {};}});
 return {db,env:{ADMIN_EMAIL:'owner@example.test',DB:{prepare:sql=>stmt(sql)}}};
}

test('Only own page paths are kept (plus an opened ad); admin, API and foreign URLs are dropped',()=>{
 assert.equal(cleanPath('/'),'/');
 assert.equal(cleanPath('/news/video/'),'/news/video');
 assert.equal(cleanPath('/?ad=DZ-8978d671-2ec5&q=secret'),'/?ad=DZ-8978d671-2ec5');
 assert.equal(cleanPath('/?q=99112233'),'/');
 for(const bad of ['/admin','/api/visit','https://evil.test/x','//evil.test/x','/_next/static/a.js',''])assert.equal(cleanPath(bad),'',bad);
 assert.equal(referrerHost('https://m.facebook.com/story.php?id=1','darkhanzar.mn'),'facebook.com');
 assert.equal(referrerHost('https://darkhanzar.mn/news','darkhanzar.mn'),'');
 assert.equal(referrerHost('javascript:alert(1)','darkhanzar.mn'),'');
 assert(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)'));assert(isBot('facebookexternalhit/1.1'));assert(isBot(''));assert(!isBot(UA));
 assert.equal(deviceOf(UA),'mobile');assert.equal(deviceOf(PC),'desktop');
});

test('Visitors are counted once per day per device; no IP address is stored',async()=>{
 const {db,env}=fixture(),now=Date.parse('2026-11-25T10:00:00+08:00');
 await recordVisit(env,{path:'/',referrer:'https://www.facebook.com/',ip:'203.0.113.7',ua:UA,siteHost:'darkhanzar.mn',now});
 await recordVisit(env,{path:'/?ad=DZ-1',ip:'203.0.113.7',ua:UA,siteHost:'darkhanzar.mn',now:now+1000});
 await recordVisit(env,{path:'/news',ip:'198.51.100.2',ua:PC,siteHost:'darkhanzar.mn',now:now+2000});
 assert.equal(await recordVisit(env,{path:'/',ip:'198.51.100.9',ua:'Googlebot/2.1',siteHost:'darkhanzar.mn',now}),false);
 const rows=db.prepare('SELECT * FROM site_visits').all();
 assert.equal(rows.length,3);
 assert(!JSON.stringify(rows).includes('203.0.113.7')&&!JSON.stringify(rows).includes('198.51.100.2'),'no raw IPs');
 const s=await visitStats(env,{days:7,now:now+3000});
 assert.deepEqual(s.today,{visitors:2,views:3});
 assert.equal(s.online,2);assert.equal(s.series.length,7);assert.equal(s.series.at(-1).day,'2026-11-25');
 assert.equal(s.pages.find(p=>p.name==='/?ad=DZ-1').title,'Prius 30 зарна');
 assert.deepEqual(s.referrers.map(r=>r.name),['facebook.com']);
 assert.deepEqual(s.devices.map(d=>d.name).sort(),['desktop','mobile']);
 // A new day uses a new salt, so the same device cannot be linked across days.
 await recordVisit(env,{path:'/',ip:'203.0.113.7',ua:UA,siteHost:'darkhanzar.mn',now:now+86400000});
 const [a,b]=db.prepare('SELECT DISTINCT visitor FROM site_visits WHERE path=? ORDER BY created_at').all('/').map(r=>r.visitor);
 assert.notEqual(a,b);
 await pruneVisits(env,now+86400000*2);
 assert.deepEqual(db.prepare('SELECT day FROM visit_salts').all().map(r=>r.day),[visitDay(now+86400000)]);
});

test('Visit API: same-origin beacons only; stats are admin-only',async()=>{
 const {db,env}=fixture(),origin='https://darkhanzar.mn';
 const beacon=(headers={})=>new Request(origin+'/api/visit',{method:'POST',headers:{Origin:origin,'User-Agent':UA,'Content-Type':'application/json',...headers},body:JSON.stringify({path:'/news'})});
 assert.equal((await handleVisitAPI(beacon(),env,'203.0.113.7')).status,204);
 assert.equal((await handleVisitAPI(beacon({Origin:'https://evil.test'}),env,'1.1.1.1')).status,403);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM site_visits').get().n,1);
 const stats=headers=>handleVisitAPI(new Request(origin+'/api/admin/visits?days=30',{headers}),env);
 assert.equal((await stats({})).status,403);
 const ok=await stats({'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-role':'admin','oai-authenticated-user-id':'admin-1'});
 assert.equal(ok.status,200);assert.equal((await ok.json()).period.views,1);
 assert.equal(await handleVisitAPI(new Request(origin+'/api/other'),env),null);
});
