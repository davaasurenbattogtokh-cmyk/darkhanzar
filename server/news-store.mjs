import {newsCategories} from '../src/lib/news-categories.mjs';
import {plainText} from '../src/lib/news-markup.mjs';

// Storage and validation for business news articles. All functions take the shared env (env.DB).
const LIST_COLUMNS='id,slug,title,summary,category,cover,status,featured,author_name,views,created_at,updated_at,published_at';
const CYRILLIC={а:'a',б:'b',в:'v',г:'g',д:'d',е:'ye',ё:'yo',ж:'j',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',ө:'u',п:'p',р:'r',с:'s',т:'t',у:'u',ү:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'y',ь:'i',э:'e',ю:'yu',я:'ya'};

export class NewsError extends Error{constructor(message,status=400){super(message);this.status=status;}}

export function slugify(title,suffix=crypto.randomUUID().slice(0,6)){
 const base=String(title).toLowerCase().split('').map(ch=>CYRILLIC[ch]??ch).join('')
  .normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80).replace(/-+$/,'');
 return `${base||'medee'}-${suffix}`;
}

const safeCover=v=>v===''||/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(v);
export function cleanArticle(input){
 if(!input||typeof input!=='object')throw new NewsError('Мэдээний мэдээлэл буруу байна.');
 const text=(v,max)=>typeof v==='string'&&v.length<=max?v.trim():null;
 const title=text(input.title,200),summary=text(input.summary??'',400),body=typeof input.body==='string'&&input.body.length<=100000?input.body.replace(/\r\n?/g,'\n').trim():null;
 if(!title||title.length<5)throw new NewsError('Гарчиг 5–200 тэмдэгттэй байна.');
 if(summary===null)throw new NewsError('Товч агуулга 400 тэмдэгтээс хэтрэхгүй.');
 if(!body)throw new NewsError('Мэдээний бичвэрээ оруулна уу.');
 if(!newsCategories.some(c=>c.id===input.category))throw new NewsError('Ангиллаа сонгоно уу.');
 if(typeof input.cover!=='string'||!safeCover(input.cover))throw new NewsError('Нүүр зургаа дахин байршуулна уу.');
 if(!['draft','published'].includes(input.status))throw new NewsError('Төлөв буруу байна.');
 return {title,summary:summary||plainText(body,300),body,category:input.category,cover:input.cover,status:input.status,featured:input.featured===true};
}

const view=r=>r&&{id:r.id,slug:r.slug,title:r.title,summary:r.summary,category:r.category,cover:r.cover,status:r.status,featured:!!Number(r.featured),author:r.author_name,views:Number(r.views),createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),publishedAt:Number(r.published_at),...(r.body!==undefined?{body:r.body}:{})};
const rows=async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results||[];
const one=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
const int=(v,min,max,fallback)=>{const n=Number.parseInt(v,10);return Number.isInteger(n)?Math.min(max,Math.max(min,n)):fallback;};

// ---- Public reads (published only) ----
/** @param {any} env @param {{category?:string,limit?:number,offset?:number,excludeIds?:string[]}} [options] */
export async function listPublished(env,{category='',limit=12,offset=0,excludeIds=[]}={}){
 const lim=int(limit,1,50,12),off=int(offset,0,100000,0);
 const where=["status='published'"],args=[];
 if(category){if(!newsCategories.some(c=>c.id===category))return {items:[],total:0};where.push('category=?');args.push(category);}
 const ids=excludeIds.filter(id=>typeof id==='string').slice(0,20);
 if(ids.length){where.push(`id NOT IN (${ids.map(()=>'?').join(',')})`);args.push(...ids);}
 const clause=where.join(' AND ');
 const total=Number((await one(env,`SELECT COUNT(*) AS n FROM news_articles WHERE ${clause}`,...args))?.n||0);
 const items=(await rows(env,`SELECT ${LIST_COLUMNS} FROM news_articles WHERE ${clause} ORDER BY published_at DESC LIMIT ${lim} OFFSET ${off}`,...args)).map(view);
 return {items,total};
}
export async function featuredArticle(env){
 return view(await one(env,`SELECT ${LIST_COLUMNS} FROM news_articles WHERE status='published' AND featured=1 ORDER BY published_at DESC LIMIT 1`))
  ||view(await one(env,`SELECT ${LIST_COLUMNS} FROM news_articles WHERE status='published' ORDER BY published_at DESC LIMIT 1`));
}
export async function mostRead(env,{days=30,limit=5}={}){
 const since=Date.now()-int(days,1,3650,30)*86400000;
 return (await rows(env,`SELECT ${LIST_COLUMNS} FROM news_articles WHERE status='published' AND published_at>=? ORDER BY views DESC, published_at DESC LIMIT ${int(limit,1,20,5)}`,since)).map(view);
}
export async function publishedBySlug(env,slug){
 if(typeof slug!=='string'||!/^[a-z0-9-]{1,120}$/.test(slug))return null;
 return view(await one(env,"SELECT * FROM news_articles WHERE slug=? AND status='published'",slug));
}
export async function countView(env,id){await env.DB.prepare('UPDATE news_articles SET views=views+1 WHERE id=?').bind(id).run();}
export async function sitemapEntries(env){
 return (await rows(env,"SELECT slug,updated_at FROM news_articles WHERE status='published' ORDER BY published_at DESC LIMIT 5000")).map(r=>({slug:r.slug,updatedAt:Number(r.updated_at)}));
}

// ---- Staff (admin / editor) ----
export async function listAll(env){return (await rows(env,'SELECT * FROM news_articles ORDER BY updated_at DESC LIMIT 500')).map(view);}
export async function createArticle(env,input,author){
 const a=cleanArticle(input),now=Date.now(),id=crypto.randomUUID();
 const slug=slugify(a.title);
 await env.DB.prepare('INSERT INTO news_articles (id,slug,title,summary,body,category,cover,status,featured,author_id,author_name,views,created_at,updated_at,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)')
  .bind(id,slug,a.title,a.summary,a.body,a.category,a.cover,a.status,a.featured?1:0,author.id,author.name.slice(0,100),now,now,a.status==='published'?now:0).run();
 return view(await one(env,'SELECT * FROM news_articles WHERE id=?',id));
}
export async function updateArticle(env,id,input){
 const current=typeof id==='string'?await one(env,'SELECT * FROM news_articles WHERE id=?',id):null;
 if(!current)throw new NewsError('Мэдээ олдсонгүй.',404);
 const a=cleanArticle(input),now=Date.now();
 // The first publication fixes the public date; later edits keep it.
 const publishedAt=a.status==='published'?(Number(current.published_at)||now):Number(current.published_at);
 await env.DB.prepare('UPDATE news_articles SET title=?,summary=?,body=?,category=?,cover=?,status=?,featured=?,updated_at=?,published_at=? WHERE id=?')
  .bind(a.title,a.summary,a.body,a.category,a.cover,a.status,a.featured?1:0,now,publishedAt,id).run();
 return view(await one(env,'SELECT * FROM news_articles WHERE id=?',id));
}
export async function deleteArticle(env,id){
 const current=typeof id==='string'?await one(env,'SELECT id,title FROM news_articles WHERE id=?',id):null;
 if(!current)throw new NewsError('Мэдээ олдсонгүй.',404);
 await env.DB.prepare('DELETE FROM news_articles WHERE id=?').bind(id).run();
 return current;
}
