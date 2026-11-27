import {adminIdentity,validMutationOrigin} from './admin-api.mjs';
import {validateDraft} from '../src/lib/domain.mjs';
const locationLabels={darkhan:'Дархан',khongor:'Хонгор',orkhon:'Орхон',sharyngol:'Шарын гол',sukhbaatar:'Сүхбаатар хот',khutul:'Хөтөл'};
export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export class PublicError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export async function bodyJSON(request,limit=65536){
 if(!request.headers.get('Content-Type')?.includes('application/json'))throw new PublicError('JSON хүсэлт шаардлагатай.',415);
 if(Number(request.headers.get('Content-Length'))>limit)throw new PublicError('Мэдээлэл хэт их байна.',413);
 const reader=request.body?.getReader();if(!reader)throw new PublicError('Мэдээлэл шаардлагатай.');let length=0,text='';const decoder=new TextDecoder();
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new PublicError('Мэдээлэл хэт их байна.',413);}text+=decoder.decode(value,{stream:true});}
 try{return JSON.parse(text+decoder.decode());}catch{throw new PublicError('Мэдээллийн бүтэц буруу.');}
}
export function marketIdentity(request){
 const id=request.headers.get('oai-authenticated-user-id');let name=request.headers.get('oai-authenticated-user-full-name')||'Зарын эзэн';
 if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='Зарын эзэн';}}
 return id?{id,name:name.slice(0,100)}:null;
}
export const first=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
export const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
export async function all(env,sql,...args){return (await env.DB.prepare(sql).bind(...args).all()).results||[];}
export const getMarketListing=(env,id)=>first(env,'SELECT * FROM market_listings WHERE id=?',id);
export function publicListing(row,owner=false){
 const data=JSON.parse(row.data_json);
 return {...data,place:locationLabels[data.place]||data.place,id:row.id,status:row.status,createdAt:row.created_at,ownerId:owner?row.owner_id:'registered-seller',persisted:true,updatedAt:row.updated_at,featured:row.status==='published'&&row.promoted_until>Date.now(),promotedUntil:row.promoted_until||undefined};
}
const categoryNames={property:'Үл хөдлөх',cars:'Автомашин',fashion:'Хувцас, хэрэглэл',jobs:'Ажлын зар',kids:'Хүүхдийн бараа',computers:'Компьютер, сэлбэг',phones:'Утас, дугаар',electronics:'Цахилгаан бараа',home:'Гэр ахуйн бараа',equipment:'Төхөөрөмж, материал',hobby:'Амралт, спорт, хобби',health:'Эрүүл мэнд, гоо сайхан',animals:'Мал, амьтан, ургамал',services:'Үйлчилгээ',free:'Үнэгүй өгнө'};
function cleanDraft(d,who){
 const error=validateDraft(d);if(error)throw new PublicError(error);
 if(!Object.hasOwn(categoryNames,d.category)||!Array.isArray(d.images)||d.images.length>8||d.images.some(x=>typeof x!=='string'||!/^\/api\/listing-media\/[a-f0-9-]{36}\.jpg$/.test(x)))throw new PublicError('Бодит зарын зургаа байршуулна уу. Жишээ зураг ашиглахгүй.');
 if(typeof d.description!=='string'||d.description.length>5000||typeof d.subcategory!=='string'||d.subcategory.length>600||typeof d.place!=='string'||d.place.length>200||!['new','used'].includes(d.condition))throw new PublicError('Зарын мэдээллээ шалгана уу.');
 if(d.phone&&!/^[0-9]{8}$/.test(d.phone))throw new PublicError('Утас 8 оронтой байна.');
 const attributes={};for(const [key,value] of Object.entries(d.attributes||{}).slice(0,80)){if(typeof value!=='string'||key.length>80||value.length>400||['__proto__','constructor','prototype'].includes(key))throw new PublicError('Үзүүлэлт буруу байна.');attributes[key]=value;}
 return {title:d.title.trim(),description:d.description.trim(),category:d.category,categoryLabel:categoryNames[d.category],subcategory:d.subcategory,price:Number(d.price),region:d.region,place:d.place||locationLabels[d.region],images:d.images,condition:d.condition,negotiable:!!d.negotiable,attributes,seller:who.name,...(d.phone?{phone:d.phone}:{})};
}
export async function handleMarketAPI(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/market/')&&!path.startsWith('/api/listing-media/')&&path!=='/api/admin/listings'&&path!=='/api/admin/listings/feature')return null;
 try{
  if(path.startsWith('/api/listing-media/')&&request.method==='GET'){
   if(!/^\/api\/listing-media\/[a-f0-9-]{36}\.jpg$/.test(path))return json({error:'Зураг олдсонгүй.'},404);
   const object=await env.BUCKET.get('listing-media/'+path.split('/').pop());if(!object)return json({error:'Зураг олдсонгүй.'},404);
   return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'}});
  }
  const who=marketIdentity(request),admin=adminIdentity(request,env);
  if(path==='/api/market/session'&&request.method==='GET')return json({user:who,admin:admin.authorized});
  if(path==='/api/market/listings'&&request.method==='GET'){
   const rows=await all(env,"SELECT * FROM market_listings WHERE status='published' ORDER BY created_at DESC LIMIT 2000");return json({items:rows.map(r=>publicListing(r,r.owner_id===who?.id))});
  }
  if(!who)throw new PublicError('Баталгаажсан бүртгэлээр нэвтэрнэ үү.',401);
  if(path==='/api/market/mine'&&request.method==='GET')return json({items:(await all(env,'SELECT * FROM market_listings WHERE owner_id=? ORDER BY created_at DESC LIMIT 200',who.id)).map(r=>publicListing(r,true))});
  if(path.startsWith('/api/admin/listings')&&!admin.authorized)throw new PublicError('Админы эрх шаардлагатай.',403);
  if(path==='/api/admin/listings'&&request.method==='GET'){
   // ?scope=published: every live ad, featured first, for the admin's free «онцгой болгох».
   if(url.searchParams.get('scope')==='published')return json({items:(await all(env,"SELECT * FROM market_listings WHERE status='published' ORDER BY promoted_until DESC, created_at DESC LIMIT 1000")).map(r=>publicListing(r))});
   return json({items:(await all(env,"SELECT * FROM market_listings WHERE status='pending' ORDER BY created_at LIMIT 200")).map(r=>publicListing(r))});
  }
  if(!validMutationOrigin(request))throw new PublicError('Хүсэлтийн эх сурвалж буруу.',403);
  if(path==='/api/market/upload'&&request.method==='POST'){
   const limit=2*1024*1024;if(Number(request.headers.get('Content-Length'))>limit)throw new PublicError('Зураг 2MB-аас бага байна.',413);
   const reader=request.body?.getReader();if(!reader)throw new PublicError('Зураг шаардлагатай.');const chunks=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new PublicError('Зураг 2MB-аас бага байна.',413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}if(bytes.length>2*1024*1024||bytes.length<12||!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw new PublicError('JPG зураг 2MB-аас бага байна.');
   const now=Date.now(),quota=await first(env,'SELECT COUNT(*) AS count FROM market_uploads WHERE owner_id=? AND created_at>?',who.id,now-86400000);if(quota.count>=(admin.authorized?500:50))throw new PublicError('Өдрийн зураг байршуулах хязгаарт хүрлээ.',429);
   const id=crypto.randomUUID(),key=`listing-media/${id}.jpg`;
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});await run(env,'INSERT INTO market_uploads (path,owner_id,created_at) VALUES (?,?,?)',`/api/${key}`,who.id,now);return json({url:`/api/${key}`},201);
  }
  const body=await bodyJSON(request);
  if(path==='/api/admin/listings'&&request.method==='POST'){
   const status={approve:'published',reject:'rejected'}[body.action];if(!status)throw new PublicError('Үйлдэл буруу.');
   if(!Number.isSafeInteger(body.updatedAt))throw new PublicError('Зарын хувилбарыг шинэчилнэ үү.',409);
   const updated=await first(env,"UPDATE market_listings SET status=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND status='pending' AND updated_at=? RETURNING id",status,Date.now(),body.id,body.updatedAt);if(!updated)throw new PublicError('Зарыг өөрчилсөн байна. Шинэчилж аваад дахин хянана уу.',409);return json({ok:true});
  }
  if(path==='/api/admin/listings/feature'&&request.method==='POST'){
   // Admin makes any live ad featured for free (days>0) or ends its featured period (days=0).
   const days=Number(body.days);if(!Number.isInteger(days)||days<0||days>365)throw new PublicError('Хоногийн тоо 0-365 байна.');
   if(typeof body.id!=='string'||!body.id)throw new PublicError('Зар олдсонгүй.',404);
   const now=Date.now(),until=days?Math.max(now,Number((await getMarketListing(env,body.id))?.promoted_until||0))+days*86400000:0;
   const updated=await first(env,"UPDATE market_listings SET promoted_until=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND status='published' RETURNING id,promoted_until",until,now,body.id);
   if(!updated)throw new PublicError('Нийтлэгдсэн зар олдсонгүй.',404);
   return json({ok:true,promotedUntil:Number(updated.promoted_until)});
  }
  if(path==='/api/market/listings'&&request.method==='POST'){
   const data=cleanDraft(body,who);for(const image of data.images){if(!await first(env,'SELECT path FROM market_uploads WHERE path=? AND owner_id=?',image,who.id))throw new PublicError('Зураг таны бүртгэлд хамаарахгүй.',403);}
   // Admins' own ads go live at once; everyone else's wait for review.
   const now=Date.now(),newStatus=admin.authorized?'published':'pending';if(body.id){
    const row=await getMarketListing(env,body.id);if(!row||row.owner_id!==who.id)throw new PublicError('Зар олдсонгүй.',404);
    if(await first(env,'SELECT id FROM promotion_orders WHERE active_slot=?',body.id))throw new PublicError('Төлбөрийн нэхэмжлэхтэй зарын мэдээллийг түр засах боломжгүй. Эхлээд төлбөрийн төлөвийг шийдвэрлэнэ үү.',409);
    if(row.promoted_until>Date.now()&&JSON.parse(row.data_json).category!==data.category)throw new PublicError('Онцгой хугацаанд зарын үндсэн ангиллыг солих боломжгүй.',409);
    const updated=await first(env,"UPDATE market_listings SET data_json=?,status=?,updated_at=MAX(updated_at+1,?) WHERE id=? AND owner_id=? AND NOT EXISTS (SELECT 1 FROM promotion_orders WHERE active_slot=market_listings.id) AND (promoted_until<=? OR json_extract(data_json,'$.category')=?) RETURNING id",JSON.stringify(data),newStatus,now,body.id,who.id,now,data.category);if(!updated)throw new PublicError('Зарын төлбөр, төлөв өөрчлөгдсөн байна. Шинэчилнэ үү.',409);
   }else{
    const quota=await first(env,'SELECT COUNT(*) AS count FROM market_listings WHERE owner_id=? AND created_at>?',who.id,now-86400000);if(quota.count>=(admin.authorized?200:20))throw new PublicError('Өдрийн зарын хязгаарт хүрлээ.',429);
    body.id='DZ-'+crypto.randomUUID();await run(env,'INSERT INTO market_listings (id,owner_id,data_json,status,created_at,updated_at,promoted_until) VALUES (?,?,?,?,?,?,0)',body.id,who.id,JSON.stringify(data),newStatus,now,now);
   }
   return json({item:publicListing(await getMarketListing(env,body.id),true)},201);
  }
  if(path==='/api/market/status'&&request.method==='POST'){
   const status={close:'closed',resubmit:admin.authorized?'published':'pending'}[body.action];if(!status)throw new PublicError('Үйлдэл буруу.');const row=await getMarketListing(env,body.id);if(!row||row.owner_id!==who.id)throw new PublicError('Зар олдсонгүй.',404);
   await run(env,'UPDATE market_listings SET status=?,updated_at=? WHERE id=? AND owner_id=?',status,Date.now(),body.id,who.id);return json({ok:true});
  }
  return json({error:'Хүсэлтийн арга дэмжигдэхгүй.'},405);
 }catch(error){return json({error:error instanceof PublicError?error.message:'Зарын үйлчилгээтэй холбогдсонгүй.'},error instanceof PublicError?error.status:500);}
}
