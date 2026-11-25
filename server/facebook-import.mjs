import {createHmac} from 'node:crypto';
import {parsePost,postImages} from './facebook-parse.mjs';
import {adminIdentity,validMutationOrigin} from './admin-api.mjs';

// Imports ads posted on the Darkhanzar Facebook page: every post with a photo and a phone number
// becomes a published listing owned by the primary admin. Runs daily at 08:00 (Ulaanbaatar) and on demand.
export const DEFAULT_SINCE='2026-10-01T00:00:00+08:00';
const GRAPH='https://graph.facebook.com';
const MAX_IMAGE=2*1024*1024;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const first=(env,sql,...a)=>env.DB.prepare(sql).bind(...a).first();
const run=(env,sql,...a)=>env.DB.prepare(sql).bind(...a).run();
export const localDay=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const localHour=(now=Date.now())=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ulaanbaatar',hour:'2-digit',hourCycle:'h23'}).format(now));

export const facebookImportConfigured=env=>/^\d{5,25}$/.test(env.FACEBOOK_PAGE_ID||'')&&String(env.FACEBOOK_PAGE_TOKEN||'').length>20;

function sign(env,url){
 url.searchParams.set('access_token',env.FACEBOOK_PAGE_TOKEN);
 if(env.FACEBOOK_APP_SECRET)url.searchParams.set('appsecret_proof',createHmac('sha256',env.FACEBOOK_APP_SECRET).update(env.FACEBOOK_PAGE_TOKEN).digest('hex'));
 return url;
}
function graphURL(env,path,params={}){
 const url=new URL(`${GRAPH}/${env.FACEBOOK_GRAPH_VERSION||'v23.0'}/${path}`);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 return sign(env,url);
}
async function graphGET(url,fetcher){
 const r=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 const body=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(`FACEBOOK_${body?.error?.code||r.status}`);e.detail=String(body?.error?.message||'').slice(0,200);throw e;}
 return body;
}

// All page posts since a time, following Graph paging (only to graph.facebook.com).
export async function fetchPagePosts(env,sinceMs,{fetcher=fetch,maxPages=60}={}){
 const posts=[];
 let url=graphURL(env,`${env.FACEBOOK_PAGE_ID}/feed`,{fields:'id,message,created_time,permalink_url,full_picture,attachments{type,media,subattachments.limit(10){type,media}}',since:String(Math.floor(sinceMs/1000)),limit:'50'});
 for(let page=0;url&&page<maxPages;page++){
  const body=await graphGET(url,fetcher);
  posts.push(...(body.data||[]));
  const next=body.paging?.next?new URL(body.paging.next):null;
  url=next&&next.origin===GRAPH?sign(env,next):null;
 }
 return posts;
}

function isFacebookCDN(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='fbcdn.net'||u.hostname.endsWith('.fbcdn.net'));}catch{return false;}
}
// Downloads one post photo as JPEG (≤2MB) into listing media. Returns the media path or ''.
async function storePhoto(env,src,owner,fetcher){
 if(!isFacebookCDN(src))return '';
 const r=await fetcher(src,{headers:{Accept:'image/jpeg'},redirect:'follow',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!isFacebookCDN(r.url||src)){await r.body?.cancel?.();return '';}
 if(Number(r.headers.get('Content-Length'))>MAX_IMAGE){await r.body?.cancel?.();return '';}
 const bytes=new Uint8Array(await r.arrayBuffer());
 if(bytes.length>MAX_IMAGE||bytes.length<12||!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))return '';
 const id=crypto.randomUUID(),key=`listing-media/${id}.jpg`;
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 await run(env,'INSERT INTO market_uploads (path,owner_id,created_at) VALUES (?,?,?)',`/api/${key}`,owner.id,Date.now());
 return `/api/${key}`;
}

async function importOwner(env){
 const email=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
 const row=email?await first(env,'SELECT id,name FROM auth_users WHERE email=?',email):null;
 return row||await first(env,"SELECT id,name FROM auth_users WHERE role='admin' ORDER BY created_at LIMIT 1");
}

// Imports the given posts; already-seen post IDs are skipped.
export async function importPosts(env,posts,{fetcher=fetch}={}){
 const owner=await importOwner(env);
 if(!owner)throw Error('FACEBOOK_NO_ADMIN');
 const result={seen:posts.length,imported:0,skipped:0,already:0,reasons:{}};
 const skip=async(post,reason)=>{result.skipped++;result.reasons[reason]=(result.reasons[reason]||0)+1;await run(env,'INSERT INTO facebook_imports (post_id,listing_id,status,reason,created_at) VALUES (?,?,?,?,?) ON CONFLICT(post_id) DO NOTHING',post.id,'','skipped',reason,Date.now());};
 // Oldest first, so the listings keep the page's order.
 for(const post of [...posts].sort((a,b)=>Date.parse(a.created_time)-Date.parse(b.created_time))){
  if(typeof post?.id!=='string'||!/^[\d_]{3,80}$/.test(post.id))continue;
  if(await first(env,'SELECT post_id FROM facebook_imports WHERE post_id=?',post.id)){result.already++;continue;}
  const draft=parsePost(post.message);
  if(!draft){await skip(post,'no_phone');continue;}
  const sources=postImages(post);
  if(!sources.length){await skip(post,'no_photo');continue;}
  const images=[];
  for(const src of sources){try{const path=await storePhoto(env,src,owner,fetcher);if(path)images.push(path);}catch{/* one bad photo does not stop the post */}}
  if(!images.length){await skip(post,'photo_unavailable');continue;}
  const created=Number.isFinite(Date.parse(post.created_time))?Date.parse(post.created_time):Date.now();
  const id='DZ-'+crypto.randomUUID();
  const data={...draft,images,seller:owner.name,facebook:{postId:post.id,url:typeof post.permalink_url==='string'&&post.permalink_url.startsWith('https://www.facebook.com/')?post.permalink_url:''}};
  // Claim the post first so two runs can never create the same listing twice.
  await run(env,'INSERT INTO facebook_imports (post_id,listing_id,status,reason,created_at) VALUES (?,?,?,?,?) ON CONFLICT(post_id) DO NOTHING',post.id,id,'imported','',Date.now());
  const claim=await first(env,'SELECT listing_id FROM facebook_imports WHERE post_id=?',post.id);
  if(claim?.listing_id!==id){result.already++;continue;}
  await run(env,'INSERT INTO market_listings (id,owner_id,data_json,status,created_at,updated_at,promoted_until) VALUES (?,?,?,?,?,?,0)',id,owner.id,JSON.stringify(data),'published',created,Date.now());
  result.imported++;
 }
 return result;
}

