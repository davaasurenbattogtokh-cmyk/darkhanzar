import {SOURCES,parsePage,parseDetail,safeImage} from './unegui-parser.mjs';
const nowISO=()=>new Date().toISOString();
export const localDay=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const first=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
async function readBounded(response,limit){
 const reader=response.body?.getReader();if(!reader)throw Error('SOURCE_EMPTY');
 let length=0;const chunks=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('SOURCE_TOO_LARGE');}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function publicHTML(url,fetcher,{allowUnavailable=false}={}){
 const response=await fetcher(url,{redirect:'manual',headers:{'User-Agent':'Darkhanzar/1.0 (daily regional listing index; source links retained)'},signal:AbortSignal.timeout(25000)});
 if(allowUnavailable&&[404,410].includes(response.status)){await response.body?.cancel();return null;}
 if(response.status!==200)throw Error(`SOURCE_HTTP_${response.status}`);
 const html=new TextDecoder().decode(await readBounded(response,3*1024*1024));
 if(/<title>[^<]*(?:just a moment|access denied|verify you are human)/i.test(html))throw Error('SOURCE_ACCESS_BLOCKED');
 return html;
}
async function getObject(env,key){const object=await env.BUCKET.get(key);return object?JSON.parse(await object.text()):null;}
const putObject=(env,key,value)=>env.BUCKET.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});
export async function syncStatus(env){
 const latest=await env.DB.prepare('SELECT day,run_id,status,state_json,updated_at FROM source_sync_runs ORDER BY day DESC LIMIT 1').first();
 const active=await env.DB.prepare('SELECT observed_at,count FROM source_publication WHERE id=1').first();
 if(!latest)return {status:'never',active};
 const s=JSON.parse(latest.state_json);
 return {day:latest.day,runId:latest.run_id,status:latest.status,updatedAt:latest.updated_at,phase:s.phase,region:SOURCES[s.regionIndex]?.location||'Сэлэнгийн хотууд',page:s.page,detailsChecked:s.cursor||0,detailsTotal:s.detailsTotal||0,counts:s.counts||{},excludedUnclear:s.excludedUnclear||0,error:s.error||null,active};
}
export async function startSync(env){
 const day=localDay(),id=crypto.randomUUID(),state={regionIndex:0,page:1,phase:'pages',counts:{},cursor:0};
 await run(env,'INSERT INTO source_sync_runs (day,run_id,status,state_json,lease_until,updated_at) VALUES (?,?,?,?,0,?) ON CONFLICT(day) DO NOTHING',day,id,'running',JSON.stringify(state),nowISO());
 return syncStatus(env);
}
export async function stepSync(env,runId,{fetcher=fetch}={}){
 const row=await first(env,'SELECT * FROM source_sync_runs WHERE run_id=?',runId);
 if(!row)throw Error('RUN_NOT_FOUND');
 if(row.status!=='running')return syncStatus(env);
 const lease=Date.now()+90000;
 const acquired=await first(env,'UPDATE source_sync_runs SET lease_until=? WHERE run_id=? AND status=? AND lease_until<? RETURNING run_id',lease,runId,'running',Date.now());
 if(!acquired)return {...await syncStatus(env),busy:true};
 const locked=await first(env,'SELECT * FROM source_sync_runs WHERE run_id=?',runId);
 const state=JSON.parse(locked.state_json),prefix=`unegui-sync/${runId}`;
 try{
  if(locked.day!==localDay())throw Error('SOURCE_RUN_EXPIRED');
  let items=(await getObject(env,`${prefix}/staging.json`))||[];
  if(state.phase==='pages'){
   const source=SOURCES[state.regionIndex];
   if(state.page>30)throw Error('SOURCE_PAGE_LIMIT');
   const url=`https://www.unegui.mn/search/${source.slug}/${state.page>1?`?page=${state.page}`:''}`;
   const page=parsePage(await publicHTML(url,fetcher),source);
   const regional=new Map(items.filter(x=>source.id===457?x.region==='darkhanuul':x.sourceRegion==='selenge').map(x=>[x.id,x]));
   const prior=regional.size;
   for(const item of page.records)regional.set(item.id,{...item,sourceRegion:source.slug,observedAt:nowISO()});
   const others=items.filter(x=>source.id===457?x.region!=='darkhanuul':x.sourceRegion!=='selenge');
   items=[...others,...regional.values()];
   state.counts[source.slug]={collected:regional.size,expected:page.expected,pages:state.page};
   if(regional.size<page.expected){
    if(regional.size===prior||!page.hasNext)throw Error('SOURCE_INCOMPLETE');
    state.page++;
   }else{
    state.regionIndex++;state.page=1;
    if(state.regionIndex>=SOURCES.length){state.phase='details';state.detailsTotal=items.length;}
   }
  }else if(state.phase==='details'){
   const unresolved=items.filter(i=>!i.detailChecked);
   // Each source detail is fetched once, three concurrently at most.
   const batch=unresolved.slice(0,3);
   const details=await Promise.all(batch.map(item=>fetchDetails(item,fetcher)));
   for(const [i,item] of batch.entries()){
    applyDetails(item,details[i]);item.detailChecked=true;state.cursor++;
   }
   if(unresolved.length<=3)state.phase='publish';
  }else if(state.phase==='publish'){
   const selected=items.filter(i=>['darkhanuul','khutul','sukhbaatar'].includes(i.region));
   state.excludedUnclear=items.filter(i=>!i.region).length;
   const counts=Object.fromEntries(['darkhanuul','khutul','sukhbaatar'].map(region=>[region,selected.filter(i=>i.region===region).length]));
   const observedAt=nowISO(),objectKey=`${prefix}/published.json`;
   const snapshot={schemaVersion:5,sourceName:'Unegui.mn',observedAt,collectedCount:selected.length,coverage:'regional_lists_complete_city_scope_explicit_only',scope:'Дархан-Уул бүхэлдээ; Сэлэнгийн Хөтөл, Сүхбаатар хотын байршил дурдсан зарууд',counts,excludedUnclear:state.excludedUnclear,items:selected.map(({cityChecked,detailChecked,sourceRegion,...i})=>i)};
   await putObject(env,objectKey,snapshot);
   state.counts={...state.counts,...counts};state.phase='complete';
   await env.DB.batch([
    env.DB.prepare('INSERT INTO source_publication (id,object_key,observed_at,count) SELECT 1,?,?,? WHERE EXISTS (SELECT 1 FROM source_sync_runs WHERE run_id=? AND lease_until=?) ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key,observed_at=excluded.observed_at,count=excluded.count').bind(objectKey,observedAt,selected.length,runId,lease),
    env.DB.prepare('UPDATE source_sync_runs SET status=?,state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?').bind('succeeded',JSON.stringify(state),observedAt,runId,lease),
   ]);
   return syncStatus(env);
  }
  await putObject(env,`${prefix}/staging.json`,items);
  await run(env,'UPDATE source_sync_runs SET state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?',JSON.stringify(state),nowISO(),runId,lease);
 }catch(error){
  state.error=/^SOURCE_[A-Z_0-9]+$/.test(error.message)?error.message:'SOURCE_FETCH_FAILED';
  await run(env,'UPDATE source_sync_runs SET status=?,state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?','failed',JSON.stringify(state),nowISO(),runId,lease);
 }
 return syncStatus(env);
}
export async function publicSnapshot(env){
 const row=await env.DB.prepare('SELECT object_key FROM source_publication WHERE id=1').first();
 return row?getObject(env,row.object_key):null;
}
export async function sourceImage(request,env,{fetcher=fetch}={}){
 const url=safeImage(new URL(request.url).searchParams.get('url'));
 if(!url)return new Response('Invalid source image',{status:400});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url)))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const key=`unegui-images/${hash}`;
 let object=await env.BUCKET.get(key);
 if(!object){
  let target=url,response;
  for(let redirect=0;redirect<3;redirect++){
   response=await fetcher(target,{redirect:'manual',headers:{'User-Agent':'Darkhanzar/1.0 (source image cache; source links retained)'},signal:AbortSignal.timeout(15000)});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('Location');
   const next=location&&safeImage(new URL(location,target).href);
   await response.body?.cancel();
   if(!next||redirect===2)return new Response('Unsafe source image redirect',{status:502});
   target=next;
  }
  if(response.status!==200)return new Response('Source image unavailable',{status:502,headers:{'X-Source-Status':String(response.status)}});
  const bytes=await readBounded(response,5*1024*1024);
  let contentType;
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)contentType='image/jpeg';
  else if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))contentType='image/png';
  else if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')contentType='image/webp';
  else if(['GIF87a','GIF89a'].includes(new TextDecoder().decode(bytes.slice(0,6))))contentType='image/gif';
  else return new Response('Unsupported image',{status:415});
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType}});object=await env.BUCKET.get(key);
 }
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata.contentType,'Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
}

