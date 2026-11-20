import {adminIdentity,validMutationOrigin} from './admin-api.mjs';
import {syncStatus,startSync,stepSync,publicSnapshot,sourceImage,startEnrichment,stepEnrichment,enrichmentStatus} from './source-sync.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function boundedJSON(request){
 if(Number(request.headers.get('Content-Length'))>16384)throw Error('BODY_TOO_LARGE');
 const reader=request.body?.getReader();if(!reader)throw Error('JSON_REQUIRED');
 let bytes=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384){await reader.cancel();throw Error('BODY_TOO_LARGE');}text+=decoder.decode(value,{stream:true});}
 return JSON.parse(text+decoder.decode());
}
async function operate(name,args,env){
 if(name==='unegui_details_start')return startEnrichment(env);
 if(name==='unegui_details_status')return enrichmentStatus(env,args.runId);
 if(name==='unegui_details_step'&&/^[a-f0-9-]{36}$/.test(args.runId||''))return stepEnrichment(env,args.runId);
 if(name==='unegui_sync_status')return syncStatus(env);
 if(name==='unegui_sync_start')return startSync(env);
 if(name==='unegui_sync_step'&&/^[a-f0-9-]{36}$/.test(args.runId||''))return stepSync(env,args.runId);
 throw Error('INVALID_OPERATION');
}
export async function handleSourceAPI(request,env){
 const path=new URL(request.url).pathname;
 if(!['/api/source-image','/api/source-listings','/api/admin/source-sync','/api/source-task'].includes(path))return null;
 try{
  if(path==='/api/source-image'&&request.method==='GET')return sourceImage(request,env);
  if(path==='/api/source-listings'&&request.method==='GET'){
   const snapshot=await publicSnapshot(env);
   if(new URL(request.url).searchParams.get('format')==='csv'){
    if(!snapshot)return Response.redirect(new URL('/data/unegui-darkhan.csv',request.url).href,302);
    const fields=['id','title','category','price','priceLabel','location','url','observedAt'];
    const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
    const csv='\uFEFF'+[fields.map(cell).join(','),...snapshot.items.map(i=>fields.map(f=>cell(i[f])).join(','))].join('\r\n');
    return new Response(csv,{headers:{'Content-Type':'text/csv;charset=utf-8','Content-Disposition':'attachment; filename="darkhanzar-unegui.csv"','Cache-Control':'no-store'}});
   }
   return json({snapshot});
  }
  if(path==='/api/source-task'){
   if(request.method!=='POST')return json({error:'POST required'},405);
   const header=request.headers.get('X-Darkhanzar-Sync')||'';
   const token=header.startsWith('Bearer ')?header.slice(7):'';
   if(!env.UNEGUI_SYNC_SERVICE_HASH||!token||token.length>512)return json({error:'Service authorization required'},401);
   const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');
   let difference=digest.length^env.UNEGUI_SYNC_SERVICE_HASH.length;
   for(let i=0;i<digest.length;i++)difference|=digest.charCodeAt(i)^(env.UNEGUI_SYNC_SERVICE_HASH.charCodeAt(i)||0);
   if(difference)return json({error:'Service authorization required'},401);
   const body=await boundedJSON(request);
   const name={status:'unegui_sync_status',start:'unegui_sync_start',step:'unegui_sync_step',details_start:'unegui_details_start',details_step:'unegui_details_step',details_status:'unegui_details_status'}[body.action];
   return json(await operate(name,body,env));
  }
  const who=adminIdentity(request,env);
  if(!who.authenticated)return json({error:'Админы эрхээр нэвтэрнэ үү.'},401);
  if(!who.authorized)return json({error:'Админы эрх байхгүй.'},403);
  if(request.method==='GET')return json(await syncStatus(env));
  if(request.method!=='POST')return json({error:'Арга дэмжигдэхгүй.'},405);
  if(!validMutationOrigin(request))return json({error:'Хүсэлтийн эх сурвалж буруу.'},403);
  const body=await boundedJSON(request);
  return json(await operate(body.runId?'unegui_sync_step':'unegui_sync_start',body,env));
 }catch{return json({error:'Таталтын үйлчилгээтэй холбогдсонгүй. Өмнөх мэдээллийг хадгалсан.'},502);}
}
