import {createHash,randomBytes} from 'node:crypto';
import {adminIdentity,validMutationOrigin} from './admin-api.mjs';

// Privacy-friendly visitor statistics. A visitor is a hash of (daily random salt, IP, browser);
// salts are deleted after a day, so stored rows can never be traced back to an IP address.
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const first=(env,sql,...a)=>env.DB.prepare(sql).bind(...a).first();
const all=async(env,sql,...a)=>(await env.DB.prepare(sql).bind(...a).all()).results||[];
const run=(env,sql,...a)=>env.DB.prepare(sql).bind(...a).run();
export const RETENTION_DAYS=180;
const DAY=86400000;
export const visitDay=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

const BOT=/bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|monitor|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|phantom|selenium|puppeteer|playwright/i;
export const isBot=ua=>!ua||ua.length<20||BOT.test(ua);
export const deviceOf=ua=>/ipad|tablet|(android(?!.*mobile))/i.test(ua)?'tablet':/mobi|iphone|android/i.test(ua)?'mobile':'desktop';

// Only our own pages: a pathname plus an opened ad (?ad=) — no other query data is kept.
export function cleanPath(value){
 if(typeof value!=='string'||!/^\/(?!\/)/.test(value)||value.length>400)return '';
 let url;try{url=new URL(value,'https://x.invalid');}catch{return '';}
 if(url.origin!=='https://x.invalid')return '';
 const path=url.pathname.replace(/\/+$/,'')||'/';
 if(path.length>160||!/^\/[\p{L}\p{N}\-._~/%]*$/u.test(path)||/^\/(admin|api|_next)(\/|$)/.test(path))return '';
 const ad=url.searchParams.get('ad');
 return ad&&/^(UN-|DZ-)?[A-Za-z0-9_-]{1,80}$/.test(ad)?`${path}?ad=${ad}`:path;
}
// External referrer host only (e.g. facebook.com); same-site navigation is not a referrer.
export function referrerHost(value,siteHost){
 try{const u=new URL(String(value||''));if(!/^https?:$/.test(u.protocol))return '';const h=u.hostname.replace(/^(www|m|l|lm|mobile)\./,'').toLowerCase();return h&&h!==siteHost.replace(/^www\./,'')?h.slice(0,100):'';}catch{return '';}
}

async function daySalt(env,day){
 await run(env,'INSERT INTO visit_salts (day,salt) VALUES (?,?) ON CONFLICT(day) DO NOTHING',day,randomBytes(32).toString('hex'));
 return (await first(env,'SELECT salt FROM visit_salts WHERE day=?',day)).salt;
}

export async function recordVisit(env,{path,referrer,ip,ua,siteHost,now=Date.now()}){
 if(isBot(ua))return false;
 const clean=cleanPath(path);if(!clean)return false;
 const day=visitDay(now),salt=await daySalt(env,day);
 const visitor=createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0,32);
 // A real person rarely opens 300 pages a day; beyond that it is a script, not a visitor.
 const seen=await first(env,'SELECT COUNT(*) AS n FROM site_visits WHERE day=? AND visitor=?',day,visitor);
 if(Number(seen?.n||0)>=300)return false;
 await run(env,'INSERT INTO site_visits (id,day,visitor,path,referrer,device,created_at) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),day,visitor,clean,referrerHost(referrer,siteHost),deviceOf(ua),now);
 return true;
}

export async function pruneVisits(env,now=Date.now()){
 await run(env,'DELETE FROM site_visits WHERE created_at<?',now-RETENTION_DAYS*DAY);
 await run(env,'DELETE FROM visit_salts WHERE day<?',visitDay(now-DAY));
}

const counts=async(env,where,...a)=>{const r=await first(env,`SELECT COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views FROM site_visits WHERE ${where}`,...a);return {visitors:Number(r?.visitors||0),views:Number(r?.views||0)};};

export async function visitStats(env,{days=30,now=Date.now()}={}){
 days=[7,30,90].includes(Number(days))?Number(days):30;
 const today=visitDay(now),from=visitDay(now-(days-1)*DAY);
 const daily=await all(env,'SELECT day, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views FROM site_visits WHERE day>=? GROUP BY day ORDER BY day',from);
 const byDay=new Map(daily.map(r=>[r.day,{visitors:Number(r.visitors),views:Number(r.views)}]));
 const series=[];for(let i=days-1;i>=0;i--){const d=visitDay(now-i*DAY);series.push({day:d,...(byDay.get(d)||{visitors:0,views:0})});}
 const top=(col,extra='')=>all(env,`SELECT ${col} AS name, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS views FROM site_visits WHERE day>=? ${extra} GROUP BY ${col} ORDER BY views DESC LIMIT 10`,from);
 const pages=await top('path'),referrers=await top('referrer',"AND referrer<>''"),devices=await top('device');
 // Titles for opened ads, so "/?ad=DZ-…" reads as the ad's name.
 for(const p of pages){const id=/\?ad=(DZ-[\w-]+)$/.exec(p.name)?.[1];if(id){const row=await first(env,'SELECT data_json FROM market_listings WHERE id=?',id);try{p.title=JSON.parse(row.data_json).title;}catch{}}}
 const num=r=>({...r,visitors:Number(r.visitors),views:Number(r.views)});
 return {
  days,
  online:(await counts(env,'created_at>=?',now-5*60000)).visitors,
  today:await counts(env,'day=?',today),
  yesterday:await counts(env,'day=?',visitDay(now-DAY)),
  period:await counts(env,'day>=?',from),
  series,pages:pages.map(num),referrers:referrers.map(num),devices:devices.map(num),
 };
}

export async function handleVisitAPI(request,env,ip='unknown'){
 const url=new URL(request.url);
 if(url.pathname==='/api/visit'){
  if(request.method!=='POST')return json({error:'Хүсэлтийн арга дэмжигдэхгүй.'},405);
  if(!validMutationOrigin(request))return json({ok:false},403);
  const text=await request.text().catch(()=>'');if(text.length>2048)return json({ok:false},413);
  let body;try{body=JSON.parse(text);}catch{return json({ok:false},400);}
  await recordVisit(env,{path:body?.path,referrer:body?.referrer,ip,ua:request.headers.get('User-Agent')||'',siteHost:url.hostname});
  return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
 }
 if(url.pathname==='/api/admin/visits'){
  if(!adminIdentity(request,env).authorized)return json({error:'Админы эрх шаардлагатай.'},403);
  if(request.method!=='GET')return json({error:'Хүсэлтийн арга дэмжигдэхгүй.'},405);
  return json(await visitStats(env,{days:url.searchParams.get('days')}));
 }
 return null;
}