async function fetchDetails(item,fetcher){
 const html=await publicHTML(item.url,fetcher,{allowUnavailable:true});
 return html===null?{attributes:item.attributes||{},detailStatus:'unavailable'}:parseDetail(html,item.id);
}
function applyDetails(item,detail){
 item.attributes=detail.attributes;item.detailsUpdatedAt=nowISO();item.detailStatus=detail.detailStatus;
 if(detail.subcategory)item.subcategory=detail.subcategory;
 if(item.region!=='darkhanuul'&&detail.city){item.region=detail.city;item.location=detail.city==='khutul'?'Хөтөл':'Сүхбаатар хот';}
}
// One-off, resumable enrichment of an already published index. The pointer CAS
// prevents an older repair replacing a newer daily publication.
export async function enrichmentStatus(env,runId){
 const row=runId?await first(env,'SELECT * FROM source_detail_runs WHERE run_id=?',runId):await first(env,'SELECT * FROM source_detail_runs ORDER BY updated_at DESC LIMIT 1');
 if(!row)return {status:'never'};
 return {runId:row.run_id,status:row.status,...JSON.parse(row.state_json),updatedAt:row.updated_at};
}
export async function startEnrichment(env){
 const active=await first(env,'SELECT object_key FROM source_publication WHERE id=1');
 if(!active)throw Error('SOURCE_NO_PUBLICATION');
 const snapshot=await getObject(env,active.object_key);
 if(snapshot.schemaVersion>=5&&snapshot.items.every(i=>i.detailsUpdatedAt))return {status:'succeeded',checked:snapshot.items.length,total:snapshot.items.length};
 const id=crypto.randomUUID(),state={baseKey:active.object_key,cursor:0,total:snapshot.items.length};
 await run(env,'INSERT INTO source_detail_runs (run_id,base_key,status,state_json,lease_until,updated_at) VALUES (?,?,?,?,0,?) ON CONFLICT(base_key) DO NOTHING',id,active.object_key,'running',JSON.stringify(state),nowISO());
 const row=await first(env,'SELECT run_id FROM source_detail_runs WHERE base_key=?',active.object_key);
 return enrichmentStatus(env,row.run_id);
}
export async function stepEnrichment(env,runId,{fetcher=fetch}={}){
 const row=await first(env,'SELECT * FROM source_detail_runs WHERE run_id=?',runId);
 if(!row)throw Error('RUN_NOT_FOUND');
 if(row.status!=='running')return enrichmentStatus(env,runId);
 const lease=Date.now()+90000;
 if(!await first(env,'UPDATE source_detail_runs SET lease_until=? WHERE run_id=? AND status=? AND lease_until<? RETURNING run_id',lease,runId,'running',Date.now()))return {...await enrichmentStatus(env,runId),busy:true};
 const locked=await first(env,'SELECT * FROM source_detail_runs WHERE run_id=?',runId),state=JSON.parse(locked.state_json),prefix=`unegui-details/${runId}`;
 try{
  const active=await first(env,'SELECT object_key FROM source_publication WHERE id=1');
  if(active?.object_key!==state.baseKey)throw Error('SOURCE_PUBLICATION_CHANGED');
  const snapshot=await getObject(env,state.cursor?`${prefix}/staging.json`:state.baseKey);
  const batch=snapshot.items.slice(state.cursor,state.cursor+3);
  const details=await Promise.all(batch.map(item=>fetchDetails(item,fetcher)));
  for(const [index,item] of batch.entries())applyDetails(item,details[index]);
  state.cursor+=batch.length;
  if(state.cursor>=state.total){
   snapshot.schemaVersion=5;snapshot.detailsUpdatedAt=nowISO();
   const key=`${prefix}/published.json`;await putObject(env,key,snapshot);
   // Only this run's held lease and unchanged source pointer may commit.
   await env.DB.batch([
    env.DB.prepare('UPDATE source_publication SET object_key=? WHERE id=1 AND object_key=? AND EXISTS (SELECT 1 FROM source_detail_runs WHERE run_id=? AND lease_until=?)').bind(key,state.baseKey,runId,lease),
    env.DB.prepare('UPDATE source_detail_runs SET status=CASE WHEN EXISTS (SELECT 1 FROM source_publication WHERE id=1 AND object_key=?) THEN ? ELSE ? END,state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?').bind(key,'succeeded','superseded',JSON.stringify(state),nowISO(),runId,lease),
   ]);
  }else{
   await putObject(env,`${prefix}/staging.json`,snapshot);
   await run(env,'UPDATE source_detail_runs SET state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?',JSON.stringify(state),nowISO(),runId,lease);
  }
 }catch(error){
  state.error=/^SOURCE_[A-Z_0-9]+$/.test(error.message)?error.message:'SOURCE_FETCH_FAILED';
  await run(env,'UPDATE source_detail_runs SET status=?,state_json=?,lease_until=0,updated_at=? WHERE run_id=? AND lease_until=?','failed',JSON.stringify(state),nowISO(),runId,lease);
 }
 return enrichmentStatus(env,runId);
}
