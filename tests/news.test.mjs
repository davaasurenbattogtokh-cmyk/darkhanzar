import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseArticle,parseInline,plainText} from '../src/lib/news-markup.mjs';
import {slugify,cleanArticle,listPublished,featuredArticle,mostRead,publishedBySlug,countView,sitemapEntries} from '../server/news-store.mjs';
import {handleNewsAPI} from '../server/news-api.mjs';

const origin='https://darkhan.example';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE news_articles (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, body TEXT NOT NULL, category TEXT NOT NULL, cover TEXT NOT NULL DEFAULT '', video TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, author_id TEXT NOT NULL, author_name TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER NOT NULL DEFAULT 0)`);
 const stmt=(sql,args=[])=>({sql,args,bind:(...a)=>stmt(sql,a),async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){db.prepare(sql).run(...args);return {};}});
 return {db,env:{ADMIN_EMAIL:'owner@example.test',DB:{prepare:sql=>stmt(sql)}}};
}
const staff=role=>({'oai-authenticated-user-id':role+'-id','oai-authenticated-user-full-name':encodeURIComponent('Бат'),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8',...(role==='admin'?{'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-role':'admin'}:role==='editor'?{'oai-authenticated-user-role':'editor'}:{})});
const req=(method,body,headers,path='/api/admin/news')=>new Request(origin+path,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const article=(extra={})=>({title:'Дарханы эдийн засаг өсөв',summary:'',body:'Эхний догол мөр **тод** үгтэй.\n\n## Дэд гарчиг\n- нэг\n- хоёр',category:'economy',cover:'',status:'published',featured:false,...extra});

test('Article markup is parsed into a safe tree: no raw HTML, unsafe links and images dropped',()=>{
 const blocks=parseArticle('## Гарчиг\nЭнгийн *налуу* ба [холбоос](https://example.mn) <script>x</script>\n\n- a\n- b\n\n1. c\n> ишлэл\n![зураг](/api/media/0a1b2c3d-1111-2222-3333-444455556666.jpg)\n![муу](javascript:alert(1))\n[муу](javascript:alert(1))');
 assert.deepEqual(blocks.map(b=>b.t),['h2','p','list','list','quote','img','p']);
 assert.equal(blocks[1].c.find(i=>i.t==='link').href,'https://example.mn');
 assert(blocks[1].c.some(i=>i.t==='text'&&i.v.includes('<script>')),'HTML stays as plain text');
 assert.equal(blocks[2].ordered,false);assert.equal(blocks[3].ordered,true);
 assert.equal(blocks.filter(b=>b.t==='img').length,1,'only the /api/media image is kept');
 assert(blocks.at(-1).c.every(i=>i.t==='text'),'javascript: links become plain text');
 assert(!JSON.stringify(blocks).includes('"href":"javascript'));
 assert.deepEqual(parseInline('**a** *b*').map(i=>i.t),['strong','text','em']);
 assert.equal(plainText('## H\nНэг хоёр гурав',8),'Нэг…');
});

test('Slugs transliterate Mongolian Cyrillic; articles are validated',()=>{
 assert.equal(slugify('Дархан хотын Өргөөгийн шинэ төсөл!','abc123'),'darkhan-khotyn-urguugiin-shine-tusul-abc123');
 assert.equal(slugify('!!!','x1'),'medee-x1');
 assert.equal(cleanArticle(article()).summary,'Эхний догол мөр тод үгтэй.');
 for(const bad of [{title:'abc'},{category:'sports'},{cover:'https://evil.test/x.jpg'},{status:'live'},{body:'   '}])assert.throws(()=>cleanArticle(article(bad)));
});

test('Only admins and editors manage news; drafts stay private; mutations must be same-origin',async()=>{
 const {env}=fixture();
 assert.equal((await handleNewsAPI(req('GET',null,{}),env)).status,401);
 assert.equal((await handleNewsAPI(req('GET',null,staff('user')),env)).status,403);
 assert.equal((await handleNewsAPI(req('POST',article(),staff('user')),env)).status,403);
 let r=await handleNewsAPI(req('POST',article({status:'draft',title:'Ноорог мэдээ байна'}),staff('editor')),env);assert.equal(r.status,201);const draft=(await r.json()).item;
 assert.equal(draft.author,'Бат');assert.equal(draft.publishedAt,0);
 r=await handleNewsAPI(req('POST',article({featured:true}),staff('admin')),env);assert.equal(r.status,201);const live=(await r.json()).item;
 assert.equal((await handleNewsAPI(new Request(origin+'/api/admin/news',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json',...staff('admin')},body:JSON.stringify(article())}),env)).status,403);
 const pub=await (await handleNewsAPI(new Request(origin+'/api/news'),env)).json();
 assert.deepEqual(pub.items.map(i=>i.id),[live.id]);assert.equal(pub.items[0].body,undefined);
 assert.equal(await publishedBySlug(env,draft.slug),null);
 assert.equal((await publishedBySlug(env,live.slug)).body.includes('**тод**'),true);
 const all=await (await handleNewsAPI(req('GET',null,staff('editor')),env)).json();assert.equal(all.items.length,2);
});

test('Publishing fixes the public date; feed, featured, most-read, category and sitemap queries work',async()=>{
 const {env}=fixture();const H=staff('editor');
 const make=async extra=>(await (await handleNewsAPI(req('POST',article(extra),H),env)).json()).item;
 const a=await make({title:'Санхүүгийн мэдээ нэг',category:'finance',status:'draft'});
 const b=await make({title:'Эдийн засгийн мэдээ хоёр'});
 let r=await handleNewsAPI(req('PUT',{...article({title:'Санхүүгийн мэдээ нэг',category:'finance',featured:true}),id:a.id},H),env);
 const published=(await r.json()).item;assert(published.publishedAt>0);
 r=await handleNewsAPI(req('PUT',{...article({title:'Санхүүгийн мэдээ нэг (зассан)',category:'finance',featured:true}),id:a.id},H),env);
 assert.equal((await r.json()).item.publishedAt,published.publishedAt);
 assert.equal((await featuredArticle(env)).id,a.id);
 await countView(env,b.id);await countView(env,b.id);
 assert.equal((await mostRead(env))[0].id,b.id);
 assert.deepEqual((await listPublished(env,{category:'finance'})).items.map(i=>i.id),[a.id]);
 assert.deepEqual((await listPublished(env,{excludeIds:[a.id]})).items.map(i=>i.id),[b.id]);
 assert.equal((await listPublished(env,{category:'nope'})).total,0);
 assert.equal((await sitemapEntries(env)).length,2);
 assert.equal((await handleNewsAPI(req('DELETE',{id:a.id},H),env)).status,200);
 assert.equal((await handleNewsAPI(req('DELETE',{id:a.id},H),env)).status,404);
});
