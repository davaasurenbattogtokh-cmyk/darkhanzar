import {defaultSettings,cleanSettings,normalizeSiteSettings} from '../src/lib/site-settings.mjs';
import {handleAdmins} from './admin-users.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function adminIdentity(request,env){
  const userId=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  // The role header is set only by the trusted Node boundary (trustedHeaders) for role='admin' accounts;
  // any client-supplied oai-* headers are stripped before this runs.
  const role=request.headers.get('oai-authenticated-user-role');
  const allowed=(env.ADMIN_EMAIL||'').toLowerCase().trim();
  const primary=!!userId&&!!allowed&&email?.toLowerCase()===allowed;
  const authorized=primary||(!!userId&&!!email&&role==='admin');
  // Moderators (хяналтын ажилтан) only review pending ads; admins can do that too.
  return {authenticated:!!userId,authorized,primary,userId,email,reviewer:authorized||(!!userId&&role==='moderator')};
}
export function validMutationOrigin(request){
  return request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site';
}
// Validates an uploaded image by its magic bytes and stores it; shared by banners and news.
export async function storeImage(request,env){
 if(Number(request.headers.get('Content-Length'))>6*1024*1024)return json({error:'Зураг 5MB-аас бага байна.'},413);
 const form=await request.formData();const file=form.get('file');
 if(!file||typeof file==='string'||file.size>5*1024*1024||file.size<12)return json({error:'JPG, PNG, GIF, WEBP зураг 5MB-аас бага байна.'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());
 let ext='',type='';
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff){ext='jpg';type='image/jpeg';}
 else if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)){ext='png';type='image/png';}
 else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){ext='webp';type='image/webp';}
 else if(['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.slice(0,6)))){ext='gif';type='image/gif';}
 else return json({error:'Зургийн файл танигдсангүй. JPG, PNG, GIF, WEBP ашиглана уу.'},400);
 const key=`${crypto.randomUUID()}.${ext}`;
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
 return json({url:`/api/media/${key}`},201);
}
async function settingsRecord(env){
  const row=await env.DB.prepare('SELECT value_json, revision FROM site_settings WHERE id = 1').first();
  return row?{settings:normalizeSiteSettings(JSON.parse(row.value_json)),revision:row.revision}:{settings:defaultSettings,revision:0};
}
export async function handleAdminAPI(request,env){
 const path=new URL(request.url).pathname;
 if(!path.startsWith('/api/'))return null;
 try{
  if(path==='/api/settings'&&request.method==='GET')return json(await settingsRecord(env));
  if(path.startsWith('/api/media/')&&request.method==='GET'){
   if(!/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp|gif)$/.test(path))return json({error:'Зураг олдсонгүй.'},404);
   const object=await env.BUCKET.get(path.slice('/api/media/'.length));
   if(!object)return json({error:'Зураг олдсонгүй.'},404);
   const headers=new Headers({'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"});
   return new Response(object.body,{headers});
  }
  const identity=adminIdentity(request,env);
  if(path==='/api/admin/session'&&request.method==='GET'){
   const role=request.headers.get('oai-authenticated-user-role');
   const editor=identity.authenticated&&!identity.authorized&&role==='editor';
   const moderator=identity.authenticated&&!identity.authorized&&role==='moderator';
   let name=request.headers.get('oai-authenticated-user-full-name')||'';try{name=decodeURIComponent(name);}catch{name='';}
   return json({authenticated:identity.authenticated,authorized:identity.authorized,primary:identity.primary,editor,moderator,name:(identity.authorized||editor||moderator)?name.slice(0,100):undefined,email:identity.authorized?identity.email:undefined});
  }
  if(!path.startsWith('/api/admin/'))return json({error:'Олдсонгүй.'},404);
  if(!identity.authenticated)return json({error:'Админы эрхээр нэвтэрнэ үү.'},401);
  if(!identity.authorized)return json({error:'Танд админы эрх байхгүй байна.'},403);
  if(request.method==='GET'&&path==='/api/admin/settings')return json(await settingsRecord(env));
  if(path==='/api/admin/admins')return handleAdmins(request,env,identity,validMutationOrigin(request));
  if(!validMutationOrigin(request))return json({error:'Хүсэлтийн эх сурвалж буруу байна.'},403);
  if(path==='/api/admin/settings'&&request.method==='PUT'){
   if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON хүсэлт шаардлагатай.'},415);
   const raw=await request.text();if(raw.length>65536)return json({error:'Мэдээлэл хэт их байна.'},413);
   const input=JSON.parse(raw);let value;try{value=cleanSettings(input.settings);}catch(e){return json({error:e.message},400);}
   if(!Number.isInteger(input.revision)||input.revision<0)return json({error:'Хувилбарын дугаар буруу байна.'},400);
   const valueJSON=JSON.stringify(value),next=input.revision+1,now=new Date().toISOString();
   const write=input.revision===0
    ?env.DB.prepare('INSERT INTO site_settings (id,value_json,revision,updated_at,updated_by) VALUES (1,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind(valueJSON,next,now,identity.userId)
    :env.DB.prepare('UPDATE site_settings SET value_json=?,revision=?,updated_at=?,updated_by=? WHERE id=1 AND revision=? RETURNING revision').bind(valueJSON,next,now,identity.userId,input.revision);
   const results=await env.DB.batch([
    write,
    env.DB.prepare('INSERT INTO admin_audit (actor_id,action,settings_revision,created_at) SELECT ?,?,?,? WHERE changes() > 0').bind(identity.userId,'settings.update',next,now),
   ]);
   if(!results[0].results?.length)return json({error:'Тохиргоог өөр газраас шинэчилсэн байна. Шинэчилж аваад дахин хадгална уу.'},409);
   return json({settings:value,revision:next});
  }
  if(path==='/api/admin/upload'&&request.method==='POST')return storeImage(request,env);
  return json({error:'Хүсэлтийн арга дэмжигдэхгүй байна.'},405);
 }catch(error){console.error('Admin API failed',path,error?.message);return json({error:'Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.'},500);}
}