let active=null;
// One run at a time in this process. `since` is the last successful run (minus a day of overlap).
export function runFacebookImport(env,trigger='manual',{fetcher=fetch}={}){
 if(active)return active;
 active=(async()=>{
  const id=`${trigger}-${trigger==='daily'?localDay():crypto.randomUUID()}`,started=Date.now();
  if(trigger!=='daily')await run(env,'INSERT INTO facebook_import_runs (id,day,trig,status,started_at,finished_at,result_json) VALUES (?,?,?,?,?,0,?)',id,localDay(),trigger,'running',started,'{}');
  try{
   const last=await first(env,"SELECT started_at FROM facebook_import_runs WHERE status='ok' ORDER BY started_at DESC LIMIT 1");
   const since=last?Number(last.started_at)-86400000:Date.parse(env.FACEBOOK_IMPORT_SINCE||DEFAULT_SINCE);
   const posts=await fetchPagePosts(env,since,{fetcher});
   const result={...await importPosts(env,posts,{fetcher}),since:new Date(since).toISOString()};
   await run(env,'UPDATE facebook_import_runs SET status=?,finished_at=?,result_json=? WHERE id=?','ok',Date.now(),JSON.stringify(result),id);
   return {id,status:'ok',...result};
  }catch(error){
   const result={error:String(error.message||'FACEBOOK_FAILED').slice(0,80),detail:error.detail||''};
   await run(env,'UPDATE facebook_import_runs SET status=?,finished_at=?,result_json=? WHERE id=?','failed',Date.now(),JSON.stringify(result),id);
   return {id,status:'failed',...result};
  }
 })().finally(()=>{active=null;});
 return active;
}

// Scheduler hook: once per Ulaanbaatar day, from 08:00. The day row is the cross-process claim.
export async function dailyFacebookImport(env,{now=Date.now(),fetcher=fetch}={}){
 if(active||!facebookImportConfigured(env)||localHour(now)<8)return null;
 const id=`daily-${localDay(now)}`;
 if(await first(env,'SELECT id FROM facebook_import_runs WHERE id=?',id))return null;
 const token=crypto.randomUUID();
 await run(env,'INSERT INTO facebook_import_runs (id,day,trig,status,started_at,finished_at,result_json) VALUES (?,?,?,?,?,0,?) ON CONFLICT(id) DO NOTHING',id,localDay(now),'daily','running',now,JSON.stringify({claim:token}));
 const row=await first(env,'SELECT result_json FROM facebook_import_runs WHERE id=?',id);
 if(!row||JSON.parse(row.result_json).claim!==token)return null;
 return runFacebookImport(env,'daily',{fetcher});
}

export async function facebookImportStatus(env){
 const runs=(await env.DB.prepare('SELECT id,trig,status,started_at,finished_at,result_json FROM facebook_import_runs ORDER BY started_at DESC LIMIT 5').all()).results||[];
 const total=await first(env,"SELECT COUNT(*) AS n FROM facebook_imports WHERE status='imported'");
 return {configured:facebookImportConfigured(env),running:!!active,imported:Number(total?.n||0),schedule:'Өдөр бүр 08:00',runs:runs.map(r=>({id:r.id,trigger:r.trig,status:r.status,startedAt:Number(r.started_at),finishedAt:Number(r.finished_at),result:(()=>{try{const {claim,...rest}=JSON.parse(r.result_json);return rest;}catch{return {};}})()}))};
}

export async function handleFacebookImportAPI(request,env){
 const path=new URL(request.url).pathname;
 if(path!=='/api/admin/facebook-import')return null;
 if(!adminIdentity(request,env).authorized)return json({error:'Админы эрх шаардлагатай.'},403);
 if(request.method==='GET')return json(await facebookImportStatus(env));
 if(request.method==='POST'){
  if(!validMutationOrigin(request))return json({error:'Хүсэлтийн эх сурвалж буруу.'},403);
  if(!facebookImportConfigured(env))return json({error:'Facebook пейжийн холболт хийгдээгүй байна.'},409);
  // Start in the background; the first import (since 1 October) can take a few minutes.
  void runFacebookImport(env,'manual');
  return json({started:true,...await facebookImportStatus(env)},202);
 }
 return json({error:'Хүсэлтийн арга дэмжигдэхгүй.'},405);
}
