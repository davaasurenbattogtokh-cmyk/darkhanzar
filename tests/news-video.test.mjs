import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {normalizeVideo,youtubeIdFromUrl,youtubeThumb,youtubeEmbed} from '../src/lib/news-video.mjs';
import {cleanArticle,listVideos} from '../server/news-store.mjs';
import {handleNewsAPI} from '../server/news-api.mjs';

const origin='https://darkhan.example';
const ID='dQw4w9WgXcQ';
function fixture(extraEnv={}){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE news_articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL, cover TEXT NOT NULL DEFAULT '', video TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, author_id TEXT NOT NULL, author_name TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER NOT NULL DEFAULT 0)`);
 const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {};}});
 return {env:{ADMIN_EMAIL:'owner@example.test',DB:{prepare:sql=>stmt(sql)},...extraEnv}};
}
const editor={'oai-authenticated-user-id':'ed','oai-authenticated-user-full-name':'Bat','oai-authenticated-user-role':'editor'};
const post=(body,env)=>handleNewsAPI(new Request(origin+'/api/admin/news',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...editor},body:JSON.stringify(body)}),env);
const article=(extra={})=>({title:'Дарханы видео мэдээ нэг',summary:'',body:'Бичвэр.',category:'economy',cover:'',status:'published',featured:false,...extra});

test('YouTube links of every common shape normalise to yt:<id>; other input is rejected',()=>{
 for(const url of [`https://www.youtube.com/watch?v=${ID}&t=10`,`https://youtu.be/${ID}?si=x`,`https://m.youtube.com/watch?v=${ID}`,`https://www.youtube.com/shorts/${ID}`,`https://www.youtube.com/embed/${ID}`,`https://www.youtube.com/live/${ID}`,ID])assert.equal(normalizeVideo(url),`yt:${ID}`,url);
 assert.equal(normalizeVideo(''),'');assert.equal(normalizeVideo(`yt:${ID}`),`yt:${ID}`);
 assert.equal(normalizeVideo('/api/news/video/0a1b2c3d-1111-2222-3333-444455556666.mp4'),'/api/news/video/0a1b2c3d-1111-2222-3333-444455556666.mp4');
 for(const bad of ['https://evil.test/watch?v='+ID,'https://vimeo.com/123','javascript:alert(1)','/api/news/video/../../etc/passwd','yt:short'])assert.equal(normalizeVideo(bad),null,bad);
 assert.equal(youtubeIdFromUrl('https://youtube.com.evil.test/watch?v='+ID),null);
 assert.equal(youtubeThumb(`yt:${ID}`),`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
 assert.equal(youtubeEmbed(`yt:${ID}`),`https://www.youtube-nocookie.com/embed/${ID}?rel=0`);
 assert.equal(youtubeThumb('/api/news/video/x.mp4'),'');
});

test('A video article may have no body; bad links are refused; videos feed lists only published video news',async()=>{
 assert.equal(cleanArticle(article({body:'',video:`https://youtu.be/${ID}`})).video,`yt:${ID}`);
 assert.throws(()=>cleanArticle(article({video:'https://vimeo.com/1'})));
 assert.throws(()=>cleanArticle(article({body:''})));
 const {env}=fixture();
 assert.equal((await post(article({title:'Видеогүй энгийн мэдээ'}),env)).status,201);
 assert.equal((await post(article({title:'Ноорог видео мэдээ',video:ID,status:'draft'}),env)).status,201);
 const r=await post(article({video:`https://www.youtube.com/watch?v=${ID}`,body:''}),env);assert.equal(r.status,201);
 const item=(await r.json()).item;assert.equal(item.video,`yt:${ID}`);
 const feed=await listVideos(env,{limit:3});assert.equal(feed.total,1);assert.deepEqual(feed.items.map(i=>i.id),[item.id]);
 const api=await (await handleNewsAPI(new Request(origin+'/api/news?videos=3'),env)).json();
 assert.deepEqual(api.items.map(i=>i.video),[`yt:${ID}`]);
});

test('Video upload is staff-only, sniffs the file, and is served back with Range support',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'dz-video-'));
 try{
  const {env}=fixture({VIDEO_DIR:dir});
  const mp4=Buffer.concat([Buffer.from([0,0,0,0x18]),Buffer.from('ftypmp42'),Buffer.alloc(4096,7)]);
  const upload=(body,type,headers=editor,from=origin)=>handleNewsAPI(new Request(origin+'/api/admin/news/video',{method:'POST',headers:{Origin:from,'Content-Type':type,...headers},body}),env);
  assert.equal((await upload(mp4,'video/mp4',{})).status,401);
  assert.equal((await upload(mp4,'video/mp4',editor,'https://evil.test')).status,403);
  assert.equal((await upload(mp4,'image/png')).status,415);
  assert.equal((await upload(Buffer.alloc(4096,1),'video/mp4')).status,400,'not a video');
  const r=await upload(mp4,'video/quicktime');assert.equal(r.status,201);
  const {url}=await r.json();assert.match(url,/^\/api\/news\/video\/[a-f0-9-]{36}\.mp4$/);
  assert.deepEqual((await readdir(dir)).filter(f=>f.endsWith('.part')),[],'no temp files left');
  const full=await handleNewsAPI(new Request(origin+url),env);
  assert.equal(full.status,200);assert.equal(full.headers.get('Content-Type'),'video/mp4');
  assert.equal(Buffer.from(await full.arrayBuffer()).length,mp4.length);
  const part=await handleNewsAPI(new Request(origin+url,{headers:{Range:'bytes=4-11'}}),env);
  assert.equal(part.status,206);assert.equal(part.headers.get('Content-Range'),`bytes 4-11/${mp4.length}`);
  assert.equal(Buffer.from(await part.arrayBuffer()).toString('latin1'),'ftypmp42');
  assert.equal((await handleNewsAPI(new Request(origin+url,{headers:{Range:`bytes=${mp4.length+5}-`}}),env)).status,416);
  assert.equal((await handleNewsAPI(new Request(origin+'/api/news/video/..%2F..%2Fetc%2Fpasswd'),env)).status,404);
  assert.equal((await handleNewsAPI(new Request(origin+'/api/news/video/0a1b2c3d-1111-2222-3333-444455556666.mp4'),env)).status,404);
  // The uploaded path is accepted as an article video.
  assert.equal((await post(article({video:url,body:''}),env)).status,201);
 }finally{await rm(dir,{recursive:true,force:true});}
});
